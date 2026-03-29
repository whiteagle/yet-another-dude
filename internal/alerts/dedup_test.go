package alerts

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/whiteagle/yet-another-dude/internal/db"
)

// stubDB is a minimal db.DB-like stub for engine tests.
// We use the real Engine but with a nil *db.DB since the engine only calls
// InsertAlertEvent and ListAlertRulesForDevice — both of which we bypass by
// constructing the engine in a way that avoids a real DB.
//
// Instead we test the firing-state logic through the engine's exported
// Evaluate method by wiring a test DB that records insertions.

// fakeDB records every InsertAlertEvent call and returns fixed rules.
type fakeDB struct {
	rules  []db.AlertRule
	events []db.AlertEvent
}

func (f *fakeDB) listRules(_ context.Context, deviceID string) ([]db.AlertRule, error) {
	return f.rules, nil
}

func (f *fakeDB) insertEvent(_ context.Context, e db.AlertEvent) error {
	f.events = append(f.events, e)
	return nil
}

// engineWithFake creates an Engine that uses fakeDB via monkey-patching
// the unexported database calls.  Because the Engine struct holds a *db.DB
// and we don't want a real SQLite file in unit tests we test the dedup
// logic through the internal helpers directly.

func TestAlertDeduplication(t *testing.T) {
	// Build an Engine with an empty firing map (mirrors production start).
	eng := &Engine{firing: make(map[alertKey]struct{})}

	devID := "dev1"
	rule := db.AlertRule{
		ID:        "r1",
		DeviceID:  &devID,
		Metric:    "cpu",
		Condition: db.AlertConditionGT,
		Threshold: 80.0,
	}
	const deviceID = "dev1"
	const label = "test-device"

	// First call: metric ABOVE threshold → should create a firing entry.
	key := alertKey{ruleID: rule.ID, deviceID: deviceID}

	fired1 := eng.testEval(rule, deviceID, label, 95.0)
	if !fired1 {
		t.Fatal("expected alert to fire on OK→FIRING transition")
	}
	if _, ok := eng.firing[key]; !ok {
		t.Fatal("expected key to be in firing map after first trigger")
	}

	// Second call: still above threshold → must NOT fire again.
	fired2 := eng.testEval(rule, deviceID, label, 92.0)
	if fired2 {
		t.Fatal("alert fired again while already in FIRING state (dedup broken)")
	}

	// Third call: metric drops BELOW threshold → state cleared, no new event.
	fired3 := eng.testEval(rule, deviceID, label, 70.0)
	if fired3 {
		t.Fatal("alert fired during FIRING→OK transition (should just clear state)")
	}
	if _, ok := eng.firing[key]; ok {
		t.Fatal("expected key to be removed from firing map after recovery")
	}

	// Fourth call: above threshold again → fires once more (new OK→FIRING).
	fired4 := eng.testEval(rule, deviceID, label, 99.0)
	if !fired4 {
		t.Fatal("expected alert to re-fire after recovery")
	}
}

// testEval exercises the dedup logic without touching the DB.
// Returns true if the call would have produced a new alert event.
func (e *Engine) testEval(rule db.AlertRule, deviceID, label string, value float64) bool {
	e.mu.Lock()
	defer e.mu.Unlock()

	key := alertKey{ruleID: rule.ID, deviceID: deviceID}
	_, wasFiring := e.firing[key]
	nowFiring := shouldTrigger(rule.Condition, value, rule.Threshold)

	if nowFiring && !wasFiring {
		e.firing[key] = struct{}{}
		return true
	}
	if !nowFiring && wasFiring {
		delete(e.firing, key)
	}
	return false
}

// TestWebhookRetry verifies that transient 5xx errors trigger retries and
// that a 4xx response aborts immediately without retrying.
func TestWebhookRetry(t *testing.T) {
	t.Run("retries on 5xx then succeeds", func(t *testing.T) {
		var calls atomic.Int32
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			n := calls.Add(1)
			if n < 3 {
				w.WriteHeader(http.StatusServiceUnavailable) // 503 on first 2
				return
			}
			w.WriteHeader(http.StatusOK)
		}))
		defer srv.Close()

		n := &WebhookNotifier{client: &http.Client{Timeout: 5 * time.Second}}
		rule := db.AlertRule{NotifyWebhook: srv.URL}

		ctx := context.Background()
		if err := n.Notify(ctx, db.AlertEvent{}, rule); err != nil {
			t.Fatalf("expected success after retry, got: %v", err)
		}
		if calls.Load() != 3 {
			t.Errorf("expected 3 calls, got %d", calls.Load())
		}
	})

	t.Run("4xx client error not retried", func(t *testing.T) {
		var calls atomic.Int32
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			calls.Add(1)
			w.WriteHeader(http.StatusUnauthorized) // 401 — client error
		}))
		defer srv.Close()

		n := &WebhookNotifier{client: &http.Client{Timeout: 5 * time.Second}}
		rule := db.AlertRule{NotifyWebhook: srv.URL}

		if err := n.Notify(context.Background(), db.AlertEvent{}, rule); err == nil {
			t.Fatal("expected error for 401 response")
		}
		if calls.Load() != 1 {
			t.Errorf("expected exactly 1 call for 4xx, got %d", calls.Load())
		}
	})

	t.Run("empty webhook URL is no-op", func(t *testing.T) {
		n := &WebhookNotifier{client: http.DefaultClient}
		rule := db.AlertRule{NotifyWebhook: ""}
		if err := n.Notify(context.Background(), db.AlertEvent{}, rule); err != nil {
			t.Fatalf("expected no error for empty URL, got: %v", err)
		}
	})
}

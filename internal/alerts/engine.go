// Package alerts implements the alert evaluation engine and notification system.
package alerts

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/whiteagle/yet-another-dude/internal/db"
)

// alertKey uniquely identifies an active alert (one per rule × device pair).
type alertKey struct {
	ruleID   string
	deviceID string
}

// Engine evaluates alert rules against incoming metrics.
// It fires an alert event only on the OK→FIRING transition and clears the
// state once the metric drops back below the threshold, so a single
// outstanding condition does not flood the event log every poll cycle.
type Engine struct {
	database *db.DB
	mu       sync.Mutex
	firing   map[alertKey]struct{} // currently-firing alerts
}

// NewEngine creates a new alert Engine.
func NewEngine(database *db.DB) *Engine {
	return &Engine{database: database, firing: make(map[alertKey]struct{})}
}

// EvaluateResult contains the outcome of evaluating metrics against alert rules.
type EvaluateResult struct {
	Triggered []db.AlertEvent
}

// Evaluate checks metrics against all applicable alert rules for a device.
func (e *Engine) Evaluate(ctx context.Context, deviceID, deviceName string, metrics map[string]float64) (*EvaluateResult, error) {
	rules, err := e.database.ListAlertRulesForDevice(ctx, deviceID)
	if err != nil {
		return nil, fmt.Errorf("list rules for device %s: %w", deviceID, err)
	}

	label := deviceName
	if label == "" {
		if len(deviceID) >= 8 {
			label = deviceID[:8]
		} else {
			label = deviceID
		}
	}

	result := &EvaluateResult{}

	e.mu.Lock()
	defer e.mu.Unlock()

	for _, rule := range rules {
		value, exists := metrics[rule.Metric]
		if !exists {
			continue
		}

		key := alertKey{ruleID: rule.ID, deviceID: deviceID}
		wasFiring := false
		if _, ok := e.firing[key]; ok {
			wasFiring = true
		}

		nowFiring := shouldTrigger(rule.Condition, value, rule.Threshold)

		if nowFiring && !wasFiring {
			// OK → FIRING transition: record event
			event := db.AlertEvent{
				RuleID:      rule.ID,
				DeviceID:    deviceID,
				Value:       value,
				Message:     formatAlertMessage(rule, label, value),
				TriggeredAt: time.Now(),
			}

			if err := e.database.InsertAlertEvent(ctx, event); err != nil {
				slog.Error("failed to insert alert event", "rule", rule.ID, "device", deviceID, "error", err)
				continue
			}

			e.firing[key] = struct{}{}
			result.Triggered = append(result.Triggered, event)
			slog.Warn("ALERT",
				"rule_id", rule.ID,
				"device_id", deviceID,
				"message", event.Message,
				"value", value,
			)
		} else if !nowFiring && wasFiring {
			// FIRING → OK transition: clear state (no event, just log)
			delete(e.firing, key)
			slog.Info("alert resolved",
				"rule", rule.ID,
				"device", deviceID,
				"metric", rule.Metric,
				"value", value,
			)
		}
	}

	return result, nil
}

// shouldTrigger checks if a metric value meets the alert condition.
func shouldTrigger(condition db.AlertCondition, value, threshold float64) bool {
	switch condition {
	case db.AlertConditionGT:
		return value > threshold
	case db.AlertConditionLT:
		return value < threshold
	case db.AlertConditionEQ:
		// Use a small epsilon for float comparison
		const epsilon = 0.0001
		diff := value - threshold
		if diff < 0 {
			diff = -diff
		}
		return diff < epsilon
	default:
		return false
	}
}

// formatAlertMessage creates a human-readable alert message.
func formatAlertMessage(rule db.AlertRule, deviceLabel string, value float64) string {
	condStr := ""
	switch rule.Condition {
	case db.AlertConditionGT:
		condStr = "exceeded"
	case db.AlertConditionLT:
		condStr = "dropped below"
	case db.AlertConditionEQ:
		condStr = "equals"
	}

	return fmt.Sprintf("Device %s: %s %s threshold %.2f (current: %.2f)",
		deviceLabel, rule.Metric, condStr, rule.Threshold, value)
}

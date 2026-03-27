package alerts

import (
	"testing"

	"github.com/whiteagle/yet-another-dude/internal/db"
)

func TestShouldTrigger(t *testing.T) {
	tests := []struct {
		name      string
		condition db.AlertCondition
		value     float64
		threshold float64
		want      bool
	}{
		{"gt: value above threshold", db.AlertConditionGT, 95.0, 90.0, true},
		{"gt: value below threshold", db.AlertConditionGT, 85.0, 90.0, false},
		{"gt: value equals threshold", db.AlertConditionGT, 90.0, 90.0, false},
		{"lt: value below threshold", db.AlertConditionLT, 5.0, 10.0, true},
		{"lt: value above threshold", db.AlertConditionLT, 15.0, 10.0, false},
		{"lt: value equals threshold", db.AlertConditionLT, 10.0, 10.0, false},
		{"eq: values equal", db.AlertConditionEQ, 50.0, 50.0, true},
		{"eq: values differ", db.AlertConditionEQ, 50.1, 50.0, false},
		{"eq: close to equal within epsilon", db.AlertConditionEQ, 50.00005, 50.0, true},
		{"unknown condition", "unknown", 50.0, 50.0, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := shouldTrigger(tt.condition, tt.value, tt.threshold)
			if got != tt.want {
				t.Errorf("shouldTrigger(%q, %v, %v) = %v, want %v",
					tt.condition, tt.value, tt.threshold, got, tt.want)
			}
		})
	}
}

func TestFormatAlertMessage(t *testing.T) {
	rule := db.AlertRule{
		ID:        "rule-1",
		Metric:    "cpu",
		Condition: db.AlertConditionGT,
		Threshold: 90.0,
	}

	msg := formatAlertMessage(rule, "device-1", 95.5)
	expected := "Device device-1: cpu exceeded threshold 90.00 (current: 95.50)"
	if msg != expected {
		t.Errorf("formatAlertMessage() = %q, want %q", msg, expected)
	}
}

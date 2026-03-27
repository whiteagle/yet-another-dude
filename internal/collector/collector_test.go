package collector

import (
	"testing"
	"time"
)

func TestNewCollectorDefaults(t *testing.T) {
	c := New(Config{})
	if c.cfg.PollInterval != 30*time.Second {
		t.Errorf("default PollInterval = %v, want 30s", c.cfg.PollInterval)
	}
}

func TestNewCollectorCustomInterval(t *testing.T) {
	c := New(Config{PollInterval: 60 * time.Second})
	if c.cfg.PollInterval != 60*time.Second {
		t.Errorf("PollInterval = %v, want 60s", c.cfg.PollInterval)
	}
}

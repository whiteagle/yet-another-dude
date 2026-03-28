// Package collector implements the main polling loop that periodically
// gathers metrics from all monitored devices.
package collector

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/whiteagle/yet-another-dude/internal/alerts"
	"github.com/whiteagle/yet-another-dude/internal/db"
	"github.com/whiteagle/yet-another-dude/internal/snmp"
)

// Config holds collector configuration.
type Config struct {
	DB           *db.DB
	Poller       *snmp.Poller
	AlertEngine  *alerts.Engine
	Notifier     alerts.Notifier
	PollInterval time.Duration
}

// Collector runs periodic SNMP polling for all devices.
type Collector struct {
	cfg Config
}

// New creates a new Collector.
func New(cfg Config) *Collector {
	if cfg.PollInterval <= 0 {
		cfg.PollInterval = 30 * time.Second
	}
	return &Collector{cfg: cfg}
}

// Run starts the polling loop. It blocks until the context is cancelled.
func (c *Collector) Run(ctx context.Context) {
	slog.Info("collector started", "interval", c.cfg.PollInterval)
	ticker := time.NewTicker(c.cfg.PollInterval)
	defer ticker.Stop()

	// Initial poll
	c.pollAll(ctx)

	for {
		select {
		case <-ctx.Done():
			slog.Info("collector stopped")
			return
		case <-ticker.C:
			c.pollAll(ctx)
		}
	}
}

// pollAll polls all devices concurrently.
func (c *Collector) pollAll(ctx context.Context) {
	devices, err := c.cfg.DB.ListDevices(ctx)
	if err != nil {
		slog.Error("failed to list devices for polling", "error", err)
		return
	}

	if len(devices) == 0 {
		return
	}

	slog.Debug("polling devices", "count", len(devices))

	var wg sync.WaitGroup
	for _, dev := range devices {
		wg.Add(1)
		go func(d db.Device) {
			defer wg.Done()
			c.pollDevice(ctx, d)
		}(dev)
	}
	wg.Wait()
}

// pollDevice polls a single device and stores the results.
func (c *Collector) pollDevice(ctx context.Context, dev db.Device) {
	version := snmp.SNMPVersion(dev.SNMPVersion)
	result := c.cfg.Poller.PollDevice(ctx, dev.ID, dev.IP, dev.SNMPCommunity, version)

	now := time.Now()

	if result.Error != nil {
		slog.Warn("poll failed", "device", dev.ID, "ip", dev.IP, "error", result.Error)
		if err := c.cfg.DB.UpdateDeviceStatus(ctx, dev.ID, db.DeviceStatusDown, now); err != nil {
			slog.Error("failed to update device status", "device", dev.ID, "error", err)
		}
		return
	}

	// Update device status to up
	if err := c.cfg.DB.UpdateDeviceStatus(ctx, dev.ID, db.DeviceStatusUp, now); err != nil {
		slog.Error("failed to update device status", "device", dev.ID, "error", err)
	}

	// Store metrics
	var metrics []db.Metric
	for name, value := range result.Metrics {
		metrics = append(metrics, db.Metric{
			DeviceID:  dev.ID,
			Name:      name,
			Value:     value,
			Timestamp: now,
		})
	}

	if len(metrics) > 0 {
		if err := c.cfg.DB.InsertMetrics(ctx, metrics); err != nil {
			slog.Error("failed to insert metrics", "device", dev.ID, "error", err)
		}
	}

	// Evaluate alerts
	if c.cfg.AlertEngine != nil {
		evalResult, err := c.cfg.AlertEngine.Evaluate(ctx, dev.ID, result.Metrics)
		if err != nil {
			slog.Error("alert evaluation failed", "device", dev.ID, "error", err)
			return
		}

		// Send notifications for triggered alerts
		if c.cfg.Notifier != nil && len(evalResult.Triggered) > 0 {
			rules, err := c.cfg.DB.ListAlertRulesForDevice(ctx, dev.ID)
			if err != nil {
				slog.Error("failed to load alert rules for notification", "device", dev.ID, "error", err)
				return
			}
			ruleMap := make(map[string]db.AlertRule)
			for _, r := range rules {
				ruleMap[r.ID] = r
			}

			for _, event := range evalResult.Triggered {
				if rule, ok := ruleMap[event.RuleID]; ok {
					if err := c.cfg.Notifier.Notify(ctx, event, rule); err != nil {
						slog.Error("notification failed", "rule", event.RuleID, "error", err)
					}
				}
			}
		}
	}
}

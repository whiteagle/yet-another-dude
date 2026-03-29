package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/whiteagle/yet-another-dude/internal/alerts"
	"github.com/whiteagle/yet-another-dude/internal/api"
	"github.com/whiteagle/yet-another-dude/internal/collector"
	"github.com/whiteagle/yet-another-dude/internal/db"
	"github.com/whiteagle/yet-another-dude/internal/discovery"
	"github.com/whiteagle/yet-another-dude/internal/frontend"
	"github.com/whiteagle/yet-another-dude/internal/snmp"
	syslogserver "github.com/whiteagle/yet-another-dude/internal/syslog"
)

// Version is set at build time via -ldflags.
var Version = "dev"

func main() {
	addr := flag.String("addr", ":8080", "HTTP listen address")
	dbPath := flag.String("db", "yad.db", "SQLite database path")
	apiKey := flag.String("api-key", os.Getenv("YAD_API_KEY"), "API key for authentication (optional)")
	flag.Parse()

	slog.Info("starting yad", "version", Version, "addr", *addr)

	database, err := db.New(*dbPath)
	if err != nil {
		slog.Error("failed to open database", "err", err)
		os.Exit(1)
	}
	defer database.Close()

	if err := database.Migrate(); err != nil {
		slog.Error("failed to run migrations", "err", err)
		os.Exit(1)
	}

	// Load persisted settings to drive runtime behaviour.
	settings, err := database.GetSettings(context.Background())
	if err != nil {
		slog.Warn("could not load settings, using defaults", "err", err)
	}

	// ── Notifiers ──────────────────────────────────────────────────────────────
	// DBEmailNotifier reads SMTP settings from the DB on each call so that
	// changes made via the Preferences dialog take effect without a restart.
	notifier := alerts.NewMultiNotifier(
		alerts.NewLogNotifier(slog.Default()),
		alerts.NewDBEmailNotifier(database),
		alerts.NewWebhookNotifier(),
	)

	// ── SNMP / Discovery ───────────────────────────────────────────────────────
	snmpClient := snmp.NewGoSNMPClient(5 * time.Second)
	poller := snmp.NewPoller(snmpClient)

	pinger := discovery.NewRealPinger()
	scanner := discovery.NewScanner(pinger, 50)

	// ── Alert engine ───────────────────────────────────────────────────────────
	alertEngine := alerts.NewEngine(database)

	// ── Frontend ───────────────────────────────────────────────────────────────
	frontendFS, err := frontend.FS()
	if err != nil {
		slog.Warn("frontend assets not available", "err", err)
	}

	// ── HTTP server ────────────────────────────────────────────────────────────
	srv := api.NewServer(api.ServerConfig{
		DB:         database,
		Scanner:    scanner,
		Poller:     poller,
		FrontendFS: frontendFS,
		APIKey:     *apiKey,
	})

	httpServer := &http.Server{
		Addr:         *addr,
		Handler:      srv.Router(),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// ── Background services ────────────────────────────────────────────────────
	// All background services share this context; cancelling it triggers a clean
	// shutdown of each goroutine.
	bgCtx, bgCancel := context.WithCancel(context.Background())
	defer bgCancel()

	// Metric collector + alert evaluator
	coll := collector.New(collector.Config{
		DB:               database,
		Poller:           poller,
		AlertEngine:      alertEngine,
		Notifier:         notifier,
		PollInterval:     time.Duration(settings.ProbeIntervalSec) * time.Second,
		MetricRetainDays: settings.ChartValueKeepDays,
	})
	go coll.Run(bgCtx)

	// Syslog UDP server (only when enabled in settings)
	var syslogSrv *syslogserver.Server
	if settings.SyslogEnabled && settings.SyslogPort > 0 {
		syslogSrv = syslogserver.New(settings.SyslogPort, func(msg syslogserver.Message) {
			if err := database.InsertSyslogMessage(bgCtx, db.SyslogMessage{
				ReceivedAt: msg.ReceivedAt,
				Facility:   msg.Facility,
				Severity:   msg.Severity,
				Hostname:   msg.Hostname,
				Tag:        msg.Tag,
				Message:    msg.Body,
				RawData:    msg.RawData,
				SourceIP:   msg.SourceIP,
			}); err != nil {
				slog.Error("failed to store syslog message", "error", err)
			}
		})
		if err := syslogSrv.Start(bgCtx); err != nil {
			slog.Warn("syslog server could not start", "err", err)
			syslogSrv = nil
		}
	} else {
		slog.Info("syslog server disabled (enable in Preferences → Syslog)")
	}

	// ── HTTP listener ─────────────────────────────────────────────────────────
	go func() {
		slog.Info("listening", "addr", *addr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	// ── Graceful shutdown ─────────────────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down...")
	bgCancel() // stop collector and syslog receiver goroutines

	if syslogSrv != nil {
		syslogSrv.Stop()
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpServer.Shutdown(ctx); err != nil {
		slog.Error("shutdown error", "err", err)
	}
	fmt.Println("bye")
}

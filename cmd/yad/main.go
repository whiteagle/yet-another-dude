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
	"github.com/whiteagle/yet-another-dude/internal/db"
	"github.com/whiteagle/yet-another-dude/internal/discovery"
	"github.com/whiteagle/yet-another-dude/internal/frontend"
	"github.com/whiteagle/yet-another-dude/internal/snmp"
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

	snmpClient := snmp.NewGoSNMPClient(5 * time.Second)
	poller := snmp.NewPoller(snmpClient)

	pinger := discovery.NewRealPinger()
	scanner := discovery.NewScanner(pinger, 50)

	alertEngine := alerts.NewEngine(database)
	notifier := alerts.NewLogNotifier(slog.Default())

	frontendFS, err := frontend.FS()
	if err != nil {
		slog.Warn("frontend assets not available", "err", err)
	}

	srv := api.NewServer(api.ServerConfig{
		DB:          database,
		Scanner:     scanner,
		Poller:      poller,
		AlertEngine: alertEngine,
		Notifier:    notifier,
		FrontendFS:  frontendFS,
		APIKey:      *apiKey,
	})

	httpServer := &http.Server{
		Addr:         *addr,
		Handler:      srv.Router(),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		slog.Info("listening", "addr", *addr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpServer.Shutdown(ctx); err != nil {
		slog.Error("shutdown error", "err", err)
	}
	fmt.Println("bye")
}

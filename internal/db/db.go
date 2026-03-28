// Package db provides SQLite database access for YAD.
package db

import (
	"database/sql"
	"fmt"
	"log/slog"

	_ "github.com/mattn/go-sqlite3"
)

// DB wraps the SQLite database connection.
type DB struct {
	conn *sql.DB
}

// New creates a new database connection.
func New(path string) (*DB, error) {
	conn, err := sql.Open("sqlite3", path+"?_journal_mode=WAL&_busy_timeout=5000&_foreign_keys=on")
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("ping database: %w", err)
	}

	conn.SetMaxOpenConns(1) // SQLite best practice
	slog.Info("database connected", "path", path)

	return &DB{conn: conn}, nil
}

// Close closes the database connection.
func (d *DB) Close() error {
	return d.conn.Close()
}

// Conn returns the underlying sql.DB for advanced queries.
func (d *DB) Conn() *sql.DB {
	return d.conn
}

// Migrate runs all database migrations.
func (d *DB) Migrate() error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS devices (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			ip TEXT NOT NULL UNIQUE,
			mac TEXT,
			type TEXT DEFAULT 'unknown',
			vendor TEXT,
			dns_name TEXT,
			snmp_community TEXT DEFAULT 'public',
			snmp_version INTEGER DEFAULT 2,
			username TEXT,
			status TEXT DEFAULT 'unknown',
			cpu_percent REAL,
			disk_percent REAL,
			uptime_seconds INTEGER,
			system_name TEXT,
			description TEXT,
			routeros_version TEXT,
			is_routeros BOOLEAN DEFAULT false,
			notes TEXT,
			last_seen DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS services (
			id TEXT PRIMARY KEY,
			device_id TEXT NOT NULL,
			probe TEXT NOT NULL,
			probe_type TEXT NOT NULL DEFAULT 'icmp',
			port INTEGER,
			enabled BOOLEAN DEFAULT true,
			status TEXT DEFAULT 'unknown',
			problem TEXT,
			probes_down INTEGER DEFAULT 0,
			time_last_up DATETIME,
			time_last_down DATETIME,
			time_up_total INTEGER DEFAULT 0,
			time_down_total INTEGER DEFAULT 0,
			notes TEXT,
			FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_services_device ON services(device_id)`,
		`CREATE TABLE IF NOT EXISTS links (
			id TEXT PRIMARY KEY,
			device_id TEXT NOT NULL,
			peer_device_id TEXT,
			interface_name TEXT,
			mastering_type TEXT DEFAULT 'simple',
			link_type TEXT DEFAULT 'unknown',
			speed_mbps INTEGER,
			rx_bps INTEGER,
			tx_bps INTEGER,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_links_device ON links(device_id)`,
		`CREATE TABLE IF NOT EXISTS outages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			device_id TEXT NOT NULL,
			service_id TEXT NOT NULL,
			service_probe TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'active',
			started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			resolved_at DATETIME,
			duration_seconds INTEGER,
			FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_outages_device ON outages(device_id, started_at)`,
		`CREATE TABLE IF NOT EXISTS metrics (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			device_id TEXT NOT NULL,
			name TEXT NOT NULL,
			value REAL NOT NULL,
			timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_metrics_device_time ON metrics(device_id, timestamp)`,
		`CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(device_id, name, timestamp)`,
		`CREATE TABLE IF NOT EXISTS topology_nodes (
			device_id TEXT PRIMARY KEY,
			x REAL NOT NULL,
			y REAL NOT NULL,
			FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS alert_rules (
			id TEXT PRIMARY KEY,
			device_id TEXT,
			metric TEXT NOT NULL,
			condition TEXT NOT NULL,
			threshold REAL NOT NULL,
			enabled BOOLEAN DEFAULT true,
			notify_email TEXT,
			notify_webhook TEXT,
			FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS alert_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			rule_id TEXT NOT NULL,
			device_id TEXT NOT NULL,
			value REAL NOT NULL,
			message TEXT,
			triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_alert_history_rule ON alert_history(rule_id, triggered_at)`,
		`CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS syslog_messages (
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			received_at DATETIME NOT NULL,
			facility   INTEGER NOT NULL DEFAULT 0,
			severity   INTEGER NOT NULL DEFAULT 6,
			hostname   TEXT,
			tag        TEXT,
			message    TEXT,
			raw_data   TEXT,
			source_ip  TEXT
		)`,
		`CREATE INDEX IF NOT EXISTS idx_syslog_time ON syslog_messages(received_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_syslog_hostname ON syslog_messages(hostname, received_at DESC)`,
	}

	for i, m := range migrations {
		if _, err := d.conn.Exec(m); err != nil {
			return fmt.Errorf("migration %d: %w", i, err)
		}
	}

	slog.Info("database migrations complete")
	return nil
}

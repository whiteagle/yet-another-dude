package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// ── Devices ──────────────────────────────────────────────────────────────────

func (d *DB) CreateDevice(ctx context.Context, dev Device) error {
	_, err := d.conn.ExecContext(ctx,
		`INSERT INTO devices (id, name, ip, mac, type, vendor, dns_name, snmp_community, snmp_version,
		 username, status, cpu_percent, disk_percent, uptime_seconds, system_name, description,
		 routeros_version, is_routeros, notes, last_seen)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		dev.ID, dev.Name, dev.IP, dev.MAC, dev.Type, dev.Vendor, dev.DNSName,
		dev.SNMPCommunity, dev.SNMPVersion, dev.Username, dev.Status,
		dev.CPUPercent, dev.DiskPercent, dev.UptimeSeconds,
		dev.SystemName, dev.Description, dev.RouterOSVersion, dev.IsRouterOS,
		dev.Notes, dev.LastSeen,
	)
	if err != nil {
		return fmt.Errorf("create device: %w", err)
	}
	return nil
}

func (d *DB) GetDevice(ctx context.Context, id string) (*Device, error) {
	dev := &Device{}
	err := d.conn.QueryRowContext(ctx,
		`SELECT id, name, ip, mac, type, vendor, dns_name, snmp_community, snmp_version,
		 username, status, cpu_percent, disk_percent, uptime_seconds, system_name, description,
		 routeros_version, is_routeros, notes, last_seen, created_at
		 FROM devices WHERE id = ?`, id,
	).Scan(&dev.ID, &dev.Name, &dev.IP, &dev.MAC, &dev.Type, &dev.Vendor, &dev.DNSName,
		&dev.SNMPCommunity, &dev.SNMPVersion, &dev.Username, &dev.Status,
		&dev.CPUPercent, &dev.DiskPercent, &dev.UptimeSeconds,
		&dev.SystemName, &dev.Description, &dev.RouterOSVersion, &dev.IsRouterOS,
		&dev.Notes, &dev.LastSeen, &dev.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get device: %w", err)
	}
	dev.ParentIDs = []string{}
	return dev, nil
}

func (d *DB) ListDevices(ctx context.Context) ([]Device, error) {
	rows, err := d.conn.QueryContext(ctx,
		`SELECT id, name, ip, mac, type, vendor, dns_name, snmp_community, snmp_version,
		 username, status, cpu_percent, disk_percent, uptime_seconds, system_name, description,
		 routeros_version, is_routeros, notes, last_seen, created_at
		 FROM devices ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("list devices: %w", err)
	}
	defer rows.Close()

	var devices []Device
	for rows.Next() {
		var dev Device
		if err := rows.Scan(&dev.ID, &dev.Name, &dev.IP, &dev.MAC, &dev.Type, &dev.Vendor, &dev.DNSName,
			&dev.SNMPCommunity, &dev.SNMPVersion, &dev.Username, &dev.Status,
			&dev.CPUPercent, &dev.DiskPercent, &dev.UptimeSeconds,
			&dev.SystemName, &dev.Description, &dev.RouterOSVersion, &dev.IsRouterOS,
			&dev.Notes, &dev.LastSeen, &dev.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan device: %w", err)
		}
		dev.ParentIDs = []string{}
		devices = append(devices, dev)
	}
	return devices, rows.Err()
}

func (d *DB) UpdateDevice(ctx context.Context, dev Device) error {
	result, err := d.conn.ExecContext(ctx,
		`UPDATE devices SET name=?, ip=?, mac=?, type=?, vendor=?, dns_name=?, snmp_community=?,
		 snmp_version=?, username=?, status=?, cpu_percent=?, disk_percent=?, uptime_seconds=?,
		 system_name=?, description=?, routeros_version=?, is_routeros=?, notes=?, last_seen=?
		 WHERE id=?`,
		dev.Name, dev.IP, dev.MAC, dev.Type, dev.Vendor, dev.DNSName,
		dev.SNMPCommunity, dev.SNMPVersion, dev.Username, dev.Status,
		dev.CPUPercent, dev.DiskPercent, dev.UptimeSeconds,
		dev.SystemName, dev.Description, dev.RouterOSVersion, dev.IsRouterOS,
		dev.Notes, dev.LastSeen, dev.ID,
	)
	if err != nil {
		return fmt.Errorf("update device: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("device not found: %s", dev.ID)
	}
	return nil
}

func (d *DB) DeleteDevice(ctx context.Context, id string) error {
	result, err := d.conn.ExecContext(ctx, `DELETE FROM devices WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete device: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("device not found: %s", id)
	}
	return nil
}

func (d *DB) UpdateDeviceStatus(ctx context.Context, id string, status DeviceStatus, lastSeen time.Time) error {
	_, err := d.conn.ExecContext(ctx,
		`UPDATE devices SET status=?, last_seen=? WHERE id=?`,
		status, lastSeen, id,
	)
	if err != nil {
		return fmt.Errorf("update device status: %w", err)
	}
	return nil
}

// ── Services ─────────────────────────────────────────────────────────────────

func (d *DB) CreateService(ctx context.Context, s Service) error {
	_, err := d.conn.ExecContext(ctx,
		`INSERT INTO services (id, device_id, probe, probe_type, port, enabled, status, notes)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		s.ID, s.DeviceID, s.Probe, s.ProbeType, s.Port, s.Enabled, s.Status, s.Notes,
	)
	if err != nil {
		return fmt.Errorf("create service: %w", err)
	}
	return nil
}

func (d *DB) ListServicesByDevice(ctx context.Context, deviceID string) ([]Service, error) {
	rows, err := d.conn.QueryContext(ctx,
		`SELECT id, device_id, probe, probe_type, port, enabled, status, problem,
		 probes_down, time_last_up, time_last_down, time_up_total, time_down_total, notes
		 FROM services WHERE device_id = ? ORDER BY probe`, deviceID)
	if err != nil {
		return nil, fmt.Errorf("list services: %w", err)
	}
	defer rows.Close()
	return scanServices(rows)
}

func (d *DB) ListAllServices(ctx context.Context) ([]Service, error) {
	rows, err := d.conn.QueryContext(ctx,
		`SELECT id, device_id, probe, probe_type, port, enabled, status, problem,
		 probes_down, time_last_up, time_last_down, time_up_total, time_down_total, notes
		 FROM services ORDER BY device_id, probe`)
	if err != nil {
		return nil, fmt.Errorf("list all services: %w", err)
	}
	defer rows.Close()
	return scanServices(rows)
}

func scanServices(rows *sql.Rows) ([]Service, error) {
	var services []Service
	for rows.Next() {
		var s Service
		if err := rows.Scan(&s.ID, &s.DeviceID, &s.Probe, &s.ProbeType, &s.Port, &s.Enabled,
			&s.Status, &s.Problem, &s.ProbesDown, &s.TimeLastUp, &s.TimeLastDown,
			&s.TimeUpTotal, &s.TimeDownTotal, &s.Notes); err != nil {
			return nil, fmt.Errorf("scan service: %w", err)
		}
		services = append(services, s)
	}
	return services, rows.Err()
}

func (d *DB) UpdateServiceStatus(ctx context.Context, id string, status ServiceStatus, problem string) error {
	now := time.Now()
	_, err := d.conn.ExecContext(ctx,
		`UPDATE services SET status=?, problem=?,
		 time_last_up = CASE WHEN ? = 'ok' THEN ? ELSE time_last_up END,
		 time_last_down = CASE WHEN ? != 'ok' THEN ? ELSE time_last_down END,
		 probes_down = CASE WHEN ? != 'ok' THEN probes_down + 1 ELSE 0 END
		 WHERE id=?`,
		status, problem,
		status, now,
		status, now,
		status,
		id,
	)
	return err
}

func (d *DB) DeleteService(ctx context.Context, id string) error {
	_, err := d.conn.ExecContext(ctx, `DELETE FROM services WHERE id = ?`, id)
	return err
}

// ── Links ─────────────────────────────────────────────────────────────────────

func (d *DB) CreateLink(ctx context.Context, l Link) error {
	_, err := d.conn.ExecContext(ctx,
		`INSERT INTO links (id, device_id, peer_device_id, interface_name, mastering_type, link_type, speed_mbps)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		l.ID, l.DeviceID, l.PeerDeviceID, l.InterfaceName, l.MasteringType, l.LinkType, l.SpeedMbps,
	)
	if err != nil {
		return fmt.Errorf("create link: %w", err)
	}
	return nil
}

func (d *DB) ListLinks(ctx context.Context) ([]Link, error) {
	rows, err := d.conn.QueryContext(ctx,
		`SELECT id, device_id, peer_device_id, interface_name, mastering_type, link_type,
		 speed_mbps, rx_bps, tx_bps, created_at FROM links ORDER BY device_id`)
	if err != nil {
		return nil, fmt.Errorf("list links: %w", err)
	}
	defer rows.Close()

	var links []Link
	for rows.Next() {
		var l Link
		if err := rows.Scan(&l.ID, &l.DeviceID, &l.PeerDeviceID, &l.InterfaceName,
			&l.MasteringType, &l.LinkType, &l.SpeedMbps, &l.RxBps, &l.TxBps, &l.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan link: %w", err)
		}
		links = append(links, l)
	}
	return links, rows.Err()
}

func (d *DB) UpdateLinkTraffic(ctx context.Context, id string, rxBps, txBps int64) error {
	_, err := d.conn.ExecContext(ctx,
		`UPDATE links SET rx_bps=?, tx_bps=? WHERE id=?`, rxBps, txBps, id)
	return err
}

func (d *DB) DeleteLink(ctx context.Context, id string) error {
	_, err := d.conn.ExecContext(ctx, `DELETE FROM links WHERE id = ?`, id)
	return err
}

// ── Outages ───────────────────────────────────────────────────────────────────

func (d *DB) CreateOutage(ctx context.Context, o Outage) error {
	_, err := d.conn.ExecContext(ctx,
		`INSERT INTO outages (device_id, service_id, service_probe, status, started_at)
		 VALUES (?, ?, ?, 'active', ?)`,
		o.DeviceID, o.ServiceID, o.ServiceProbe, o.StartedAt,
	)
	return err
}

func (d *DB) ResolveOutage(ctx context.Context, deviceID, serviceID string) error {
	now := time.Now()
	_, err := d.conn.ExecContext(ctx,
		`UPDATE outages SET status='resolved', resolved_at=?,
		 duration_seconds = CAST((julianday(?) - julianday(started_at)) * 86400 AS INTEGER)
		 WHERE device_id=? AND service_id=? AND status='active'`,
		now, now, deviceID, serviceID,
	)
	return err
}

func (d *DB) ListOutages(ctx context.Context, limit int) ([]Outage, error) {
	if limit <= 0 {
		limit = 200
	}
	rows, err := d.conn.QueryContext(ctx,
		`SELECT id, device_id, service_id, service_probe, status, started_at, resolved_at, duration_seconds
		 FROM outages ORDER BY started_at DESC LIMIT ?`, limit)
	if err != nil {
		return nil, fmt.Errorf("list outages: %w", err)
	}
	defer rows.Close()

	var outages []Outage
	for rows.Next() {
		var o Outage
		if err := rows.Scan(&o.ID, &o.DeviceID, &o.ServiceID, &o.ServiceProbe, &o.Status,
			&o.StartedAt, &o.ResolvedAt, &o.DurationSeconds); err != nil {
			return nil, fmt.Errorf("scan outage: %w", err)
		}
		outages = append(outages, o)
	}
	return outages, rows.Err()
}

// ── Metrics ───────────────────────────────────────────────────────────────────

func (d *DB) InsertMetric(ctx context.Context, m Metric) error {
	_, err := d.conn.ExecContext(ctx,
		`INSERT INTO metrics (device_id, name, value, timestamp) VALUES (?, ?, ?, ?)`,
		m.DeviceID, m.Name, m.Value, m.Timestamp,
	)
	if err != nil {
		return fmt.Errorf("insert metric: %w", err)
	}
	return nil
}

func (d *DB) InsertMetrics(ctx context.Context, metrics []Metric) error {
	tx, err := d.conn.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx,
		`INSERT INTO metrics (device_id, name, value, timestamp) VALUES (?, ?, ?, ?)`)
	if err != nil {
		return fmt.Errorf("prepare: %w", err)
	}
	defer stmt.Close()

	for _, m := range metrics {
		if _, err := stmt.ExecContext(ctx, m.DeviceID, m.Name, m.Value, m.Timestamp); err != nil {
			return fmt.Errorf("insert metric %s/%s: %w", m.DeviceID, m.Name, err)
		}
	}
	return tx.Commit()
}

func (d *DB) QueryMetrics(ctx context.Context, deviceID string, metricName string, from, to time.Time) ([]Metric, error) {
	query := `SELECT id, device_id, name, value, timestamp FROM metrics
		WHERE device_id = ? AND timestamp BETWEEN ? AND ?`
	args := []interface{}{deviceID, from, to}

	if metricName != "" {
		query += ` AND name = ?`
		args = append(args, metricName)
	}
	query += ` ORDER BY timestamp`

	rows, err := d.conn.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query metrics: %w", err)
	}
	defer rows.Close()

	var metrics []Metric
	for rows.Next() {
		var m Metric
		if err := rows.Scan(&m.ID, &m.DeviceID, &m.Name, &m.Value, &m.Timestamp); err != nil {
			return nil, fmt.Errorf("scan metric: %w", err)
		}
		metrics = append(metrics, m)
	}
	return metrics, rows.Err()
}

func (d *DB) PruneMetrics(ctx context.Context, olderThan time.Time) (int64, error) {
	result, err := d.conn.ExecContext(ctx,
		`DELETE FROM metrics WHERE timestamp < ?`, olderThan)
	if err != nil {
		return 0, fmt.Errorf("prune metrics: %w", err)
	}
	return result.RowsAffected()
}

// ── Topology ──────────────────────────────────────────────────────────────────

func (d *DB) GetTopologyNodes(ctx context.Context) ([]TopologyNode, error) {
	rows, err := d.conn.QueryContext(ctx, `SELECT device_id, x, y FROM topology_nodes`)
	if err != nil {
		return nil, fmt.Errorf("get topology: %w", err)
	}
	defer rows.Close()

	var nodes []TopologyNode
	for rows.Next() {
		var n TopologyNode
		if err := rows.Scan(&n.DeviceID, &n.X, &n.Y); err != nil {
			return nil, fmt.Errorf("scan topology node: %w", err)
		}
		nodes = append(nodes, n)
	}
	return nodes, rows.Err()
}

func (d *DB) SaveTopologyNodes(ctx context.Context, nodes []TopologyNode) error {
	tx, err := d.conn.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx,
		`INSERT INTO topology_nodes (device_id, x, y) VALUES (?, ?, ?)
		 ON CONFLICT(device_id) DO UPDATE SET x=excluded.x, y=excluded.y`)
	if err != nil {
		return fmt.Errorf("prepare: %w", err)
	}
	defer stmt.Close()

	for _, n := range nodes {
		if _, err := stmt.ExecContext(ctx, n.DeviceID, n.X, n.Y); err != nil {
			return fmt.Errorf("upsert node %s: %w", n.DeviceID, err)
		}
	}
	return tx.Commit()
}

// ── Alerts ────────────────────────────────────────────────────────────────────

func (d *DB) CreateAlertRule(ctx context.Context, rule AlertRule) error {
	_, err := d.conn.ExecContext(ctx,
		`INSERT INTO alert_rules (id, device_id, metric, condition, threshold, enabled, notify_email, notify_webhook)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		rule.ID, rule.DeviceID, rule.Metric, rule.Condition, rule.Threshold,
		rule.Enabled, rule.NotifyEmail, rule.NotifyWebhook,
	)
	if err != nil {
		return fmt.Errorf("create alert rule: %w", err)
	}
	return nil
}

func (d *DB) ListAlertRules(ctx context.Context) ([]AlertRule, error) {
	rows, err := d.conn.QueryContext(ctx,
		`SELECT id, device_id, metric, condition, threshold, enabled, notify_email, notify_webhook
		 FROM alert_rules ORDER BY metric`)
	if err != nil {
		return nil, fmt.Errorf("list alert rules: %w", err)
	}
	defer rows.Close()

	var rules []AlertRule
	for rows.Next() {
		var r AlertRule
		if err := rows.Scan(&r.ID, &r.DeviceID, &r.Metric, &r.Condition, &r.Threshold,
			&r.Enabled, &r.NotifyEmail, &r.NotifyWebhook); err != nil {
			return nil, fmt.Errorf("scan alert rule: %w", err)
		}
		rules = append(rules, r)
	}
	return rules, rows.Err()
}

func (d *DB) ListAlertRulesForDevice(ctx context.Context, deviceID string) ([]AlertRule, error) {
	rows, err := d.conn.QueryContext(ctx,
		`SELECT id, device_id, metric, condition, threshold, enabled, notify_email, notify_webhook
		 FROM alert_rules WHERE enabled = true AND (device_id IS NULL OR device_id = ?)`, deviceID)
	if err != nil {
		return nil, fmt.Errorf("list alert rules for device: %w", err)
	}
	defer rows.Close()

	var rules []AlertRule
	for rows.Next() {
		var r AlertRule
		if err := rows.Scan(&r.ID, &r.DeviceID, &r.Metric, &r.Condition, &r.Threshold,
			&r.Enabled, &r.NotifyEmail, &r.NotifyWebhook); err != nil {
			return nil, fmt.Errorf("scan alert rule: %w", err)
		}
		rules = append(rules, r)
	}
	return rules, rows.Err()
}

func (d *DB) InsertAlertEvent(ctx context.Context, event AlertEvent) error {
	_, err := d.conn.ExecContext(ctx,
		`INSERT INTO alert_history (rule_id, device_id, value, message, triggered_at)
		 VALUES (?, ?, ?, ?, ?)`,
		event.RuleID, event.DeviceID, event.Value, event.Message, event.TriggeredAt,
	)
	if err != nil {
		return fmt.Errorf("insert alert event: %w", err)
	}
	return nil
}

func (d *DB) ListAlertHistory(ctx context.Context, limit int) ([]AlertEvent, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := d.conn.QueryContext(ctx,
		`SELECT id, rule_id, device_id, value, message, triggered_at
		 FROM alert_history ORDER BY triggered_at DESC LIMIT ?`, limit)
	if err != nil {
		return nil, fmt.Errorf("list alert history: %w", err)
	}
	defer rows.Close()

	var events []AlertEvent
	for rows.Next() {
		var e AlertEvent
		if err := rows.Scan(&e.ID, &e.RuleID, &e.DeviceID, &e.Value, &e.Message, &e.TriggeredAt); err != nil {
			return nil, fmt.Errorf("scan alert event: %w", err)
		}
		events = append(events, e)
	}
	return events, rows.Err()
}

// ── Settings ──────────────────────────────────────────────────────────────────

const settingsKey = "server_settings"

// GetSettings loads server settings from the DB; returns defaults if not yet saved.
func (d *DB) GetSettings(ctx context.Context) (ServerSettings, error) {
	var raw string
	err := d.conn.QueryRowContext(ctx,
		`SELECT value FROM settings WHERE key = ?`, settingsKey,
	).Scan(&raw)
	if err == sql.ErrNoRows {
		return DefaultSettings(), nil
	}
	if err != nil {
		return DefaultSettings(), fmt.Errorf("get settings: %w", err)
	}
	var s ServerSettings
	if err := json.Unmarshal([]byte(raw), &s); err != nil {
		return DefaultSettings(), fmt.Errorf("unmarshal settings: %w", err)
	}
	return s, nil
}

// SaveSettings persists server settings to the DB.
func (d *DB) SaveSettings(ctx context.Context, s ServerSettings) error {
	data, err := json.Marshal(s)
	if err != nil {
		return fmt.Errorf("marshal settings: %w", err)
	}
	_, err = d.conn.ExecContext(ctx,
		`INSERT INTO settings (key, value) VALUES (?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		settingsKey, string(data),
	)
	if err != nil {
		return fmt.Errorf("save settings: %w", err)
	}
	return nil
}

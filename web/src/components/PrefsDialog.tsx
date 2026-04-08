import { useState, useEffect } from 'react'
import { getSettings, saveSettings } from '../api/client'
import type { ServerSettings } from '../types/api'

const DEFAULTS: ServerSettings = {
  undo_queue_size: 32,
  db_commit_interval_sec: 30,
  mac_mapping_refresh_sec: 300,
  ask_confirm_remove: true,
  resolve_mac_manufacturer: true,
  contents_pane_behavior: 'single_click',
  primary_dns: '8.8.8.8',
  secondary_dns: '8.8.4.4',
  snmp_default_port: 161,
  snmp_timeout_sec: 3,
  probe_interval_sec: 30,
  probe_timeout_sec: 10,
  probe_down_count: 5,
  notify_popup: true,
  notify_beep: false,
  notify_email: false,
  notify_program: false,
  server_port: 8080,
  server_secure_port: 8443,
  server_allowed_networks: '',
  web_enabled: true,
  web_port: 8080,
  web_secure_port: 8443,
  web_allowed_networks: '',
  web_session_timeout: 3600,
  web_refresh_interval: 60,
  syslog_enabled: false,
  syslog_port: 514,
  syslog_log_file: 'syslog',
  syslog_start_new_file: 'never',
  syslog_logs_to_keep: 10,
  syslog_buffered_entries: 100,
  primary_smtp: '',
  secondary_smtp: '',
  smtp_from: '',
  smtp_username: '',
  smtp_password: '',
  map_antialiased: true,
  map_gradients: true,
  chart_value_keep_days: 90,
  report_font_family: 'DejaVu Sans',
  report_font_size: 10,
  discover_item_width: 90,
  discover_item_height: 60,
  discover_group_size: 10,
  routeros_timeout_sec: 5,
  routeros_interval_sec: 60,
}

const TABS = [
  'Misc', 'General', 'SNMP', 'Service Polling', 'Server',
  'Web Access', 'Syslog', 'SMTP', 'Map Settings', 'Chart Settings',
  'Report/PDF', 'Discover', 'RouterOS',
]

interface FieldProps {
  label: string
  children: React.ReactNode
}
function Row({ label, children }: FieldProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5, gap: 6 }}>
      <label style={{ width: 180, fontSize: 12, textAlign: 'right', flexShrink: 0, color: 'var(--text-secondary)' }}>
        {label}:
      </label>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

function XPInput({ value, onChange, type = 'text', width, placeholder }: {
  value: string | number
  onChange: (v: string) => void
  type?: string
  width?: number
  placeholder?: string
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        border: '1px solid var(--chrome-input-border)', padding: '1px 4px', fontSize: 12,
        background: 'var(--bg-base)', color: 'var(--text-primary)', width: width ?? 180,
        fontFamily: 'Tahoma, Arial, sans-serif',
      }}
    />
  )
}

function XPNumber({ value, onChange, min, max }: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(parseInt(e.target.value) || 0)}
      style={{
        border: '1px solid var(--chrome-input-border)', padding: '1px 4px', fontSize: 12,
        background: 'var(--bg-base)', color: 'var(--text-primary)', width: 80,
        fontFamily: 'Tahoma, Arial, sans-serif',
      }}
    />
  )
}

function XPCheck({ checked, onChange, label }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function XPSelect({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        border: '1px solid var(--chrome-input-border)', padding: '1px 2px', fontSize: 12,
        background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Tahoma, Arial, sans-serif',
      }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 'bold', color: 'var(--accent)', borderBottom: '1px solid var(--border)',
      marginBottom: 8, marginTop: 12, paddingBottom: 2,
    }}>
      {children}
    </div>
  )
}

export default function PrefsDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState(0)
  const [s, setS] = useState<ServerSettings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getSettings()
      .then(setS)
      .catch(() => {
        setLoadFailed(true)
        setS(DEFAULTS)
      })
      .finally(() => setLoading(false))
  }, [])

  const set = <K extends keyof ServerSettings>(key: K, value: ServerSettings[K]) => {
    setS((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleOK = async () => {
    setSaving(true)
    setError('')
    try {
      await saveSettings(s)
      setSaved(true)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleApply = async () => {
    setSaving(true)
    setError('')
    try {
      await saveSettings(s)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.3)',
    }}>
      <div style={{
        background: 'var(--chrome-panel)', border: '1px solid var(--chrome-border)',
        boxShadow: '2px 2px 10px rgba(0,0,0,0.4)',
        width: 620, maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        fontFamily: 'Tahoma, Arial, sans-serif', color: 'var(--text-primary)',
      }}>
        {/* Title bar */}
        <div style={{
          background: 'linear-gradient(to right, var(--titlebar-from), var(--titlebar-to))',
          padding: '3px 8px', display: 'flex', alignItems: 'center',
        }}>
          <span style={{ color: '#fff', fontSize: 11, fontWeight: 'bold', flex: 1 }}>Preferences</span>
          <button
            onClick={onClose}
            style={{
              background: 'var(--chrome-bg)', border: '1px solid var(--chrome-border)', fontSize: 10,
              padding: '0 4px', cursor: 'pointer', lineHeight: '14px', color: 'var(--text-primary)',
            }}
          >✕</button>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid var(--chrome-border)',
          background: 'var(--chrome-bg)', paddingTop: 3, paddingLeft: 4, gap: '1px',
        }}>
          {TABS.map((t, i) => (
            <div
              key={t}
              onClick={() => setTab(i)}
              style={{
                padding: '2px 10px', fontSize: 11, cursor: 'pointer',
                background: tab === i ? 'var(--chrome-panel)' : 'var(--chrome-tab-inactive)',
                border: '1px solid var(--chrome-border)',
                borderBottom: tab === i ? '1px solid var(--chrome-panel)' : '1px solid var(--chrome-border)',
                marginBottom: tab === i ? -1 : 0,
                fontWeight: tab === i ? 'bold' : 'normal',
                zIndex: tab === i ? 1 : 0, position: 'relative',
                color: 'var(--text-primary)',
              }}
            >
              {t}
            </div>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ height: 320, overflowY: 'auto', padding: '12px 16px' }}>
          {loading ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 16 }}>Loading…</div>
          ) : (
            <>
              {tab === 0 && <TabMisc s={s} set={set} />}
              {tab === 1 && <TabGeneral s={s} set={set} />}
              {tab === 2 && <TabSNMP s={s} set={set} />}
              {tab === 3 && <TabServicePolling s={s} set={set} />}
              {tab === 4 && <TabServer s={s} set={set} />}
              {tab === 5 && <TabWebAccess s={s} set={set} />}
              {tab === 6 && <TabSyslog s={s} set={set} />}
              {tab === 7 && <TabSMTP s={s} set={set} />}
              {tab === 8 && <TabMapSettings s={s} set={set} />}
              {tab === 9 && <TabChartSettings s={s} set={set} />}
              {tab === 10 && <TabReportPDF s={s} set={set} />}
              {tab === 11 && <TabDiscover s={s} set={set} />}
              {tab === 12 && <TabRouterOS s={s} set={set} />}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid var(--chrome-border)', padding: '6px 12px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--chrome-bg)',
        }}>
          <span style={{ fontSize: 11, color: (error || loadFailed) ? 'var(--status-down)' : 'var(--status-up)' }}>
            {error || (loadFailed ? 'Could not load settings — showing defaults.' : (saved ? 'Settings saved.' : ''))}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <WinBtn onClick={handleOK} disabled={saving}>OK</WinBtn>
            <WinBtn onClick={handleApply} disabled={saving}>Apply</WinBtn>
            <WinBtn onClick={onClose}>Cancel</WinBtn>
          </div>
        </div>
      </div>
    </div>
  )
}

type SetFn = <K extends keyof ServerSettings>(key: K, value: ServerSettings[K]) => void

function TabMisc({ s, set }: { s: ServerSettings; set: SetFn }) {
  return (
    <div>
      <SectionTitle>Application</SectionTitle>
      <Row label="Undo queue size">
        <XPNumber value={s.undo_queue_size} onChange={(v) => set('undo_queue_size', v)} min={1} max={256} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>actions</span>
      </Row>
      <Row label="Database commit interval">
        <XPNumber value={s.db_commit_interval_sec} onChange={(v) => set('db_commit_interval_sec', v)} min={5} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>seconds</span>
      </Row>
      <Row label="Mac mapping refresh interval">
        <XPNumber value={s.mac_mapping_refresh_sec} onChange={(v) => set('mac_mapping_refresh_sec', v)} min={30} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>seconds</span>
      </Row>

      <SectionTitle>Behaviour</SectionTitle>
      <Row label="Contents pane behavior">
        <XPSelect
          value={s.contents_pane_behavior}
          onChange={(v) => set('contents_pane_behavior', v)}
          options={[
            { value: 'single_click', label: 'Single click open' },
            { value: 'double_click', label: 'Double click open' },
            { value: 'double_click_top', label: 'Double click insert top' },
          ]}
        />
      </Row>
      <Row label="">
        <XPCheck
          checked={s.ask_confirm_remove}
          onChange={(v) => set('ask_confirm_remove', v)}
          label="Ask confirmation when removing"
        />
      </Row>
      <Row label="">
        <XPCheck
          checked={s.resolve_mac_manufacturer}
          onChange={(v) => set('resolve_mac_manufacturer', v)}
          label="Resolve MAC address manufacturer"
        />
      </Row>
    </div>
  )
}

function TabGeneral({ s, set }: { s: ServerSettings; set: SetFn }) {
  return (
    <div>
      <SectionTitle>DNS Servers</SectionTitle>
      <Row label="Primary DNS server">
        <XPInput value={s.primary_dns} onChange={(v) => set('primary_dns', v)} />
      </Row>
      <Row label="Secondary DNS server">
        <XPInput value={s.secondary_dns} onChange={(v) => set('secondary_dns', v)} />
      </Row>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, marginLeft: 186 }}>
        Used for domain name resolving during discovery and service checks.
      </div>
    </div>
  )
}

function TabSNMP({ s, set }: { s: ServerSettings; set: SetFn }) {
  return (
    <div>
      <SectionTitle>SNMP Defaults</SectionTitle>
      <Row label="Default SNMP access port">
        <XPNumber value={s.snmp_default_port} onChange={(v) => set('snmp_default_port', v)} min={1} max={65535} />
      </Row>
      <Row label="Connection timeout">
        <XPNumber value={s.snmp_timeout_sec} onChange={(v) => set('snmp_timeout_sec', v)} min={1} max={30} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>seconds</span>
      </Row>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, marginLeft: 186 }}>
        SNMP v1, v2c, and v3 profiles are configured per-device in the Devices panel.
      </div>
    </div>
  )
}

function TabServicePolling({ s, set }: { s: ServerSettings; set: SetFn }) {
  return (
    <div>
      <SectionTitle>Polling Intervals</SectionTitle>
      <Row label="Probe interval">
        <XPNumber value={s.probe_interval_sec} onChange={(v) => set('probe_interval_sec', v)} min={5} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>seconds (default: 30)</span>
      </Row>
      <Row label="Probe timeout">
        <XPNumber value={s.probe_timeout_sec} onChange={(v) => set('probe_timeout_sec', v)} min={1} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>seconds (default: 10)</span>
      </Row>
      <Row label="Probe down count">
        <XPNumber value={s.probe_down_count} onChange={(v) => set('probe_down_count', v)} min={1} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>failures before marking down (default: 5)</span>
      </Row>

      <SectionTitle>Notifications</SectionTitle>
      <div style={{ marginLeft: 186 }}>
        <XPCheck checked={s.notify_popup} onChange={(v) => set('notify_popup', v)} label="Show popup window" />
        <div style={{ height: 3 }} />
        <XPCheck checked={s.notify_beep} onChange={(v) => set('notify_beep', v)} label="Beep sound" />
        <div style={{ height: 3 }} />
        <XPCheck checked={s.notify_email} onChange={(v) => set('notify_email', v)} label="Send email (requires SMTP settings)" />
        <div style={{ height: 3 }} />
        <XPCheck checked={s.notify_program} onChange={(v) => set('notify_program', v)} label="Execute program" />
      </div>
    </div>
  )
}

function TabServer({ s, set }: { s: ServerSettings; set: SetFn }) {
  return (
    <div>
      <SectionTitle>Remote Access</SectionTitle>
      <Row label="Port">
        <XPNumber value={s.server_port} onChange={(v) => set('server_port', v)} min={1} max={65535} />
      </Row>
      <Row label="Secure port">
        <XPNumber value={s.server_secure_port} onChange={(v) => set('server_secure_port', v)} min={1} max={65535} />
      </Row>
      <Row label="Allowed networks">
        <XPInput value={s.server_allowed_networks} onChange={(v) => set('server_allowed_networks', v)} width={240} />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          Comma-separated CIDRs, e.g. 192.168.0.0/24, 10.0.0.0/8. Leave empty to allow all.
        </div>
      </Row>
    </div>
  )
}

function TabWebAccess({ s, set }: { s: ServerSettings; set: SetFn }) {
  return (
    <div>
      <SectionTitle>Web Interface</SectionTitle>
      <Row label="">
        <XPCheck checked={s.web_enabled} onChange={(v) => set('web_enabled', v)} label="Enable web access" />
      </Row>
      <Row label="HTTP port">
        <XPNumber value={s.web_port} onChange={(v) => set('web_port', v)} min={1} max={65535} />
      </Row>
      <Row label="HTTPS port">
        <XPNumber value={s.web_secure_port} onChange={(v) => set('web_secure_port', v)} min={1} max={65535} />
      </Row>
      <Row label="Allowed networks">
        <XPInput value={s.web_allowed_networks} onChange={(v) => set('web_allowed_networks', v)} width={240} />
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          Leave empty to allow all. Comma-separated CIDRs.
        </div>
      </Row>
      <Row label="Session timeout">
        <XPNumber value={s.web_session_timeout} onChange={(v) => set('web_session_timeout', v)} min={60} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>seconds</span>
      </Row>
      <Row label="Map refresh interval">
        <XPNumber value={s.web_refresh_interval} onChange={(v) => set('web_refresh_interval', v)} min={5} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>seconds</span>
      </Row>
    </div>
  )
}

function TabSyslog({ s, set }: { s: ServerSettings; set: SetFn }) {
  return (
    <div>
      <SectionTitle>Syslog Server</SectionTitle>
      <Row label="">
        <XPCheck checked={s.syslog_enabled} onChange={(v) => set('syslog_enabled', v)} label="Enable syslog server" />
      </Row>
      <Row label="Port">
        <XPNumber value={s.syslog_port} onChange={(v) => set('syslog_port', v)} min={1} max={65535} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>UDP (default: 514)</span>
      </Row>

      <SectionTitle>Log File</SectionTitle>
      <Row label="Log file name">
        <XPInput value={s.syslog_log_file} onChange={(v) => set('syslog_log_file', v)} />
      </Row>
      <Row label="Start new file">
        <XPSelect
          value={s.syslog_start_new_file}
          onChange={(v) => set('syslog_start_new_file', v)}
          options={[
            { value: 'never', label: 'Never' },
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
          ]}
        />
      </Row>
      <Row label="Logs to keep">
        <XPNumber value={s.syslog_logs_to_keep} onChange={(v) => set('syslog_logs_to_keep', v)} min={1} />
      </Row>
      <Row label="Buffered entries">
        <XPNumber value={s.syslog_buffered_entries} onChange={(v) => set('syslog_buffered_entries', v)} min={0} />
      </Row>
    </div>
  )
}

function TabSMTP({ s, set }: { s: ServerSettings; set: SetFn }) {
  return (
    <div>
      <SectionTitle>Email (SMTP)</SectionTitle>
      <Row label="Primary SMTP server">
        <XPInput value={s.primary_smtp} onChange={(v) => set('primary_smtp', v)} placeholder="mail.example.com or mail.example.com:587" />
      </Row>
      <Row label="Secondary SMTP server">
        <XPInput value={s.secondary_smtp} onChange={(v) => set('secondary_smtp', v)} placeholder="mail2.example.com" />
      </Row>
      <Row label="From address">
        <XPInput value={s.smtp_from} onChange={(v) => set('smtp_from', v)} placeholder="yad@example.com" />
      </Row>
      <Row label="Username">
        <XPInput value={s.smtp_username} onChange={(v) => set('smtp_username', v)} placeholder="(leave blank for unauthenticated)" />
      </Row>
      <Row label="Password">
        <input
          type="password"
          value={s.smtp_password}
          onChange={(e) => set('smtp_password', e.target.value)}
          style={{
            width: '100%', border: '1px solid var(--chrome-border)', padding: '1px 3px',
            fontSize: 11, fontFamily: 'Tahoma, Arial, sans-serif',
            background: 'var(--bg-base)', color: 'var(--text-primary)',
          }}
        />
      </Row>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, marginLeft: 186 }}>
        Alert emails are sent when &ldquo;Send email&rdquo; is enabled in Service Polling
        and an alert rule has a notification email address set.
      </div>
    </div>
  )
}

function TabMapSettings({ s, set }: { s: ServerSettings; set: SetFn }) {
  return (
    <div>
      <SectionTitle>Rendering</SectionTitle>
      <Row label="">
        <XPCheck
          checked={s.map_antialiased}
          onChange={(v) => set('map_antialiased', v)}
          label="Antialiased geometry (smoother lines, higher CPU)"
        />
      </Row>
      <Row label="">
        <XPCheck
          checked={s.map_gradients}
          onChange={(v) => set('map_gradients', v)}
          label="Use gradients for icon backgrounds"
        />
      </Row>
    </div>
  )
}

function TabChartSettings({ s, set }: { s: ServerSettings; set: SetFn }) {
  return (
    <div>
      <SectionTitle>Data Retention</SectionTitle>
      <Row label="Keep chart values for">
        <XPNumber value={s.chart_value_keep_days} onChange={(v) => set('chart_value_keep_days', v)} min={1} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>days</span>
      </Row>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, marginLeft: 186 }}>
        Metric data older than this will be pruned from the database.
      </div>
    </div>
  )
}

function TabReportPDF({ s, set }: { s: ServerSettings; set: SetFn }) {
  return (
    <div>
      <SectionTitle>PDF Export Font</SectionTitle>
      <Row label="Font family">
        <XPSelect
          value={s.report_font_family}
          onChange={(v) => set('report_font_family', v)}
          options={[
            { value: 'DejaVu Sans', label: 'DejaVu Sans (recommended, Unicode)' },
            { value: 'Arial Unicode', label: 'Arial Unicode' },
            { value: 'Liberation Sans', label: 'Liberation Sans' },
            { value: 'Courier', label: 'Courier' },
          ]}
        />
      </Row>
      <Row label="Font size">
        <XPNumber value={s.report_font_size} onChange={(v) => set('report_font_size', v)} min={6} max={24} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>pt</span>
      </Row>
    </div>
  )
}

function TabDiscover({ s, set }: { s: ServerSettings; set: SetFn }) {
  return (
    <div>
      <SectionTitle>Map Layout After Discovery</SectionTitle>
      <Row label="Item width">
        <XPNumber value={s.discover_item_width} onChange={(v) => set('discover_item_width', v)} min={20} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>px</span>
      </Row>
      <Row label="Item height">
        <XPNumber value={s.discover_item_height} onChange={(v) => set('discover_item_height', v)} min={20} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>px</span>
      </Row>
      <Row label="Group size">
        <XPNumber value={s.discover_group_size} onChange={(v) => set('discover_group_size', v)} min={2} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>items per row/column cluster</span>
      </Row>
    </div>
  )
}

function TabRouterOS({ s, set }: { s: ServerSettings; set: SetFn }) {
  return (
    <div>
      <SectionTitle>RouterOS Connection</SectionTitle>
      <Row label="Connection timeout">
        <XPNumber value={s.routeros_timeout_sec} onChange={(v) => set('routeros_timeout_sec', v)} min={1} max={60} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>seconds</span>
      </Row>
      <Row label="Poll interval">
        <XPNumber value={s.routeros_interval_sec} onChange={(v) => set('routeros_interval_sec', v)} min={10} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>seconds (how often to query RouterOS API)</span>
      </Row>
    </div>
  )
}

function WinBtn({ children, onClick, disabled }: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '2px 14px', fontSize: 11,
        background: disabled ? 'var(--bg-elevated)' : 'var(--chrome-bg)',
        border: '1px solid var(--chrome-border)',
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'Tahoma, Arial, sans-serif',
        opacity: disabled ? 0.7 : 1,
        color: 'var(--text-primary)',
      }}
    >
      {children}
    </button>
  )
}

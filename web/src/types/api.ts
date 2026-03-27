// Device types matching The Dude's predefined device type list
export type DeviceType =
  | 'mikrotik'
  | 'bridge'
  | 'router'
  | 'switch'
  | 'dude_server'
  | 'windows'
  | 'hp_jetdirect'
  | 'ftp_server'
  | 'mail_server'
  | 'web_server'
  | 'dns_server'
  | 'pop3_server'
  | 'imap4_server'
  | 'news_server'
  | 'time_server'
  | 'printer'
  | 'unknown'

// Device status: up=green, partial=orange (some services down), down=red, unknown=grey, acked=blue
export type DeviceStatus = 'up' | 'down' | 'partial' | 'unknown' | 'acked'

// Per-service status
export type ServiceStatus = 'ok' | 'timeout' | 'down' | 'unknown'

// How the service is checked
export type ProbeType = 'icmp' | 'tcp' | 'udp' | 'snmp' | 'dns' | 'function' | 'logic' | 'random'

// How link traffic data is collected
export type LinkMasterType = 'simple' | 'snmp' | 'routeros'

// Link types with visual meaning
export type LinkType =
  | 'gigabit_ethernet'
  | 'fast_ethernet'
  | 'ethernet'
  | 'vlan'
  | 'point_to_point'
  | 'wireless'
  | 'unknown'

export interface Device {
  id: string
  name: string
  ip: string
  mac: string
  type: DeviceType
  vendor: string
  dns_name: string
  snmp_community: string
  snmp_version: number
  username: string
  status: DeviceStatus
  cpu_percent: number | null
  disk_percent: number | null
  uptime_seconds: number | null
  system_name: string
  description: string
  routeros_version: string
  is_routeros: boolean
  last_seen: string | null
  created_at: string
  notes: string
  parent_ids: string[]
}

// A monitored service on a device (ping, ssh, http, cpu, disk, dns...)
export interface Service {
  id: string
  device_id: string
  probe: string           // probe name: ping, ssh, http, cpu, disk, dns, ftp...
  probe_type: ProbeType
  port: number | null
  enabled: boolean
  status: ServiceStatus
  problem: string         // error message when not 'ok'
  probes_down: number
  time_last_up: string | null
  time_last_down: string | null
  time_up_total: number   // seconds total up time
  time_down_total: number // seconds total down time
  notes: string
}

// A link (connection) between two devices on the map
export interface Link {
  id: string
  device_id: string
  peer_device_id: string | null
  interface_name: string
  mastering_type: LinkMasterType
  link_type: LinkType
  speed_mbps: number | null
  rx_bps: number | null
  tx_bps: number | null
  created_at: string
}

// An outage event (service down period)
export interface Outage {
  id: number
  device_id: string
  service_id: string
  service_probe: string
  status: 'active' | 'resolved'
  started_at: string
  resolved_at: string | null
  duration_seconds: number | null
}

export interface Metric {
  id: number
  device_id: string
  name: string
  value: number
  timestamp: string
}

export interface TopologyNode {
  device_id: string
  x: number
  y: number
}

export type AlertCondition = 'gt' | 'lt' | 'eq'

export interface AlertRule {
  id: string
  device_id: string | null
  metric: string
  condition: AlertCondition
  threshold: number
  enabled: boolean
  notify_email: string
  notify_webhook: string
}

export interface AlertEvent {
  id: number
  rule_id: string
  device_id: string
  value: number
  message: string
  triggered_at: string
}

export interface ScanStatus {
  running: boolean
  cidr: string
  total: number
  scanned: number
  found: number
  started_at: string
  finished_at: string | null
}

// Discovery request — mirrors The Dude's discovery dialog options
export interface ScanRequest {
  cidr: string
  snmp_community?: string
  snmp_version?: number
  fast_mode?: boolean       // true=ping only (fast), false=check all services (reliable)
  recursive_hops?: number   // 0–5: scan networks found on discovered devices
  add_networks?: boolean    // add subnet cloud icons to map
  add_links?: boolean       // auto-detect and add links
  identify_device_types?: boolean
  services?: string[]       // probes to check: ['ping','ssh','http','cpu','disk',...]
  layout_after?: boolean    // auto-layout map after discovery
}

export interface CreateDeviceRequest {
  name: string
  ip: string
  mac?: string
  type?: DeviceType
  snmp_community?: string
  snmp_version?: number
  username?: string
  password?: string
  is_routeros?: boolean
  notes?: string
}

export interface CreateAlertRequest {
  device_id?: string
  metric: string
  condition: AlertCondition
  threshold: number
  notify_email?: string
  notify_webhook?: string
}

export interface ServerSettings {
  primary_dns: string
  secondary_dns: string
  primary_smtp: string
  secondary_smtp: string
  smtp_from: string
  probe_interval_sec: number
  probe_timeout_sec: number
  probe_down_count: number
  web_port: number
  syslog_enabled: boolean
  syslog_port: number
}

// Status color map (matches The Dude exactly)
export const STATUS_COLORS: Record<DeviceStatus, string> = {
  up: '#22c55e',       // green
  partial: '#f97316',  // orange
  down: '#ef4444',     // red
  unknown: '#9ca3af',  // grey
  acked: '#3b82f6',    // blue
}

export const STATUS_TEXT_COLORS: Record<DeviceStatus, string> = {
  up: '#ffffff',
  partial: '#ffffff',
  down: '#ffffff',
  unknown: '#ffffff',
  acked: '#ffffff',
}

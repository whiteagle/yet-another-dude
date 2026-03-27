package db

import "time"

// DeviceType represents the type of network device.
type DeviceType string

const (
	DeviceTypeMikrotik   DeviceType = "mikrotik"
	DeviceTypeBridge     DeviceType = "bridge"
	DeviceTypeRouter     DeviceType = "router"
	DeviceTypeSwitch     DeviceType = "switch"
	DeviceTypeDudeServer DeviceType = "dude_server"
	DeviceTypeWindows    DeviceType = "windows"
	DeviceTypeHPJet      DeviceType = "hp_jetdirect"
	DeviceTypeFTP        DeviceType = "ftp_server"
	DeviceTypeMail       DeviceType = "mail_server"
	DeviceTypeWeb        DeviceType = "web_server"
	DeviceTypeDNS        DeviceType = "dns_server"
	DeviceTypePOP3       DeviceType = "pop3_server"
	DeviceTypeIMAP4      DeviceType = "imap4_server"
	DeviceTypeNews       DeviceType = "news_server"
	DeviceTypeTime       DeviceType = "time_server"
	DeviceTypePrinter    DeviceType = "printer"
	DeviceTypeUnknown    DeviceType = "unknown"
)

// DeviceStatus represents the current status of a device.
type DeviceStatus string

const (
	DeviceStatusUp      DeviceStatus = "up"
	DeviceStatusDown    DeviceStatus = "down"
	DeviceStatusPartial DeviceStatus = "partial"
	DeviceStatusUnknown DeviceStatus = "unknown"
	DeviceStatusAcked   DeviceStatus = "acked"
)

// Device represents a monitored network device.
type Device struct {
	ID              string       `json:"id"`
	Name            string       `json:"name"`
	IP              string       `json:"ip"`
	MAC             string       `json:"mac,omitempty"`
	Type            DeviceType   `json:"type"`
	Vendor          string       `json:"vendor,omitempty"`
	DNSName         string       `json:"dns_name,omitempty"`
	SNMPCommunity   string       `json:"snmp_community"`
	SNMPVersion     int          `json:"snmp_version"`
	Username        string       `json:"username,omitempty"`
	Status          DeviceStatus `json:"status"`
	CPUPercent      *float64     `json:"cpu_percent"`
	DiskPercent     *float64     `json:"disk_percent"`
	UptimeSeconds   *int64       `json:"uptime_seconds"`
	SystemName      string       `json:"system_name,omitempty"`
	Description     string       `json:"description,omitempty"`
	RouterOSVersion string       `json:"routeros_version,omitempty"`
	IsRouterOS      bool         `json:"is_routeros"`
	Notes           string       `json:"notes,omitempty"`
	ParentIDs       []string     `json:"parent_ids"`
	LastSeen        *time.Time   `json:"last_seen"`
	CreatedAt       time.Time    `json:"created_at"`
}

// ServiceStatus is the status of a monitored service probe.
type ServiceStatus string

const (
	ServiceStatusOK      ServiceStatus = "ok"
	ServiceStatusTimeout ServiceStatus = "timeout"
	ServiceStatusDown    ServiceStatus = "down"
	ServiceStatusUnknown ServiceStatus = "unknown"
)

// Service represents a monitored service (probe) on a device.
type Service struct {
	ID            string        `json:"id"`
	DeviceID      string        `json:"device_id"`
	Probe         string        `json:"probe"`
	ProbeType     string        `json:"probe_type"`
	Port          *int          `json:"port"`
	Enabled       bool          `json:"enabled"`
	Status        ServiceStatus `json:"status"`
	Problem       string        `json:"problem,omitempty"`
	ProbesDown    int           `json:"probes_down"`
	TimeLastUp    *time.Time    `json:"time_last_up"`
	TimeLastDown  *time.Time    `json:"time_last_down"`
	TimeUpTotal   int64         `json:"time_up_total"`
	TimeDownTotal int64         `json:"time_down_total"`
	Notes         string        `json:"notes,omitempty"`
}

// LinkType is the physical/logical type of a network link.
type LinkType string

const (
	LinkTypeGigabit     LinkType = "gigabit_ethernet"
	LinkTypeFastEthernet LinkType = "fast_ethernet"
	LinkTypeEthernet    LinkType = "ethernet"
	LinkTypeVLAN        LinkType = "vlan"
	LinkTypeP2P         LinkType = "point_to_point"
	LinkTypeWireless    LinkType = "wireless"
	LinkTypeUnknown     LinkType = "unknown"
)

// Link represents a network link between two devices.
type Link struct {
	ID            string    `json:"id"`
	DeviceID      string    `json:"device_id"`
	PeerDeviceID  *string   `json:"peer_device_id"`
	InterfaceName string    `json:"interface_name,omitempty"`
	MasteringType string    `json:"mastering_type"`
	LinkType      LinkType  `json:"link_type"`
	SpeedMbps     *int      `json:"speed_mbps"`
	RxBps         *int64    `json:"rx_bps"`
	TxBps         *int64    `json:"tx_bps"`
	CreatedAt     time.Time `json:"created_at"`
}

// Outage represents a service outage event.
type Outage struct {
	ID              int64      `json:"id"`
	DeviceID        string     `json:"device_id"`
	ServiceID       string     `json:"service_id"`
	ServiceProbe    string     `json:"service_probe"`
	Status          string     `json:"status"` // active | resolved
	StartedAt       time.Time  `json:"started_at"`
	ResolvedAt      *time.Time `json:"resolved_at"`
	DurationSeconds *int64     `json:"duration_seconds"`
}

// Metric represents a single metric data point.
type Metric struct {
	ID        int64     `json:"id"`
	DeviceID  string    `json:"device_id"`
	Name      string    `json:"name"`
	Value     float64   `json:"value"`
	Timestamp time.Time `json:"timestamp"`
}

// TopologyNode represents a device position on the topology map.
type TopologyNode struct {
	DeviceID string  `json:"device_id"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
}

// AlertCondition represents the comparison operator for an alert rule.
type AlertCondition string

const (
	AlertConditionGT AlertCondition = "gt"
	AlertConditionLT AlertCondition = "lt"
	AlertConditionEQ AlertCondition = "eq"
)

// AlertRule defines when an alert should trigger.
type AlertRule struct {
	ID            string         `json:"id"`
	DeviceID      *string        `json:"device_id,omitempty"`
	Metric        string         `json:"metric"`
	Condition     AlertCondition `json:"condition"`
	Threshold     float64        `json:"threshold"`
	Enabled       bool           `json:"enabled"`
	NotifyEmail   string         `json:"notify_email,omitempty"`
	NotifyWebhook string         `json:"notify_webhook,omitempty"`
}

// AlertEvent represents a triggered alert.
type AlertEvent struct {
	ID          int64     `json:"id"`
	RuleID      string    `json:"rule_id"`
	DeviceID    string    `json:"device_id"`
	Value       float64   `json:"value"`
	Message     string    `json:"message"`
	TriggeredAt time.Time `json:"triggered_at"`
}

// ServerSettings holds global server configuration.
type ServerSettings struct {
	PrimaryDNS      string  `json:"primary_dns"`
	SecondaryDNS    string  `json:"secondary_dns"`
	PrimarySMTP     string  `json:"primary_smtp"`
	SecondarySMTP   string  `json:"secondary_smtp"`
	SMTPFrom        string  `json:"smtp_from"`
	ProbeIntervalSec int    `json:"probe_interval_sec"`
	ProbeTimeoutSec  int    `json:"probe_timeout_sec"`
	ProbeDownCount  int     `json:"probe_down_count"`
	WebPort         int     `json:"web_port"`
	SyslogEnabled   bool    `json:"syslog_enabled"`
	SyslogPort      int     `json:"syslog_port"`
}

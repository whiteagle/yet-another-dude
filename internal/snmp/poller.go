// Package snmp provides SNMP polling capabilities for network device monitoring.
package snmp

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/gosnmp/gosnmp"
)

// Common SNMP OIDs used for monitoring.
var (
	OIDSysDescr     = "1.3.6.1.2.1.1.1.0"
	OIDSysName      = "1.3.6.1.2.1.1.5.0"
	OIDSysUptime    = "1.3.6.1.2.1.1.3.0"
	OIDIfTable      = "1.3.6.1.2.1.2.2.1"
	OIDIfDescr      = "1.3.6.1.2.1.2.2.1.2"
	OIDIfInOctets   = "1.3.6.1.2.1.2.2.1.10"
	OIDIfOutOctets  = "1.3.6.1.2.1.2.2.1.16"
	OIDIfOperStatus = "1.3.6.1.2.1.2.2.1.8"
	OIDHrCPU        = "1.3.6.1.2.1.25.3.3.1.2"    // Host Resources CPU load
	OIDMemTotal     = "1.3.6.1.2.1.25.2.2.0"        // hrMemorySize
	OIDMemUsed      = "1.3.6.1.2.1.25.2.3.1.6"      // hrStorageUsed
)

// SNMPVersion represents the SNMP protocol version.
type SNMPVersion int

const (
	SNMPv1  SNMPVersion = 1
	SNMPv2c SNMPVersion = 2
	SNMPv3  SNMPVersion = 3
)

// PollResult contains the metrics gathered from a single SNMP poll.
type PollResult struct {
	DeviceID  string
	Metrics   map[string]float64
	SysDescr  string
	SysName   string
	SysUptime time.Duration
	Error     error
}

// DeviceInfo contains discovered information about a device.
type DeviceInfo struct {
	SysDescr  string
	SysName   string
	Vendor    string
	SysUptime time.Duration
}

// SNMPClient defines the interface for SNMP operations.
type SNMPClient interface {
	// Get retrieves the value of a single OID.
	Get(ctx context.Context, target string, community string, version SNMPVersion, oid string) (interface{}, error)

	// GetMultiple retrieves values for multiple OIDs in a single request.
	GetMultiple(ctx context.Context, target string, community string, version SNMPVersion, oids []string) (map[string]interface{}, error)

	// Walk performs an SNMP walk on the given OID subtree.
	Walk(ctx context.Context, target string, community string, version SNMPVersion, oid string) (map[string]interface{}, error)
}

// GoSNMPClient implements SNMPClient using gosnmp library.
type GoSNMPClient struct {
	timeout time.Duration
}

// NewGoSNMPClient creates a new GoSNMPClient.
func NewGoSNMPClient(timeout time.Duration) *GoSNMPClient {
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	return &GoSNMPClient{timeout: timeout}
}

func (c *GoSNMPClient) newSNMP(target, community string, version SNMPVersion) *gosnmp.GoSNMP {
	snmpVersion := gosnmp.Version2c
	switch version {
	case SNMPv1:
		snmpVersion = gosnmp.Version1
	case SNMPv3:
		snmpVersion = gosnmp.Version3
	}

	return &gosnmp.GoSNMP{
		Target:    target,
		Port:      161,
		Community: community,
		Version:   snmpVersion,
		Timeout:   c.timeout,
		Retries:   1,
	}
}

// Get retrieves a single OID value.
func (c *GoSNMPClient) Get(ctx context.Context, target, community string, version SNMPVersion, oid string) (interface{}, error) {
	results, err := c.GetMultiple(ctx, target, community, version, []string{oid})
	if err != nil {
		return nil, err
	}
	val, ok := results[oid]
	if !ok {
		return nil, fmt.Errorf("OID %s not found in response", oid)
	}
	return val, nil
}

// GetMultiple retrieves multiple OID values.
func (c *GoSNMPClient) GetMultiple(_ context.Context, target, community string, version SNMPVersion, oids []string) (map[string]interface{}, error) {
	snmpConn := c.newSNMP(target, community, version)
	if err := snmpConn.Connect(); err != nil {
		return nil, fmt.Errorf("connect to %s: %w", target, err)
	}
	defer snmpConn.Conn.Close()

	result, err := snmpConn.Get(oids)
	if err != nil {
		return nil, fmt.Errorf("SNMP GET %s: %w", target, err)
	}

	values := make(map[string]interface{})
	for _, v := range result.Variables {
		switch v.Type {
		case gosnmp.OctetString:
			values[v.Name] = string(v.Value.([]byte))
		case gosnmp.TimeTicks:
			values[v.Name] = time.Duration(v.Value.(uint32)) * 10 * time.Millisecond
		default:
			values[v.Name] = gosnmp.ToBigInt(v.Value).Int64()
		}
	}
	return values, nil
}

// Walk performs an SNMP walk.
func (c *GoSNMPClient) Walk(_ context.Context, target, community string, version SNMPVersion, oid string) (map[string]interface{}, error) {
	snmpConn := c.newSNMP(target, community, version)
	if err := snmpConn.Connect(); err != nil {
		return nil, fmt.Errorf("connect to %s: %w", target, err)
	}
	defer snmpConn.Conn.Close()

	values := make(map[string]interface{})

	var walkFn gosnmp.WalkFunc = func(pdu gosnmp.SnmpPDU) error {
		switch pdu.Type {
		case gosnmp.OctetString:
			values[pdu.Name] = string(pdu.Value.([]byte))
		case gosnmp.TimeTicks:
			values[pdu.Name] = time.Duration(pdu.Value.(uint32)) * 10 * time.Millisecond
		default:
			values[pdu.Name] = gosnmp.ToBigInt(pdu.Value).Int64()
		}
		return nil
	}

	if version == SNMPv1 {
		err := snmpConn.Walk(oid, walkFn)
		if err != nil {
			return nil, fmt.Errorf("SNMP walk %s on %s: %w", oid, target, err)
		}
	} else {
		err := snmpConn.BulkWalk(oid, walkFn)
		if err != nil {
			return nil, fmt.Errorf("SNMP bulk walk %s on %s: %w", oid, target, err)
		}
	}

	return values, nil
}

// Poller orchestrates SNMP polling of devices.
type Poller struct {
	client SNMPClient
}

// NewPoller creates a new Poller with the given SNMP client.
func NewPoller(client SNMPClient) *Poller {
	return &Poller{client: client}
}

// PollDevice performs a full SNMP poll on a device and returns metrics.
func (p *Poller) PollDevice(ctx context.Context, deviceID, target, community string, version SNMPVersion) PollResult {
	result := PollResult{
		DeviceID: deviceID,
		Metrics:  make(map[string]float64),
	}

	// Get system info
	sysInfo, err := p.client.GetMultiple(ctx, target, community, version, []string{
		OIDSysDescr, OIDSysName, OIDSysUptime,
	})
	if err != nil {
		slog.Warn("failed to get system info", "device", deviceID, "error", err)
		result.Error = err
		return result
	}

	if v, ok := sysInfo["."+OIDSysDescr]; ok {
		if s, ok := v.(string); ok {
			result.SysDescr = s
		}
	}
	if v, ok := sysInfo["."+OIDSysName]; ok {
		if s, ok := v.(string); ok {
			result.SysName = s
		}
	}
	if v, ok := sysInfo["."+OIDSysUptime]; ok {
		if d, ok := v.(time.Duration); ok {
			result.SysUptime = d
			result.Metrics["uptime_seconds"] = d.Seconds()
		}
	}

	// Get CPU metrics
	cpuValues, err := p.client.Walk(ctx, target, community, version, OIDHrCPU)
	if err != nil {
		slog.Debug("CPU walk failed", "device", deviceID, "error", err)
	} else {
		var cpuSum float64
		var cpuCount int
		for _, v := range cpuValues {
			if val, ok := v.(int64); ok {
				cpuSum += float64(val)
				cpuCount++
			}
		}
		if cpuCount > 0 {
			result.Metrics["cpu"] = cpuSum / float64(cpuCount)
		}
	}

	// Get interface metrics
	ifDescrs, err := p.client.Walk(ctx, target, community, version, OIDIfDescr)
	if err != nil {
		slog.Debug("interface walk failed", "device", deviceID, "error", err)
	} else {
		ifInOctets, _ := p.client.Walk(ctx, target, community, version, OIDIfInOctets)
		ifOutOctets, _ := p.client.Walk(ctx, target, community, version, OIDIfOutOctets)

		for oid, nameVal := range ifDescrs {
			ifName, ok := nameVal.(string)
			if !ok {
				continue
			}
			// Extract interface index from OID
			suffix := oid[len("."+OIDIfDescr):]

			if v, ok := ifInOctets["."+OIDIfInOctets+suffix]; ok {
				if val, ok := v.(int64); ok {
					result.Metrics[fmt.Sprintf("interface.%s.rx", ifName)] = float64(val)
				}
			}
			if v, ok := ifOutOctets["."+OIDIfOutOctets+suffix]; ok {
				if val, ok := v.(int64); ok {
					result.Metrics[fmt.Sprintf("interface.%s.tx", ifName)] = float64(val)
				}
			}
		}
	}

	return result
}

// GetDeviceInfo retrieves basic device information via SNMP.
func (p *Poller) GetDeviceInfo(ctx context.Context, target, community string, version SNMPVersion) (*DeviceInfo, error) {
	info := &DeviceInfo{}

	val, err := p.client.Get(ctx, target, community, version, OIDSysDescr)
	if err != nil {
		return nil, fmt.Errorf("get sysDescr: %w", err)
	}
	if s, ok := val.(string); ok {
		info.SysDescr = s
		info.Vendor = DetectVendor(s)
	}

	val, err = p.client.Get(ctx, target, community, version, OIDSysName)
	if err == nil {
		if s, ok := val.(string); ok {
			info.SysName = s
		}
	}

	return info, nil
}

// DetectVendor attempts to identify the device vendor from sysDescr.
func DetectVendor(sysDescr string) string {
	vendors := map[string][]string{
		"MikroTik":  {"RouterOS", "MikroTik"},
		"Cisco":     {"Cisco", "cisco"},
		"Ubiquiti":  {"Ubiquiti", "EdgeOS", "UniFi"},
		"Juniper":   {"Juniper", "JUNOS"},
		"HPE":       {"HP ", "Hewlett", "Aruba", "ProCurve"},
		"Linux":     {"Linux"},
		"Windows":   {"Windows", "Microsoft"},
	}

	for vendor, keywords := range vendors {
		for _, kw := range keywords {
			if containsInsensitive(sysDescr, kw) {
				return vendor
			}
		}
	}
	return "Unknown"
}

func containsInsensitive(s, substr string) bool {
	sLower := toLower(s)
	subLower := toLower(substr)
	return len(sLower) >= len(subLower) && contains(sLower, subLower)
}

func toLower(s string) string {
	b := make([]byte, len(s))
	for i := range len(s) {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		b[i] = c
	}
	return string(b)
}

func contains(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}

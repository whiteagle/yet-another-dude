package snmp

import (
	"context"
	"fmt"
	"testing"
	"time"
)

// MockSNMPClient implements SNMPClient for testing.
type MockSNMPClient struct {
	GetFunc         func(ctx context.Context, target, community string, version SNMPVersion, oid string) (interface{}, error)
	GetMultipleFunc func(ctx context.Context, target, community string, version SNMPVersion, oids []string) (map[string]interface{}, error)
	WalkFunc        func(ctx context.Context, target, community string, version SNMPVersion, oid string) (map[string]interface{}, error)
}

func (m *MockSNMPClient) Get(ctx context.Context, target, community string, version SNMPVersion, oid string) (interface{}, error) {
	if m.GetFunc != nil {
		return m.GetFunc(ctx, target, community, version, oid)
	}
	return nil, fmt.Errorf("not implemented")
}

func (m *MockSNMPClient) GetMultiple(ctx context.Context, target, community string, version SNMPVersion, oids []string) (map[string]interface{}, error) {
	if m.GetMultipleFunc != nil {
		return m.GetMultipleFunc(ctx, target, community, version, oids)
	}
	return nil, fmt.Errorf("not implemented")
}

func (m *MockSNMPClient) Walk(ctx context.Context, target, community string, version SNMPVersion, oid string) (map[string]interface{}, error) {
	if m.WalkFunc != nil {
		return m.WalkFunc(ctx, target, community, version, oid)
	}
	return nil, fmt.Errorf("not implemented")
}

func TestDetectVendor(t *testing.T) {
	tests := []struct {
		name     string
		sysDescr string
		want     string
	}{
		{"MikroTik RouterOS", "RouterOS RB750Gr3", "MikroTik"},
		{"Cisco IOS", "Cisco IOS Software, C2960 Software", "Cisco"},
		{"Ubiquiti EdgeRouter", "EdgeOS v2.0.9", "Ubiquiti"},
		{"Linux server", "Linux gateway 5.15.0", "Linux"},
		{"Windows Server", "Hardware: Intel - Software: Windows Version 6.3", "Windows"},
		{"Unknown device", "Some random device", "Unknown"},
		{"Empty string", "", "Unknown"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := DetectVendor(tt.sysDescr)
			if got != tt.want {
				t.Errorf("DetectVendor(%q) = %q, want %q", tt.sysDescr, got, tt.want)
			}
		})
	}
}

func TestPollerPollDevice(t *testing.T) {
	mock := &MockSNMPClient{
		GetMultipleFunc: func(_ context.Context, _, _ string, _ SNMPVersion, oids []string) (map[string]interface{}, error) {
			result := map[string]interface{}{
				"." + OIDSysDescr:  "RouterOS RB750Gr3",
				"." + OIDSysName:   "gateway",
				"." + OIDSysUptime: 48 * time.Hour,
			}
			return result, nil
		},
		WalkFunc: func(_ context.Context, _, _ string, _ SNMPVersion, oid string) (map[string]interface{}, error) {
			switch oid {
			case OIDHrCPU:
				return map[string]interface{}{
					"." + OIDHrCPU + ".1": int64(25),
					"." + OIDHrCPU + ".2": int64(35),
				}, nil
			case OIDIfDescr:
				return map[string]interface{}{
					"." + OIDIfDescr + ".1": "ether1",
					"." + OIDIfDescr + ".2": "ether2",
				}, nil
			case OIDIfInOctets:
				return map[string]interface{}{
					"." + OIDIfInOctets + ".1": int64(1000000),
					"." + OIDIfInOctets + ".2": int64(2000000),
				}, nil
			case OIDIfOutOctets:
				return map[string]interface{}{
					"." + OIDIfOutOctets + ".1": int64(500000),
					"." + OIDIfOutOctets + ".2": int64(750000),
				}, nil
			}
			return nil, fmt.Errorf("unknown OID: %s", oid)
		},
	}

	poller := NewPoller(mock)
	ctx := context.Background()

	result := poller.PollDevice(ctx, "dev-1", "192.168.1.1", "public", SNMPv2c)

	if result.Error != nil {
		t.Fatalf("PollDevice() error = %v", result.Error)
	}

	if result.SysDescr != "RouterOS RB750Gr3" {
		t.Errorf("SysDescr = %q, want %q", result.SysDescr, "RouterOS RB750Gr3")
	}

	if result.SysName != "gateway" {
		t.Errorf("SysName = %q, want %q", result.SysName, "gateway")
	}

	// Check CPU metric
	if cpu, ok := result.Metrics["cpu"]; !ok || cpu != 30.0 {
		t.Errorf("cpu metric = %v, want 30.0", cpu)
	}

	// Check interface metrics
	wantMetrics := map[string]float64{
		"interface.ether1.rx": 1000000,
		"interface.ether1.tx": 500000,
		"interface.ether2.rx": 2000000,
		"interface.ether2.tx": 750000,
	}

	for name, want := range wantMetrics {
		if got, ok := result.Metrics[name]; !ok {
			t.Errorf("missing metric %q", name)
		} else if got != want {
			t.Errorf("metric %q = %v, want %v", name, got, want)
		}
	}
}

func TestPollerPollDeviceSNMPFailure(t *testing.T) {
	mock := &MockSNMPClient{
		GetMultipleFunc: func(_ context.Context, _, _ string, _ SNMPVersion, _ []string) (map[string]interface{}, error) {
			return nil, fmt.Errorf("connection refused")
		},
	}

	poller := NewPoller(mock)
	ctx := context.Background()

	result := poller.PollDevice(ctx, "dev-1", "192.168.1.1", "public", SNMPv2c)

	if result.Error == nil {
		t.Error("expected error for SNMP failure")
	}
}

func TestPollerGetDeviceInfo(t *testing.T) {
	mock := &MockSNMPClient{
		GetFunc: func(_ context.Context, _, _ string, _ SNMPVersion, oid string) (interface{}, error) {
			switch oid {
			case OIDSysDescr:
				return "RouterOS RB750Gr3", nil
			case OIDSysName:
				return "my-router", nil
			}
			return nil, fmt.Errorf("unknown OID")
		},
		GetMultipleFunc: func(_ context.Context, _, _ string, _ SNMPVersion, oids []string) (map[string]interface{}, error) {
			result := make(map[string]interface{})
			for _, oid := range oids {
				switch oid {
				case OIDSysDescr:
					result[oid] = "RouterOS RB750Gr3"
				case OIDSysName:
					result[oid] = "my-router"
				}
			}
			return result, nil
		},
	}

	poller := NewPoller(mock)
	ctx := context.Background()

	info, err := poller.GetDeviceInfo(ctx, "192.168.1.1", "public", SNMPv2c)
	if err != nil {
		t.Fatalf("GetDeviceInfo() error = %v", err)
	}

	if info.Vendor != "MikroTik" {
		t.Errorf("Vendor = %q, want %q", info.Vendor, "MikroTik")
	}
	if info.SysName != "my-router" {
		t.Errorf("SysName = %q, want %q", info.SysName, "my-router")
	}
}

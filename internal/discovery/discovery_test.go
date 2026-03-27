package discovery

import (
	"context"
	"sync/atomic"
	"testing"
	"time"
)

// MockPinger implements Pinger for testing.
type MockPinger struct {
	AliveIPs map[string]bool
	RTT      time.Duration
	CallCount atomic.Int64
}

func (m *MockPinger) Ping(_ context.Context, ip string) (bool, time.Duration, error) {
	m.CallCount.Add(1)
	if m.AliveIPs[ip] {
		return true, m.RTT, nil
	}
	return false, 0, nil
}

func TestExpandCIDR(t *testing.T) {
	tests := []struct {
		name    string
		cidr    string
		wantLen int
		wantErr bool
	}{
		{
			name:    "single /32",
			cidr:    "192.168.1.1/32",
			wantLen: 0,
			wantErr: false,
		},
		{
			name:    "/30 gives 2 hosts",
			cidr:    "10.0.0.0/30",
			wantLen: 2,
			wantErr: false,
		},
		{
			name:    "/24 gives 254 hosts",
			cidr:    "192.168.1.0/24",
			wantLen: 254,
			wantErr: false,
		},
		{
			name:    "invalid CIDR",
			cidr:    "not-a-cidr",
			wantLen: 0,
			wantErr: true,
		},
		{
			name:    "/31 point-to-point",
			cidr:    "10.0.0.0/31",
			wantLen: 2,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ips, err := expandCIDR(tt.cidr)
			if (err != nil) != tt.wantErr {
				t.Errorf("expandCIDR(%q) error = %v, wantErr %v", tt.cidr, err, tt.wantErr)
				return
			}
			if len(ips) != tt.wantLen {
				t.Errorf("expandCIDR(%q) returned %d IPs, want %d", tt.cidr, len(ips), tt.wantLen)
			}
		})
	}
}

func TestScannerScan(t *testing.T) {
	mock := &MockPinger{
		AliveIPs: map[string]bool{
			"192.168.1.1":   true,
			"192.168.1.10":  true,
			"192.168.1.100": true,
		},
		RTT: 5 * time.Millisecond,
	}

	scanner := NewScanner(mock, 16)
	ctx := context.Background()

	results, err := scanner.Scan(ctx, "192.168.1.0/24")
	if err != nil {
		t.Fatalf("Scan() error = %v", err)
	}

	var alive, total int
	for r := range results {
		total++
		if r.Alive {
			alive++
		}
	}

	if total != 254 {
		t.Errorf("expected 254 results, got %d", total)
	}
	if alive != 3 {
		t.Errorf("expected 3 alive, got %d", alive)
	}

	status := scanner.Status()
	if status.Running {
		t.Error("scan should not be running after completion")
	}
	if status.Found != 3 {
		t.Errorf("status.Found = %d, want 3", status.Found)
	}
}

func TestScannerConcurrentScanRejected(t *testing.T) {
	mock := &MockPinger{
		AliveIPs: map[string]bool{},
		RTT:      100 * time.Millisecond, // slow to keep scan running
	}

	scanner := NewScanner(mock, 2)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	_, err := scanner.Scan(ctx, "10.0.0.0/24")
	if err != nil {
		t.Fatalf("first Scan() error = %v", err)
	}

	// Try to start another scan while first is running
	_, err = scanner.Scan(ctx, "10.0.1.0/24")
	if err == nil {
		t.Error("expected error for concurrent scan, got nil")
	}
}

func TestScannerContextCancellation(t *testing.T) {
	mock := &MockPinger{
		AliveIPs: map[string]bool{},
		RTT:      time.Second,
	}

	scanner := NewScanner(mock, 4)
	ctx, cancel := context.WithCancel(context.Background())

	results, err := scanner.Scan(ctx, "10.0.0.0/24")
	if err != nil {
		t.Fatalf("Scan() error = %v", err)
	}

	// Cancel immediately
	cancel()

	// Drain results - should complete quickly
	var count int
	for range results {
		count++
	}

	// Should have scanned far fewer than 254 hosts
	if count >= 254 {
		t.Errorf("expected early termination, got %d results", count)
	}
}

func TestParseRTT(t *testing.T) {
	tests := []struct {
		name   string
		output string
		want   time.Duration
	}{
		{
			name:   "linux format",
			output: "64 bytes from 1.1.1.1: icmp_seq=1 ttl=57 time=12.3 ms",
			want:   12300 * time.Microsecond,
		},
		{
			name:   "less than 1ms",
			output: "64 bytes from 1.1.1.1: icmp_seq=1 ttl=64 time<1 ms",
			want:   0,
		},
		{
			name:   "no time field",
			output: "Request timed out.",
			want:   0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseRTT(tt.output)
			if got != tt.want {
				t.Errorf("parseRTT() = %v, want %v", got, tt.want)
			}
		})
	}
}

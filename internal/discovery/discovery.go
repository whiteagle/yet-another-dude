// Package discovery implements network device discovery via ICMP sweep.
package discovery

import (
	"context"
	"encoding/binary"
	"fmt"
	"log/slog"
	"net"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"
)

// Pinger defines the interface for checking host reachability.
type Pinger interface {
	// Ping checks if a host is reachable and returns the round-trip time.
	Ping(ctx context.Context, ip string) (alive bool, rtt time.Duration, err error)
}

// DiscoveryResult represents the result of pinging a single IP.
type DiscoveryResult struct {
	IP    string        `json:"ip"`
	Alive bool          `json:"alive"`
	RTT   time.Duration `json:"rtt"`
}

// ScanStatus tracks the progress of an ongoing scan.
type ScanStatus struct {
	Running    bool      `json:"running"`
	CIDR       string    `json:"cidr,omitempty"`
	Total      int       `json:"total"`
	Scanned    int       `json:"scanned"`
	Found      int       `json:"found"`
	StartedAt  time.Time `json:"started_at,omitempty"`
	FinishedAt time.Time `json:"finished_at,omitempty"`
}

// Scanner performs network discovery by sweeping a CIDR range.
type Scanner struct {
	pinger     Pinger
	maxWorkers int

	mu     sync.Mutex
	status ScanStatus
}

// NewScanner creates a new Scanner with the given Pinger and max concurrent workers.
func NewScanner(pinger Pinger, maxWorkers int) *Scanner {
	if maxWorkers <= 0 {
		maxWorkers = 256
	}
	return &Scanner{
		pinger:     pinger,
		maxWorkers: maxWorkers,
	}
}

// Status returns the current scan status.
func (s *Scanner) Status() ScanStatus {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.status
}

// Scan performs an ICMP sweep on the given CIDR range and sends results to the returned channel.
// The channel is closed when the scan completes or the context is cancelled.
func (s *Scanner) Scan(ctx context.Context, cidr string) (<-chan DiscoveryResult, error) {
	ips, err := expandCIDR(cidr)
	if err != nil {
		return nil, fmt.Errorf("invalid CIDR %q: %w", cidr, err)
	}

	s.mu.Lock()
	if s.status.Running {
		s.mu.Unlock()
		return nil, fmt.Errorf("scan already in progress")
	}
	s.status = ScanStatus{
		Running:   true,
		CIDR:      cidr,
		Total:     len(ips),
		StartedAt: time.Now(),
	}
	s.mu.Unlock()

	results := make(chan DiscoveryResult, s.maxWorkers)
	ipCh := make(chan string, s.maxWorkers)

	var wg sync.WaitGroup

	// Start workers
	for range s.maxWorkers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for ip := range ipCh {
				alive, rtt, err := s.pinger.Ping(ctx, ip)
				if err != nil {
					slog.Debug("ping failed", "ip", ip, "error", err)
				}

				result := DiscoveryResult{IP: ip, Alive: alive, RTT: rtt}
				select {
				case results <- result:
				case <-ctx.Done():
					return
				}

				s.mu.Lock()
				s.status.Scanned++
				if alive {
					s.status.Found++
				}
				s.mu.Unlock()
			}
		}()
	}

	// Feed IPs to workers
	go func() {
		defer close(ipCh)
		for _, ip := range ips {
			select {
			case ipCh <- ip:
			case <-ctx.Done():
				return
			}
		}
	}()

	// Close results channel when all workers finish
	go func() {
		wg.Wait()
		close(results)
		s.mu.Lock()
		s.status.Running = false
		s.status.FinishedAt = time.Now()
		s.mu.Unlock()
		slog.Info("scan complete", "cidr", cidr, "found", s.status.Found, "total", s.status.Total)
	}()

	return results, nil
}

// expandCIDR returns all host IPs in a CIDR range (excluding network and broadcast for /24+).
func expandCIDR(cidr string) ([]string, error) {
	ip, ipNet, err := net.ParseCIDR(cidr)
	if err != nil {
		return nil, err
	}

	var ips []string
	mask := binary.BigEndian.Uint32(ipNet.Mask)
	start := binary.BigEndian.Uint32(ip.To4()) & mask
	end := start | ^mask

	ones, bits := ipNet.Mask.Size()

	// /32 (IPv4) or /128 (IPv6) is a host route — no range to scan
	if ones == bits {
		return nil, nil
	}

	// /31 = point-to-point: both addresses are hosts (RFC 3021)
	startOffset := uint32(1)
	endOffset := uint32(1)
	if ones == 31 {
		startOffset = 0
		endOffset = 0
	}

	for i := start + startOffset; i <= end-endOffset; i++ {
		ipBytes := make(net.IP, 4)
		binary.BigEndian.PutUint32(ipBytes, i)
		ips = append(ips, ipBytes.String())
	}

	return ips, nil
}

// RealPinger implements Pinger using OS ping command.
type RealPinger struct{}

// NewRealPinger creates a new RealPinger.
func NewRealPinger() *RealPinger {
	return &RealPinger{}
}

// Ping executes the system ping command with a 1-second timeout.
func (p *RealPinger) Ping(ctx context.Context, ip string) (bool, time.Duration, error) {
	start := time.Now()

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.CommandContext(ctx, "ping", "-n", "1", "-w", "1000", ip)
	default:
		cmd = exec.CommandContext(ctx, "ping", "-c", "1", "-W", "1", ip)
	}

	output, err := cmd.CombinedOutput()
	rtt := time.Since(start)

	if err != nil {
		return false, 0, nil // Host unreachable is not an error
	}

	// Parse RTT from output if possible
	if parsed := parseRTT(string(output)); parsed > 0 {
		rtt = parsed
	}

	return true, rtt, nil
}

// parseRTT attempts to extract RTT from ping output.
// Returns 0 for sub-millisecond ("time<1 ms") or unparseable output.
func parseRTT(output string) time.Duration {
	// "time<X ms" means sub-millisecond — return 0
	if strings.Contains(output, "time<") {
		return 0
	}

	idx := strings.Index(output, "time=")
	if idx == -1 {
		return 0
	}

	rest := output[idx+5:]
	var val float64
	if _, err := fmt.Sscanf(rest, "%f", &val); err != nil || val <= 0 {
		return 0
	}
	return time.Duration(val * float64(time.Millisecond))
}

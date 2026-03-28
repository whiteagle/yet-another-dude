// Package syslog implements an RFC 3164 syslog UDP server.
package syslog

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Severity levels (RFC 5424).
const (
	SeverityEmergency = 0
	SeverityAlert     = 1
	SeverityCritical  = 2
	SeverityError     = 3
	SeverityWarning   = 4
	SeverityNotice    = 5
	SeverityInfo      = 6
	SeverityDebug     = 7
)

// SeverityName returns a short string label for a severity level.
func SeverityName(s int) string {
	names := [8]string{"EMERG", "ALERT", "CRIT", "ERR", "WARNING", "NOTICE", "INFO", "DEBUG"}
	if s >= 0 && s < len(names) {
		return names[s]
	}
	return "UNKNOWN"
}

// FacilityName returns a human-readable name for a syslog facility code.
func FacilityName(f int) string {
	names := [24]string{
		"kern", "user", "mail", "daemon", "auth", "syslog", "lpr", "news",
		"uucp", "cron", "authpriv", "ftp", "ntp", "audit", "alert", "clock",
		"local0", "local1", "local2", "local3", "local4", "local5", "local6", "local7",
	}
	if f >= 0 && f < len(names) {
		return names[f]
	}
	return "unknown"
}

// Message holds a parsed syslog datagram.
type Message struct {
	ReceivedAt time.Time
	Facility   int
	Severity   int
	Hostname   string
	Tag        string
	Body       string
	RawData    string
	SourceIP   string
}

// Server listens for RFC 3164 syslog messages over UDP and delivers each
// received message to the provided sink function.
//
// The sink is called from a single goroutine, so it does not need to be
// concurrency-safe with respect to other sink calls.
type Server struct {
	port   int
	sink   func(Message)
	conn   *net.UDPConn
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// New creates a Server that will listen on the given UDP port and invoke sink
// for every received message.
func New(port int, sink func(Message)) *Server {
	return &Server{port: port, sink: sink}
}

// Start binds the UDP port and begins receiving messages.
// Returns an error immediately if the port cannot be bound.
func (s *Server) Start(ctx context.Context) error {
	addr := &net.UDPAddr{IP: net.IPv4zero, Port: s.port}
	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		return fmt.Errorf("listen syslog udp :%d: %w", s.port, err)
	}
	s.conn = conn

	ctx, s.cancel = context.WithCancel(ctx)
	s.wg.Add(1)
	go s.receive(ctx)

	slog.Info("syslog server started", "port", s.port, "proto", "UDP")
	return nil
}

// Stop signals the receive goroutine to exit and waits for it to finish.
func (s *Server) Stop() {
	if s.cancel != nil {
		s.cancel()
	}
	if s.conn != nil {
		s.conn.Close()
	}
	s.wg.Wait()
	slog.Info("syslog server stopped")
}

func (s *Server) receive(ctx context.Context) {
	defer s.wg.Done()
	buf := make([]byte, 65536)
	for {
		// Short read deadline so we can check ctx.Err() regularly.
		_ = s.conn.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
		n, addr, err := s.conn.ReadFromUDP(buf)
		if err != nil {
			if ctx.Err() != nil {
				return // context cancelled — clean exit
			}
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				continue // deadline hit, loop again
			}
			slog.Error("syslog read error", "error", err)
			return
		}

		raw := string(buf[:n])
		msg := parseRFC3164(raw, addr.IP.String())
		s.sink(msg)
	}
}

// parseRFC3164 parses a BSD syslog message (RFC 3164).
//
// Expected format:
//
//	<PRIVAL>Mmm dd HH:MM:SS HOSTNAME TAG[PID]: MESSAGE
//
// The function is tolerant of common deviations (missing timestamp, no PID,
// raw message with no header at all).
func parseRFC3164(raw, sourceIP string) Message {
	msg := Message{
		ReceivedAt: time.Now(),
		RawData:    raw,
		SourceIP:   sourceIP,
		Severity:   SeverityInfo,
	}

	s := strings.TrimRight(raw, "\r\n")

	// ── Priority field: <N> ──────────────────────────────────────────────────
	if len(s) > 3 && s[0] == '<' {
		end := strings.IndexByte(s, '>')
		if end > 0 {
			if prio, err := strconv.Atoi(s[1:end]); err == nil {
				msg.Facility = prio >> 3
				msg.Severity = prio & 0x07
			}
			s = s[end+1:]
		}
	}

	// Optional RFC 5424 version digit ("1 ")
	if len(s) >= 2 && s[0] >= '1' && s[0] <= '9' && s[1] == ' ' {
		s = s[2:]
	}

	// ── Timestamp: "Mmm dd HH:MM:SS" (15 chars) ─────────────────────────────
	// Try both "Jan  2 HH:MM:SS" (single-digit day padded with space) and
	// "Jan 02 HH:MM:SS" (zero-padded day).
	if len(s) >= 15 {
		ts := s[:15]
		if _, err := time.Parse("Jan  2 15:04:05", ts); err == nil {
			s = strings.TrimLeft(s[15:], " ")
		} else if _, err := time.Parse("Jan 02 15:04:05", ts); err == nil {
			s = strings.TrimLeft(s[15:], " ")
		}
	}

	// ── Hostname ─────────────────────────────────────────────────────────────
	if idx := strings.IndexByte(s, ' '); idx > 0 {
		msg.Hostname = s[:idx]
		s = s[idx+1:]
	}

	// ── Tag and message body ──────────────────────────────────────────────────
	// Tag ends at '[' (PID start), ':' (plain separator), or ' ' (no tag).
	if tagEnd := strings.IndexAny(s, ":[ "); tagEnd > 0 {
		msg.Tag = s[:tagEnd]
		rest := s[tagEnd:]
		// Skip optional "[PID]" and find ": " separator.
		if idx := strings.Index(rest, ": "); idx >= 0 {
			msg.Body = rest[idx+2:]
		} else if idx := strings.IndexByte(rest, ':'); idx >= 0 {
			msg.Body = strings.TrimSpace(rest[idx+1:])
		} else {
			msg.Body = strings.TrimSpace(rest)
		}
	} else {
		msg.Body = s
	}

	return msg
}

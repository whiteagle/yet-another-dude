package syslog

import (
	"testing"
)

func TestParseRFC3164(t *testing.T) {
	tests := []struct {
		name     string
		raw      string
		wantFac  int
		wantSev  int
		wantHost string
		wantTag  string
		wantBody string
	}{
		{
			name:     "full BSD syslog message",
			raw:      "<134>Mar 29 12:00:00 CHR-01 system: interface ether1 link up",
			wantFac:  16, // local0
			wantSev:  6,  // info
			wantHost: "CHR-01",
			wantTag:  "system",
			wantBody: "interface ether1 link up",
		},
		{
			// Parser treats first word after priority as hostname, second as tag.
			name:    "priority only, no timestamp",
			raw:     "<11>some message without timestamp",
			wantFac: 1, // user
			wantSev: 3, // error
			// hostname="some", tag="message", body="without timestamp"
			wantHost: "some",
			wantTag:  "message",
			wantBody: "without timestamp",
		},
		{
			// No priority: entire message parsed as hostname + tag + body.
			name:    "no priority field",
			raw:     "plain syslog line with no angle brackets",
			wantFac: 0,
			wantSev: SeverityInfo,
			// hostname="plain", tag="syslog", body="line with no angle brackets"
			wantHost: "plain",
			wantTag:  "syslog",
			wantBody: "line with no angle brackets",
		},
		{
			name:     "RouterOS format: tag with colon",
			raw:      "<134>Mar 29 05:17:04 CHR-01 firewall,info: forward: in:ether1 out:ether2",
			wantFac:  16,
			wantSev:  6,
			wantHost: "CHR-01",
			wantTag:  "firewall,info",
			wantBody: "forward: in:ether1 out:ether2",
		},
		{
			name:     "empty message",
			raw:      "",
			wantFac:  0,
			wantSev:  SeverityInfo,
			wantBody: "",
		},
		{
			// Parser extracts hostname="kernel", body="panic" (single word, no tag separator).
			name:     "priority 0 (kernel emergency)",
			raw:      "<0>kernel panic",
			wantFac:  0,
			wantSev:  0, // SeverityEmergency
			wantHost: "kernel",
			wantBody: "panic",
		},
		{
			name:     "message with trailing CRLF",
			raw:      "<134>Mar 29 12:00:00 host tag: body\r\n",
			wantFac:  16,
			wantSev:  6,
			wantHost: "host",
			wantTag:  "tag",
			wantBody: "body",
		},
		{
			name:     "invalid priority — non-numeric",
			raw:      "<abc>Mar 29 12:00:00 host tag: body",
			wantFac:  0,
			wantSev:  SeverityInfo, // default
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseRFC3164(tt.raw, "127.0.0.1")

			if got.Facility != tt.wantFac {
				t.Errorf("Facility = %d, want %d", got.Facility, tt.wantFac)
			}
			if got.Severity != tt.wantSev {
				t.Errorf("Severity = %d, want %d", got.Severity, tt.wantSev)
			}
			if tt.wantHost != "" && got.Hostname != tt.wantHost {
				t.Errorf("Hostname = %q, want %q", got.Hostname, tt.wantHost)
			}
			if tt.wantTag != "" && got.Tag != tt.wantTag {
				t.Errorf("Tag = %q, want %q", got.Tag, tt.wantTag)
			}
			if tt.wantBody != "" && got.Body != tt.wantBody {
				t.Errorf("Body = %q, want %q", got.Body, tt.wantBody)
			}
			if got.SourceIP != "127.0.0.1" {
				t.Errorf("SourceIP = %q, want 127.0.0.1", got.SourceIP)
			}
		})
	}
}

func TestSeverityName(t *testing.T) {
	tests := []struct{ sev int; want string }{
		{0, "EMERG"}, {3, "ERR"}, {6, "INFO"}, {7, "DEBUG"},
		{-1, "UNKNOWN"}, {99, "UNKNOWN"},
	}
	for _, tt := range tests {
		if got := SeverityName(tt.sev); got != tt.want {
			t.Errorf("SeverityName(%d) = %q, want %q", tt.sev, got, tt.want)
		}
	}
}

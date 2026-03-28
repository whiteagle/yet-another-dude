package handlers

import (
	"fmt"
	"math"
	"net"
	"strings"
)

// validateIP returns an error if s is not a valid IPv4 or IPv6 address.
func validateIP(s string) error {
	if net.ParseIP(s) == nil {
		return fmt.Errorf("invalid IP address: %q", s)
	}
	return nil
}

// validateCIDR returns an error if s is not a valid IPv4 CIDR notation.
// IPv6 CIDRs are rejected because the discovery scanner only supports IPv4.
func validateCIDR(s string) error {
	ip, _, err := net.ParseCIDR(s)
	if err != nil {
		return fmt.Errorf("invalid CIDR %q: %w", s, err)
	}
	if ip.To4() == nil {
		return fmt.Errorf("IPv6 CIDRs are not supported for discovery scanning (got %q)", s)
	}
	return nil
}

// validateDeviceStatus returns an error if s is not a recognised device status value.
func validateDeviceStatus(s string) error {
	switch s {
	case "up", "down", "partial", "unknown", "acked":
		return nil
	}
	return fmt.Errorf("invalid device status %q: must be one of up, down, partial, unknown, acked", s)
}

// validateThreshold returns an error if v is NaN or infinite.
func validateThreshold(v float64) error {
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return fmt.Errorf("threshold must be a finite number")
	}
	return nil
}

// validatePort returns an error if port is outside [1, 65535].
func validatePort(port int) error {
	if port < 1 || port > 65535 {
		return fmt.Errorf("port %d out of range [1, 65535]", port)
	}
	return nil
}

// validateSNMPVersion returns an error if version is not 1, 2, or 3.
func validateSNMPVersion(v int) error {
	switch v {
	case 0, 1, 2, 3: // 0 = use default
		return nil
	}
	return fmt.Errorf("invalid SNMP version %d: must be 1, 2 or 3", v)
}

// validateMAC returns an error if s is a non-empty string that isn't a valid MAC address.
func validateMAC(s string) error {
	if s == "" {
		return nil
	}
	if _, err := net.ParseMAC(s); err != nil {
		return fmt.Errorf("invalid MAC address: %q", s)
	}
	return nil
}

// validateStringLen returns an error if s exceeds maxLen characters.
func validateStringLen(field, s string, maxLen int) error {
	if len(strings.TrimSpace(s)) > maxLen {
		return fmt.Errorf("%s exceeds maximum length of %d characters", field, maxLen)
	}
	return nil
}

package snmp

import (
	"context"
	"fmt"
	"log/slog"
)

// WalkResult contains the result of an SNMP walk operation.
type WalkResult struct {
	OID   string
	Value interface{}
}

// Walker performs SNMP walk operations for device discovery and inventory.
type Walker struct {
	client SNMPClient
}

// NewWalker creates a new Walker.
func NewWalker(client SNMPClient) *Walker {
	return &Walker{client: client}
}

// DiscoverInterfaces walks the interface table and returns interface names with their indices.
func (w *Walker) DiscoverInterfaces(ctx context.Context, target, community string, version SNMPVersion) (map[int]string, error) {
	results, err := w.client.Walk(ctx, target, community, version, OIDIfDescr)
	if err != nil {
		return nil, fmt.Errorf("walk interfaces on %s: %w", target, err)
	}

	interfaces := make(map[int]string)
	baseLen := len("." + OIDIfDescr + ".")

	for oid, val := range results {
		if len(oid) <= baseLen {
			continue
		}
		var idx int
		if _, err := fmt.Sscanf(oid[baseLen-1:], ".%d", &idx); err != nil {
			slog.Debug("failed to parse interface index", "oid", oid, "error", err)
			continue
		}
		if name, ok := val.(string); ok {
			interfaces[idx] = name
		}
	}

	return interfaces, nil
}

// GetInterfaceStatus walks interface operational status.
// Returns a map of interface index to status (1=up, 2=down, 3=testing).
func (w *Walker) GetInterfaceStatus(ctx context.Context, target, community string, version SNMPVersion) (map[int]int, error) {
	results, err := w.client.Walk(ctx, target, community, version, OIDIfOperStatus)
	if err != nil {
		return nil, fmt.Errorf("walk interface status on %s: %w", target, err)
	}

	statuses := make(map[int]int)
	baseLen := len("." + OIDIfOperStatus + ".")

	for oid, val := range results {
		if len(oid) <= baseLen {
			continue
		}
		var idx int
		if _, err := fmt.Sscanf(oid[baseLen-1:], ".%d", &idx); err != nil {
			continue
		}
		if status, ok := val.(int64); ok {
			statuses[idx] = int(status)
		}
	}

	return statuses, nil
}

// GetSystemInfo retrieves common system information OIDs.
func (w *Walker) GetSystemInfo(ctx context.Context, target, community string, version SNMPVersion) (map[string]string, error) {
	oids := []string{
		OIDSysDescr,
		OIDSysName,
	}

	results, err := w.client.GetMultiple(ctx, target, community, version, oids)
	if err != nil {
		return nil, fmt.Errorf("get system info from %s: %w", target, err)
	}

	info := make(map[string]string)
	for oid, val := range results {
		if s, ok := val.(string); ok {
			info[oid] = s
		}
	}

	return info, nil
}

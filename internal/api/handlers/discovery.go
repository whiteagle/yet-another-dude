package handlers

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/whiteagle/yet-another-dude/internal/db"
	"github.com/whiteagle/yet-another-dude/internal/discovery"
	"github.com/whiteagle/yet-another-dude/internal/snmp"
)

// DiscoveryHandler handles network discovery operations.
type DiscoveryHandler struct {
	database *db.DB
	scanner  *discovery.Scanner
	poller   *snmp.Poller
}

// NewDiscoveryHandler creates a new DiscoveryHandler.
func NewDiscoveryHandler(database *db.DB, scanner *discovery.Scanner, poller *snmp.Poller) *DiscoveryHandler {
	return &DiscoveryHandler{database: database, scanner: scanner, poller: poller}
}

// ScanRequest is the request body for starting a discovery scan.
type ScanRequest struct {
	CIDR          string `json:"cidr"           binding:"required"`
	SNMPCommunity string `json:"snmp_community"`
	SNMPVersion   int    `json:"snmp_version"` // 1, 2 (v2c), or 3; defaults to 2
}

// Scan starts a network discovery scan and returns immediately.
// Discovered hosts are saved to the database in the background.
func (h *DiscoveryHandler) Scan(c *gin.Context) {
	var req ScanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateCIDR(req.CIDR); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.SNMPCommunity != "" {
		if err := validateStringLen("snmp_community", req.SNMPCommunity, 256); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}
	if err := validateSNMPVersion(req.SNMPVersion); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	community := req.SNMPCommunity
	if community == "" {
		community = "public"
	}
	snmpVer := snmp.SNMPVersion(req.SNMPVersion)
	if req.SNMPVersion == 0 {
		snmpVer = snmp.SNMPv2c
	}

	// Use a background context for the scan — the gin request context is
	// cancelled as soon as the handler returns (which happens immediately),
	// and we don't want that to abort the ongoing background scan.
	bgCtx := context.Background()

	results, err := h.scanner.Scan(bgCtx, req.CIDR)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
		return
	}

	go func() {
		for result := range results {
			if !result.Alive {
				continue
			}
			slog.Info("discovered host", "ip", result.IP, "rtt", result.RTT)

			info, err := h.poller.GetDeviceInfo(bgCtx, result.IP, community, snmpVer)
			if err != nil {
				slog.Debug("snmp device info unavailable during discovery", "ip", result.IP, "error", err)
			}

			now := time.Now()
			dev := db.Device{
				ID:            uuid.New().String(),
				Name:          result.IP,
				IP:            result.IP,
				SNMPCommunity: community,
				SNMPVersion:   int(snmpVer),
				Status:        db.DeviceStatusUp,
				Type:          db.DeviceTypeUnknown,
				LastSeen:      &now,
				ParentIDs:     []string{},
				CreatedAt:     now,
			}
			if info != nil {
				if info.SysName != "" {
					dev.Name = info.SysName
				}
				dev.Vendor = info.Vendor
				dev.IsRouterOS = info.Vendor == "MikroTik"
			}

			if err := h.database.CreateDevice(bgCtx, dev); err != nil {
				slog.Debug("skip discovered host", "ip", result.IP, "reason", err)
			}
		}
	}()

	c.JSON(http.StatusAccepted, gin.H{"message": "scan started", "cidr": req.CIDR})
}

// Status returns the current scan status.
func (h *DiscoveryHandler) Status(c *gin.Context) {
	c.JSON(http.StatusOK, h.scanner.Status())
}

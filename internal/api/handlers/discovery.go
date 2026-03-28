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
	community := req.SNMPCommunity
	if community == "" {
		community = "public"
	}

	results, err := h.scanner.Scan(c.Request.Context(), req.CIDR)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
		return
	}

	// Use a background context — the gin request context is cancelled as soon
	// as the handler returns (which is intentional: we respond immediately).
	bgCtx := context.Background()

	go func() {
		for result := range results {
			if !result.Alive {
				continue
			}
			slog.Info("discovered host", "ip", result.IP, "rtt", result.RTT)

			info, _ := h.poller.GetDeviceInfo(bgCtx, result.IP, community, snmp.SNMPv2c)

			now := time.Now()
			dev := db.Device{
				ID:            uuid.New().String(),
				Name:          result.IP,
				IP:            result.IP,
				SNMPCommunity: community,
				SNMPVersion:   2,
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

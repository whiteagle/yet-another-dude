package handlers

import (
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
	return &DiscoveryHandler{
		database: database,
		scanner:  scanner,
		poller:   poller,
	}
}

// ScanRequest is the request body for starting a discovery scan.
type ScanRequest struct {
	CIDR          string `json:"cidr" binding:"required"`
	SNMPCommunity string `json:"snmp_community"`
}

// Scan starts a network discovery scan.
func (h *DiscoveryHandler) Scan(c *gin.Context) {
	var req ScanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	community := req.SNMPCommunity
	if community == "" {
		community = "public"
	}

	results, err := h.scanner.Scan(c.Request.Context(), req.CIDR)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}

	// Process results in background
	go func() {
		for result := range results {
			if !result.Alive {
				continue
			}

			slog.Info("discovered host", "ip", result.IP, "rtt", result.RTT)

			// Try SNMP to get device info
			info, err := h.poller.GetDeviceInfo(c, result.IP, community, snmp.SNMPv2c)

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
			}

			if err == nil && info != nil {
				if info.SysName != "" {
					dev.Name = info.SysName
				}
				dev.Vendor = info.Vendor
			}

			if err := h.database.CreateDevice(c, dev); err != nil {
				slog.Debug("device already exists or insert failed", "ip", result.IP, "error", err)
			}
		}
	}()

	c.JSON(http.StatusAccepted, gin.H{
		"message": "scan started",
		"cidr":    req.CIDR,
	})
}

// Status returns the current scan status.
func (h *DiscoveryHandler) Status(c *gin.Context) {
	status := h.scanner.Status()
	c.JSON(http.StatusOK, status)
}

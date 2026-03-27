// Package handlers implements the HTTP request handlers for the YAD API.
package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/whiteagle/yet-another-dude/internal/db"
)

// DeviceHandler handles device CRUD operations.
type DeviceHandler struct {
	database *db.DB
}

// NewDeviceHandler creates a new DeviceHandler.
func NewDeviceHandler(database *db.DB) *DeviceHandler {
	return &DeviceHandler{database: database}
}

// CreateDeviceRequest is the request body for creating a device.
type CreateDeviceRequest struct {
	Name          string  `json:"name" binding:"required"`
	IP            string  `json:"ip" binding:"required"`
	MAC           string  `json:"mac"`
	Type          string  `json:"type"`
	SNMPCommunity string  `json:"snmp_community"`
	SNMPVersion   int     `json:"snmp_version"`
	Username      string  `json:"username"`
	Password      string  `json:"password"`
	IsRouterOS    bool    `json:"is_routeros"`
	Notes         string  `json:"notes"`
}

// UpdateDeviceRequest is the request body for updating a device.
type UpdateDeviceRequest struct {
	Name          string   `json:"name"`
	IP            string   `json:"ip"`
	MAC           string   `json:"mac"`
	Type          string   `json:"type"`
	SNMPCommunity string   `json:"snmp_community"`
	SNMPVersion   int      `json:"snmp_version"`
	Username      string   `json:"username"`
	IsRouterOS    bool     `json:"is_routeros"`
	Notes         string   `json:"notes"`
	Status        string   `json:"status"`
}

// List returns all devices.
func (h *DeviceHandler) List(c *gin.Context) {
	devices, err := h.database.ListDevices(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if devices == nil {
		devices = []db.Device{}
	}
	c.JSON(http.StatusOK, devices)
}

// Get returns a single device by ID.
func (h *DeviceHandler) Get(c *gin.Context) {
	id := c.Param("id")
	device, err := h.database.GetDevice(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if device == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
		return
	}
	c.JSON(http.StatusOK, device)
}

// Create adds a new device.
func (h *DeviceHandler) Create(c *gin.Context) {
	var req CreateDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	now := time.Now()
	device := db.Device{
		ID:            uuid.New().String(),
		Name:          req.Name,
		IP:            req.IP,
		MAC:           req.MAC,
		Type:          db.DeviceType(req.Type),
		SNMPCommunity: req.SNMPCommunity,
		SNMPVersion:   req.SNMPVersion,
		Username:      req.Username,
		IsRouterOS:    req.IsRouterOS,
		Notes:         req.Notes,
		Status:        db.DeviceStatusUnknown,
		ParentIDs:     []string{},
		CreatedAt:     now,
	}

	if device.SNMPCommunity == "" {
		device.SNMPCommunity = "public"
	}
	if device.SNMPVersion == 0 {
		device.SNMPVersion = 2
	}
	if device.Type == "" {
		device.Type = db.DeviceTypeUnknown
	}

	if err := h.database.CreateDevice(c.Request.Context(), device); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, device)
}

// Update modifies an existing device.
func (h *DeviceHandler) Update(c *gin.Context) {
	id := c.Param("id")

	existing, err := h.database.GetDevice(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if existing == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
		return
	}

	var req UpdateDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Name != "" {
		existing.Name = req.Name
	}
	if req.IP != "" {
		existing.IP = req.IP
	}
	if req.MAC != "" {
		existing.MAC = req.MAC
	}
	if req.Type != "" {
		existing.Type = db.DeviceType(req.Type)
	}
	if req.SNMPCommunity != "" {
		existing.SNMPCommunity = req.SNMPCommunity
	}
	if req.SNMPVersion != 0 {
		existing.SNMPVersion = req.SNMPVersion
	}
	if req.Username != "" {
		existing.Username = req.Username
	}
	if req.Notes != "" {
		existing.Notes = req.Notes
	}
	if req.Status != "" {
		existing.Status = db.DeviceStatus(req.Status)
	}

	if err := h.database.UpdateDevice(c.Request.Context(), *existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, existing)
}

// Delete removes a device.
func (h *DeviceHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.database.DeleteDevice(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": id})
}

// Ack acknowledges a device (sets status to acked).
func (h *DeviceHandler) Ack(c *gin.Context) {
	id := c.Param("id")
	if err := h.database.UpdateDeviceStatus(c.Request.Context(), id, db.DeviceStatusAcked, time.Now()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"acked": id})
}

// Package handlers implements the HTTP request handlers for the YAD API.
package handlers

import (
	"errors"
	"log/slog"
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
	Name          string `json:"name"  binding:"required,max=128"`
	IP            string `json:"ip"    binding:"required"`
	MAC           string `json:"mac"`
	Type          string `json:"type"`
	SNMPCommunity string `json:"snmp_community"`
	SNMPVersion   int    `json:"snmp_version"`
	Username      string `json:"username"`
	IsRouterOS    bool   `json:"is_routeros"`
	Notes         string `json:"notes"`
}

// UpdateDeviceRequest is the request body for updating a device.
type UpdateDeviceRequest struct {
	Name          string `json:"name"`
	IP            string `json:"ip"`
	MAC           string `json:"mac"`
	Type          string `json:"type"`
	SNMPCommunity string `json:"snmp_community"`
	SNMPVersion   int    `json:"snmp_version"`
	Username      string `json:"username"`
	IsRouterOS    bool   `json:"is_routeros"`
	Notes         string `json:"notes"`
	Status        string `json:"status"`
}

// List returns all devices.
func (h *DeviceHandler) List(c *gin.Context) {
	devices, err := h.database.ListDevices(c.Request.Context())
	if err != nil {
		internalError(c, "list devices", err)
		return
	}
	if devices == nil {
		devices = []db.Device{}
	}
	c.JSON(http.StatusOK, devices)
}

// Get returns a single device by ID.
func (h *DeviceHandler) Get(c *gin.Context) {
	device, err := h.database.GetDevice(c.Request.Context(), c.Param("id"))
	if err != nil {
		internalError(c, "get device", err)
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
	if err := validateIP(req.IP); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateMAC(req.MAC); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateSNMPVersion(req.SNMPVersion); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateStringLen("notes", req.Notes, 1024); err != nil {
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
		internalError(c, "create device", err)
		return
	}
	c.JSON(http.StatusCreated, device)
}

// Update modifies an existing device.
func (h *DeviceHandler) Update(c *gin.Context) {
	id := c.Param("id")
	existing, err := h.database.GetDevice(c.Request.Context(), id)
	if err != nil {
		internalError(c, "get device", err)
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

	if req.IP != "" {
		if err := validateIP(req.IP); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		existing.IP = req.IP
	}
	if req.MAC != "" {
		if err := validateMAC(req.MAC); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		existing.MAC = req.MAC
	}
	if req.SNMPVersion != 0 {
		if err := validateSNMPVersion(req.SNMPVersion); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		existing.SNMPVersion = req.SNMPVersion
	}
	if req.Notes != "" {
		if err := validateStringLen("notes", req.Notes, 1024); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		existing.Notes = req.Notes
	}
	if req.Name != "" {
		existing.Name = req.Name
	}
	if req.Type != "" {
		existing.Type = db.DeviceType(req.Type)
	}
	if req.SNMPCommunity != "" {
		existing.SNMPCommunity = req.SNMPCommunity
	}
	if req.Username != "" {
		existing.Username = req.Username
	}
	if req.Status != "" {
		existing.Status = db.DeviceStatus(req.Status)
	}
	// IsRouterOS is a bool — always apply it from the request
	existing.IsRouterOS = req.IsRouterOS

	if err := h.database.UpdateDevice(c.Request.Context(), *existing); err != nil {
		if errors.Is(err, db.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}
		internalError(c, "update device", err)
		return
	}
	c.JSON(http.StatusOK, existing)
}

// Delete removes a device.
func (h *DeviceHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.database.DeleteDevice(c.Request.Context(), id); err != nil {
		if errors.Is(err, db.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}
		internalError(c, "delete device", err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": id})
}

// Ack acknowledges a device alert (sets status to acked).
func (h *DeviceHandler) Ack(c *gin.Context) {
	id := c.Param("id")
	if err := h.database.UpdateDeviceStatus(c.Request.Context(), id, db.DeviceStatusAcked, time.Now()); err != nil {
		internalError(c, "ack device", err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"acked": id})
}

// internalError logs the error server-side and returns a generic 500 to the client.
// Never expose raw DB/internal errors to the client.
func internalError(c *gin.Context, op string, err error) {
	slog.Error("handler error", "op", op, "error", err,
		"method", c.Request.Method, "path", c.Request.URL.Path)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
}

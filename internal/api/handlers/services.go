package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/whiteagle/yet-another-dude/internal/db"
)

type ServiceHandler struct {
	database *db.DB
}

func NewServiceHandler(database *db.DB) *ServiceHandler {
	return &ServiceHandler{database: database}
}

type CreateServiceRequest struct {
	DeviceID  string `json:"device_id" binding:"required"`
	Probe     string `json:"probe" binding:"required"`
	ProbeType string `json:"probe_type"`
	Port      *int   `json:"port"`
	Notes     string `json:"notes"`
}

func (h *ServiceHandler) ListAll(c *gin.Context) {
	services, err := h.database.ListAllServices(c.Request.Context())
	if err != nil {
		internalError(c, "", err)
		return
	}
	if services == nil {
		services = []db.Service{}
	}
	c.JSON(http.StatusOK, services)
}

func (h *ServiceHandler) ListByDevice(c *gin.Context) {
	deviceID := c.Param("device_id")
	services, err := h.database.ListServicesByDevice(c.Request.Context(), deviceID)
	if err != nil {
		internalError(c, "", err)
		return
	}
	if services == nil {
		services = []db.Service{}
	}
	c.JSON(http.StatusOK, services)
}

func (h *ServiceHandler) Create(c *gin.Context) {
	var req CreateServiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	probeType := req.ProbeType
	if probeType == "" {
		probeType = "icmp"
	}

	svc := db.Service{
		ID:        uuid.New().String(),
		DeviceID:  req.DeviceID,
		Probe:     req.Probe,
		ProbeType: probeType,
		Port:      req.Port,
		Enabled:   true,
		Status:    db.ServiceStatusUnknown,
		Notes:     req.Notes,
	}

	if err := h.database.CreateService(c.Request.Context(), svc); err != nil {
		internalError(c, "", err)
		return
	}
	c.JSON(http.StatusCreated, svc)
}

func (h *ServiceHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.database.DeleteService(c.Request.Context(), id); err != nil {
		internalError(c, "", err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": id})
}

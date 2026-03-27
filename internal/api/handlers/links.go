package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/whiteagle/yet-another-dude/internal/db"
)

type LinkHandler struct {
	database *db.DB
}

func NewLinkHandler(database *db.DB) *LinkHandler {
	return &LinkHandler{database: database}
}

type CreateLinkRequest struct {
	DeviceID      string  `json:"device_id" binding:"required"`
	PeerDeviceID  *string `json:"peer_device_id"`
	InterfaceName string  `json:"interface_name"`
	LinkType      string  `json:"link_type"`
	SpeedMbps     *int    `json:"speed_mbps"`
}

func (h *LinkHandler) List(c *gin.Context) {
	links, err := h.database.ListLinks(c.Request.Context())
	if err != nil {
		internalError(c, "", err)
		return
	}
	if links == nil {
		links = []db.Link{}
	}
	c.JSON(http.StatusOK, links)
}

func (h *LinkHandler) Create(c *gin.Context) {
	var req CreateLinkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	lt := db.LinkType(req.LinkType)
	if lt == "" {
		lt = db.LinkTypeUnknown
	}

	link := db.Link{
		ID:            uuid.New().String(),
		DeviceID:      req.DeviceID,
		PeerDeviceID:  req.PeerDeviceID,
		InterfaceName: req.InterfaceName,
		MasteringType: "simple",
		LinkType:      lt,
		SpeedMbps:     req.SpeedMbps,
	}

	if err := h.database.CreateLink(c.Request.Context(), link); err != nil {
		internalError(c, "", err)
		return
	}
	c.JSON(http.StatusCreated, link)
}

func (h *LinkHandler) Delete(c *gin.Context) {
	id := c.Param("id")
	if err := h.database.DeleteLink(c.Request.Context(), id); err != nil {
		internalError(c, "", err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": id})
}

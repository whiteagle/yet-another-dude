package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/whiteagle/yet-another-dude/internal/db"
)

// TopologyHandler handles topology node position operations.
type TopologyHandler struct {
	database *db.DB
}

// NewTopologyHandler creates a new TopologyHandler.
func NewTopologyHandler(database *db.DB) *TopologyHandler {
	return &TopologyHandler{database: database}
}

// Get returns all topology node positions.
func (h *TopologyHandler) Get(c *gin.Context) {
	nodes, err := h.database.GetTopologyNodes(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if nodes == nil {
		nodes = []db.TopologyNode{}
	}
	c.JSON(http.StatusOK, nodes)
}

// SaveTopologyRequest is the request body for saving topology positions.
type SaveTopologyRequest struct {
	Nodes []db.TopologyNode `json:"nodes" binding:"required"`
}

// Save stores topology node positions.
func (h *TopologyHandler) Save(c *gin.Context) {
	var req SaveTopologyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.database.SaveTopologyNodes(c.Request.Context(), req.Nodes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"saved": len(req.Nodes)})
}

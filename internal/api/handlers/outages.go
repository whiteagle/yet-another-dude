package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/whiteagle/yet-another-dude/internal/db"
)

type OutageHandler struct {
	database *db.DB
}

func NewOutageHandler(database *db.DB) *OutageHandler {
	return &OutageHandler{database: database}
}

func (h *OutageHandler) List(c *gin.Context) {
	limit := 200
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			limit = n
		}
	}

	outages, err := h.database.ListOutages(c.Request.Context(), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if outages == nil {
		outages = []db.Outage{}
	}
	c.JSON(http.StatusOK, outages)
}

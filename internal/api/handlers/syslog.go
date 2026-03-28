package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/whiteagle/yet-another-dude/internal/db"
)

// SyslogHandler serves stored syslog messages.
type SyslogHandler struct {
	database *db.DB
}

// NewSyslogHandler creates a new SyslogHandler.
func NewSyslogHandler(database *db.DB) *SyslogHandler {
	return &SyslogHandler{database: database}
}

// List returns recent syslog messages, newest first.
// Optional query params:
//   - limit (default 500, max 1000)
//   - hostname (exact match filter)
func (h *SyslogHandler) List(c *gin.Context) {
	limit := 500
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			limit = n
		}
	}

	msgs, err := h.database.ListSyslogMessages(c.Request.Context(), limit)
	if err != nil {
		internalError(c, "list syslog messages", err)
		return
	}
	if msgs == nil {
		msgs = []db.SyslogMessage{}
	}
	c.JSON(http.StatusOK, msgs)
}

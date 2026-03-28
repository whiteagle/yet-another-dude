package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/whiteagle/yet-another-dude/internal/db"
)

type SettingsHandler struct{ db *db.DB }

func NewSettingsHandler(d *db.DB) *SettingsHandler { return &SettingsHandler{db: d} }

func (h *SettingsHandler) Get(c *gin.Context) {
	s, err := h.db.GetSettings(c.Request.Context())
	if err != nil {
		internalError(c, "database", err)
		return
	}
	c.JSON(http.StatusOK, s)
}

func (h *SettingsHandler) Save(c *gin.Context) {
	var s db.ServerSettings
	if err := c.ShouldBindJSON(&s); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Validate port fields
	for _, p := range []struct {
		name string
		port int
	}{
		{"server_port", s.ServerPort},
		{"server_secure_port", s.ServerSecurePort},
		{"web_port", s.WebPort},
		{"web_secure_port", s.WebSecurePort},
		{"syslog_port", s.SyslogPort},
		{"snmp_default_port", s.SNMPDefaultPort},
	} {
		if p.port != 0 {
			if err := validatePort(p.port); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": p.name + ": " + err.Error()})
				return
			}
		}
	}
	if err := h.db.SaveSettings(c.Request.Context(), s); err != nil {
		internalError(c, "save settings", err)
		return
	}
	c.JSON(http.StatusOK, s)
}

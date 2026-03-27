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
		internalError(c, "", err)
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
	if err := h.db.SaveSettings(c.Request.Context(), s); err != nil {
		internalError(c, "", err)
		return
	}
	c.JSON(http.StatusOK, s)
}

package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/whiteagle/yet-another-dude/internal/db"
)

// AlertHandler handles alert rule operations.
type AlertHandler struct {
	database *db.DB
}

// NewAlertHandler creates a new AlertHandler.
func NewAlertHandler(database *db.DB) *AlertHandler {
	return &AlertHandler{database: database}
}

// CreateAlertRequest is the request body for creating an alert rule.
type CreateAlertRequest struct {
	DeviceID      *string `json:"device_id"`
	Metric        string  `json:"metric" binding:"required"`
	Condition     string  `json:"condition" binding:"required,oneof=gt lt eq"`
	Threshold     float64 `json:"threshold" binding:"required"`
	NotifyEmail   string  `json:"notify_email"`
	NotifyWebhook string  `json:"notify_webhook"`
}

// ListRules returns all alert rules.
func (h *AlertHandler) ListRules(c *gin.Context) {
	rules, err := h.database.ListAlertRules(c.Request.Context())
	if err != nil {
		internalError(c, "database", err)
		return
	}
	if rules == nil {
		rules = []db.AlertRule{}
	}
	c.JSON(http.StatusOK, rules)
}

// CreateRule creates a new alert rule.
func (h *AlertHandler) CreateRule(c *gin.Context) {
	var req CreateAlertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := validateThreshold(req.Threshold); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.NotifyEmail != "" {
		if err := validateStringLen("notify_email", req.NotifyEmail, 254); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	rule := db.AlertRule{
		ID:            uuid.New().String(),
		DeviceID:      req.DeviceID,
		Metric:        req.Metric,
		Condition:     db.AlertCondition(req.Condition),
		Threshold:     req.Threshold,
		Enabled:       true,
		NotifyEmail:   req.NotifyEmail,
		NotifyWebhook: req.NotifyWebhook,
	}

	if err := h.database.CreateAlertRule(c.Request.Context(), rule); err != nil {
		internalError(c, "database", err)
		return
	}

	c.JSON(http.StatusCreated, rule)
}

// DeleteRule removes an alert rule by ID.
func (h *AlertHandler) DeleteRule(c *gin.Context) {
	id := c.Param("id")
	if _, err := uuid.Parse(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := h.database.DeleteAlertRule(c.Request.Context(), id); err != nil {
		if errors.Is(err, db.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "alert rule not found"})
			return
		}
		internalError(c, "database", err)
		return
	}
	c.Status(http.StatusNoContent)
}

// History returns recent alert events.
func (h *AlertHandler) History(c *gin.Context) {
	const maxLimit = 5000
	limit := 100
	if limitStr := c.Query("limit"); limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	if limit > maxLimit {
		limit = maxLimit
	}

	events, err := h.database.ListAlertHistory(c.Request.Context(), limit)
	if err != nil {
		internalError(c, "database", err)
		return
	}
	if events == nil {
		events = []db.AlertEvent{}
	}
	c.JSON(http.StatusOK, events)
}

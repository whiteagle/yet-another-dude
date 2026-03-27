package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/whiteagle/yet-another-dude/internal/db"
)

// MetricHandler handles metric queries.
type MetricHandler struct {
	database *db.DB
}

// NewMetricHandler creates a new MetricHandler.
func NewMetricHandler(database *db.DB) *MetricHandler {
	return &MetricHandler{database: database}
}

// Query returns metrics for a device within a time range.
// Query parameters:
//   - name: metric name filter (optional)
//   - from: start time in RFC3339 (default: 1 hour ago)
//   - to: end time in RFC3339 (default: now)
func (h *MetricHandler) Query(c *gin.Context) {
	deviceID := c.Param("device_id")
	metricName := c.Query("name")

	now := time.Now()
	from := now.Add(-1 * time.Hour)
	to := now

	if fromStr := c.Query("from"); fromStr != "" {
		parsed, err := time.Parse(time.RFC3339, fromStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid 'from' time format, use RFC3339"})
			return
		}
		from = parsed
	}

	if toStr := c.Query("to"); toStr != "" {
		parsed, err := time.Parse(time.RFC3339, toStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid 'to' time format, use RFC3339"})
			return
		}
		to = parsed
	}

	metrics, err := h.database.QueryMetrics(c.Request.Context(), deviceID, metricName, from, to)
	if err != nil {
		internalError(c, "", err)
		return
	}

	if metrics == nil {
		metrics = []db.Metric{}
	}

	c.JSON(http.StatusOK, metrics)
}

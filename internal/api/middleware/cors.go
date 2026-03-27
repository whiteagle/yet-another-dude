package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// DefaultCORSConfig returns the default CORS configuration.
func DefaultCORSConfig() cors.Config {
	return cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:8080"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "X-API-Key"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}
}

// StructuredLogger returns gin middleware that logs requests using slog.
func StructuredLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()

		attrs := []any{
			"method", c.Request.Method,
			"path", path,
			"status", status,
			"latency", latency,
			"ip", c.ClientIP(),
		}

		if status >= 500 {
			slog.Error("request", attrs...)
		} else if status >= 400 {
			slog.Warn("request", attrs...)
		} else {
			slog.Debug("request", attrs...)
		}
	}
}

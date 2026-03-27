// Package middleware provides HTTP middleware for the YAD API.
package middleware

import (
	"crypto/subtle"
	"net/http"

	"github.com/gin-gonic/gin"
)

// APIKeyAuth returns middleware that validates the X-API-Key header.
func APIKeyAuth(apiKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.GetHeader("X-API-Key")
		if key == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "missing API key",
			})
			return
		}

		if subtle.ConstantTimeCompare([]byte(key), []byte(apiKey)) != 1 {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "invalid API key",
			})
			return
		}

		c.Next()
	}
}

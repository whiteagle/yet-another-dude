// Package api provides the HTTP REST API server for YAD.
package api

import (
	"io"
	"io/fs"
	"net/http"
	"path/filepath"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"github.com/whiteagle/yet-another-dude/internal/api/handlers"
	"github.com/whiteagle/yet-another-dude/internal/api/middleware"
	"github.com/whiteagle/yet-another-dude/internal/db"
	"github.com/whiteagle/yet-another-dude/internal/discovery"
	"github.com/whiteagle/yet-another-dude/internal/snmp"
)

// ServerConfig holds the dependencies for the API server.
type ServerConfig struct {
	DB         *db.DB
	Scanner    *discovery.Scanner
	Poller     *snmp.Poller
	FrontendFS fs.FS
	APIKey     string
}

// Server is the HTTP API server.
type Server struct {
	cfg    ServerConfig
	router *gin.Engine
}

// NewServer creates and configures a new API server.
func NewServer(cfg ServerConfig) *Server {
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.RedirectTrailingSlash = false
	router.RedirectFixedPath = false
	router.Use(gin.Recovery())
	router.Use(middleware.StructuredLogger())
	router.Use(cors.New(middleware.DefaultCORSConfig()))

	s := &Server{cfg: cfg, router: router}
	s.setupRoutes()
	return s
}

// Router returns the gin engine for use with http.Server.
func (s *Server) Router() *gin.Engine {
	return s.router
}

func (s *Server) setupRoutes() {
	s.router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	v1 := s.router.Group("/api/v1")
	if s.cfg.APIKey != "" {
		v1.Use(middleware.APIKeyAuth(s.cfg.APIKey))
	}
	setupRoutes(v1, s.cfg)

	if s.cfg.FrontendFS != nil {
		serveIndex := func(c *gin.Context) {
			f, err := s.cfg.FrontendFS.Open("index.html")
			if err != nil {
				c.Status(http.StatusNotFound)
				return
			}
			defer f.Close()
			data, err := io.ReadAll(f)
			if err != nil {
				c.Status(http.StatusInternalServerError)
				return
			}
			c.Data(http.StatusOK, "text/html; charset=utf-8", data)
		}

		s.router.GET("/", serveIndex)
		s.router.NoRoute(func(c *gin.Context) {
			path := c.Request.URL.Path[1:] // strip leading /
			f, err := s.cfg.FrontendFS.Open(path)
			if err != nil {
				serveIndex(c)
				return
			}
			defer f.Close()
			data, err := io.ReadAll(f)
			if err != nil {
				c.Status(http.StatusInternalServerError)
				return
			}
			mime := mimeByExt(path)
			c.Data(http.StatusOK, mime, data)
		})
	}
}

func setupRoutes(rg *gin.RouterGroup, cfg ServerConfig) {
	// Devices
	dh := handlers.NewDeviceHandler(cfg.DB)
	rg.GET("/devices", dh.List)
	rg.POST("/devices", dh.Create)
	rg.GET("/devices/:id", dh.Get)
	rg.PUT("/devices/:id", dh.Update)
	rg.DELETE("/devices/:id", dh.Delete)
	rg.POST("/devices/:id/ack", dh.Ack)

	// Services
	sh := handlers.NewServiceHandler(cfg.DB)
	rg.GET("/services", sh.ListAll)
	rg.GET("/services/device/:device_id", sh.ListByDevice)
	rg.POST("/services", sh.Create)
	rg.DELETE("/services/:id", sh.Delete)

	// Links
	lh := handlers.NewLinkHandler(cfg.DB)
	rg.GET("/links", lh.List)
	rg.POST("/links", lh.Create)
	rg.DELETE("/links/:id", lh.Delete)

	// Outages
	oh := handlers.NewOutageHandler(cfg.DB)
	rg.GET("/outages", oh.List)

	// Discovery
	disc := handlers.NewDiscoveryHandler(cfg.DB, cfg.Scanner, cfg.Poller)
	rg.POST("/discovery/scan", disc.Scan)
	rg.GET("/discovery/status", disc.Status)

	// Metrics
	mh := handlers.NewMetricHandler(cfg.DB)
	rg.GET("/metrics/:device_id", mh.Query)

	// Topology
	th := handlers.NewTopologyHandler(cfg.DB)
	rg.GET("/topology", th.Get)
	rg.POST("/topology", th.Save)

	// Alerts
	ah := handlers.NewAlertHandler(cfg.DB)
	rg.GET("/alerts", ah.ListRules)
	rg.POST("/alerts", ah.CreateRule)
	rg.DELETE("/alerts/:id", ah.DeleteRule)
	rg.GET("/alerts/history", ah.History)

	// Settings
	seth := handlers.NewSettingsHandler(cfg.DB)
	rg.GET("/settings", seth.Get)
	rg.PUT("/settings", seth.Save)

	// Syslog
	sysh := handlers.NewSyslogHandler(cfg.DB)
	rg.GET("/syslog", sysh.List)
}

func mimeByExt(path string) string {
	switch filepath.Ext(path) {
	case ".html":
		return "text/html; charset=utf-8"
	case ".js":
		return "application/javascript"
	case ".css":
		return "text/css"
	case ".svg":
		return "image/svg+xml"
	case ".png":
		return "image/png"
	case ".ico":
		return "image/x-icon"
	case ".json":
		return "application/json"
	default:
		return "application/octet-stream"
	}
}

package api

// Routes are configured in server.go setupRoutes().
// This file serves as documentation for the REST API.
//
// API Endpoints:
//
//	GET    /api/v1/devices                    List all devices
//	POST   /api/v1/devices                    Create a device
//	GET    /api/v1/devices/:id                Get device details
//	PUT    /api/v1/devices/:id                Update a device
//	DELETE /api/v1/devices/:id                Delete a device
//	POST   /api/v1/devices/:id/ack            Acknowledge a device
//
//	GET    /api/v1/services                   List all services
//	GET    /api/v1/devices/:id/services       List services for a device
//	POST   /api/v1/services                   Create a service
//	DELETE /api/v1/services/:id               Delete a service
//
//	GET    /api/v1/links                      List all links
//	POST   /api/v1/links                      Create a link
//	DELETE /api/v1/links/:id                  Delete a link
//
//	GET    /api/v1/outages                    List outages (?limit=N)
//
//	POST   /api/v1/discovery/scan             Start a network scan
//	GET    /api/v1/discovery/status           Get scan status
//
//	GET    /api/v1/metrics/:device_id         Query device metrics
//
//	GET    /api/v1/topology                   Get topology node positions
//	POST   /api/v1/topology                   Save topology node positions
//
//	GET    /api/v1/alerts                     List alert rules
//	POST   /api/v1/alerts                     Create an alert rule
//	GET    /api/v1/alerts/history             Get alert history

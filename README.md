# Yet Another Dude

[![CI](https://github.com/whiteagle/yet-another-dude/actions/workflows/ci.yml/badge.svg)](https://github.com/whiteagle/yet-another-dude/actions/workflows/ci.yml)
[![Go](https://img.shields.io/badge/go-1.22+-blue)](https://golang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Yet Another Dude (YAD)** is an open-source network monitoring tool inspired by MikroTik's The Dude — which was discontinued in March 2026.

YAD gives you a visual topology map of your network, SNMP-based device monitoring, service health checks, outage history, and a full preferences system — all inside a single self-contained binary with a Windows XP–style UI that will feel immediately familiar to anyone who used The Dude.

---

## Features

- **Topology map** — drag-and-drop network map with live device status colours
- **Auto-discovery** — ICMP scan a CIDR range, SNMP-enrich discovered hosts
- **Device management** — 17 device types (MikroTik, router, switch, camera, …)
- **Service monitoring** — per-device service checks (ping, TCP, HTTP, SNMP, …)
- **Outage history** — automatic outage log with start/end times
- **Alert rules** — threshold-based alerts on any SNMP metric
- **Full Preferences dialog** — 13 tabs matching The Dude's settings exactly
- **Single binary** — Go backend + embedded React frontend, zero dependencies
- **Desktop client** — native Wails app that connects to a remote YAD server
- **Optional API key auth** — secure with `--api-key` when exposing to untrusted networks

---

## Quickstart

### Option A — Download a binary

```bash
# Linux / macOS
curl -LO https://github.com/whiteagle/yet-another-dude/releases/latest/download/yad-linux-amd64
chmod +x yad-linux-amd64
./yad-linux-amd64
```

Open **http://localhost:8080** in your browser.

### Option B — Build from source

```bash
git clone https://github.com/whiteagle/yet-another-dude.git
cd yet-another-dude
make build          # builds frontend + Go binary
./yad               # starts on :8080
```

Requirements: Go 1.22+, Node 20+, npm.

---

## CLI flags

```
./yad [flags]

  --listen    string   address to listen on          (default ":8080")
  --db        string   SQLite database path           (default "yad.db")
  --api-key   string   require X-API-Key header       (default "" = no auth)
  --log-level string   debug | info | warn | error    (default "info")
```

### Example with API key

```bash
./yad --listen :8765 --db /var/lib/yad/yad.db --api-key "$(pwgen -s 32 1)"
```

---

## MikroTik RouterOS — Running as a container

YAD can run directly on a MikroTik router as a RouterOS container package.
See [`containers/routeros/`](containers/routeros/) for the Dockerfile and deployment guide.

---

## Desktop client (Windows / macOS / Linux)

The **YAD Client** is a Wails native app that connects to any YAD server via HTTP.
It stores server profiles (name, address, port, API key) locally and opens the
full YAD web UI in an embedded webview once connected.

```bash
cd yad-client
wails build
```

Download pre-built binaries from the [Releases](https://github.com/whiteagle/yet-another-dude/releases) page.

---

## API

All API endpoints are under `/api/v1/`. If `--api-key` is set, every request
must include the header `X-API-Key: <your-key>`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/devices` | List all devices |
| POST | `/api/v1/devices` | Create device |
| GET | `/api/v1/devices/:id` | Get device |
| PUT | `/api/v1/devices/:id` | Update device |
| DELETE | `/api/v1/devices/:id` | Delete device |
| POST | `/api/v1/devices/:id/ack` | Acknowledge device alert |
| GET | `/api/v1/services` | List all services |
| GET | `/api/v1/services/device/:id` | Services for one device |
| POST | `/api/v1/services` | Create service |
| DELETE | `/api/v1/services/:id` | Delete service |
| GET | `/api/v1/links` | List topology links |
| POST | `/api/v1/links` | Create link |
| DELETE | `/api/v1/links/:id` | Delete link |
| GET | `/api/v1/outages` | List outages (`?limit=N`) |
| POST | `/api/v1/discovery/scan` | Start CIDR scan |
| GET | `/api/v1/discovery/status` | Scan status |
| GET | `/api/v1/topology` | Topology node positions |
| POST | `/api/v1/topology` | Save topology layout |
| GET | `/api/v1/metrics/:device_id` | Query SNMP metrics |
| GET | `/api/v1/alerts` | List alert rules |
| POST | `/api/v1/alerts` | Create alert rule |
| GET | `/api/v1/alerts/history` | Alert event history |
| GET | `/api/v1/settings` | Get server settings |
| PUT | `/api/v1/settings` | Save server settings |
| GET | `/health` | Health check |

---

## Development

```bash
# Run backend + frontend dev servers separately
make dev-backend      # go run ./cmd/yad  →  :8080
make dev-frontend     # vite dev server   →  :5173

# Tests
make test             # Go tests (race detector)
make test-frontend    # Vitest

# Cross-compile for all platforms
make release
# Outputs: dist/yad-linux-amd64, yad-linux-arm64,
#          yad-darwin-amd64, yad-darwin-arm64,
#          yad-windows-amd64.exe
```

### Project structure

```
yet-another-dude/
├── cmd/yad/              # main entry point + CLI flags
├── internal/
│   ├── alerts/           # alert rules engine + notifiers
│   ├── api/
│   │   ├── handlers/     # HTTP handlers (devices, services, discovery …)
│   │   └── middleware/   # CORS, API key auth, structured logging
│   ├── db/               # SQLite schema, migrations, queries
│   ├── discovery/        # ICMP scanner
│   ├── frontend/         # embedded React dist (go:embed)
│   └── snmp/             # SNMP poller + collector
├── web/                  # React + Vite + TypeScript frontend
│   └── src/
│       ├── api/          # API client (typed fetch wrappers)
│       ├── components/   # Shared UI components
│       ├── pages/        # Route-level pages
│       └── test/         # Vitest tests
└── yad-client/           # Wails desktop client
```

---

## Security

YAD is designed for trusted private networks (like The Dude was).

- Enable API key auth with `--api-key` when exposing to less-trusted networks
- The API key is transmitted as an HTTP header — use HTTPS (reverse proxy, e.g. nginx/Caddy) if your network path is untrusted
- SNMP community strings are stored in the SQLite database at rest — protect the database file (`chmod 600 yad.db`)
- All HTTP 500 errors are logged server-side with full detail; only a generic message is returned to clients

---

## Comparison with The Dude

| Feature | The Dude | YAD |
|---------|----------|-----|
| Network topology map | ✅ | ✅ |
| ICMP/SNMP discovery | ✅ | ✅ |
| Device types (17) | ✅ | ✅ |
| Service checks | ✅ | ✅ |
| Outage history | ✅ | ✅ |
| Preferences dialog (13 tabs) | ✅ | ✅ |
| Alert rules | ✅ | ✅ |
| Desktop client | ✅ | ✅ |
| Runs on RouterOS | ✅ | ✅ |
| Web UI (no client needed) | ❌ | ✅ |
| Open source | ❌ | ✅ |
| Linux / macOS | ❌ | ✅ |
| Single binary | ❌ | ✅ |
| Email notifications | ✅ | ✅ |
| Syslog server | ✅ | ✅ |

✅ Done · 🚧 In progress

---

## License

MIT — see [LICENSE](LICENSE).

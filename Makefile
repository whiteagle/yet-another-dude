.PHONY: all build frontend backend test test-frontend lint release clean \
        dev-backend dev-frontend release-linux release-macos release-windows

BINARY  := yad
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS := -ldflags "-s -w -X main.Version=$(VERSION)"
DIST    := dist

all: build

## frontend: Build React frontend and copy into the Go embed path
frontend:
	cd web && npm ci --prefer-offline && npm run build
	rm -rf internal/frontend/dist
	cp -r web/dist internal/frontend/dist

## backend: Compile Go binary (frontend must be built first)
backend:
	go build $(LDFLAGS) -o $(BINARY) ./cmd/yad

## build: Full build — frontend + backend
build: frontend backend

## test: Run Go unit tests with race detector
test:
	go test ./internal/... -race -count=1

## test-frontend: Run React/Vitest tests
test-frontend:
	cd web && npm test

## lint: Run Go linter (requires golangci-lint)
lint:
	golangci-lint run ./...

## release: Cross-compile binaries for all platforms into dist/
release: frontend release-linux release-macos release-windows

release-linux:
	mkdir -p $(DIST)
	GOOS=linux  GOARCH=amd64 go build $(LDFLAGS) -o $(DIST)/yad-linux-amd64   ./cmd/yad
	GOOS=linux  GOARCH=arm64 go build $(LDFLAGS) -o $(DIST)/yad-linux-arm64   ./cmd/yad

release-macos:
	mkdir -p $(DIST)
	GOOS=darwin GOARCH=amd64 go build $(LDFLAGS) -o $(DIST)/yad-darwin-amd64  ./cmd/yad
	GOOS=darwin GOARCH=arm64 go build $(LDFLAGS) -o $(DIST)/yad-darwin-arm64  ./cmd/yad

release-windows:
	mkdir -p $(DIST)
	GOOS=windows GOARCH=amd64 go build $(LDFLAGS) -o $(DIST)/yad-windows-amd64.exe ./cmd/yad

## dev-backend: Run Go backend in dev mode (connects to Vite dev server)
dev-backend:
	go run ./cmd/yad -db yad-dev.db

## dev-frontend: Run Vite dev server
dev-frontend:
	cd web && npm run dev

## clean: Remove all build artifacts
clean:
	rm -f $(BINARY)
	rm -rf web/dist internal/frontend/dist $(DIST)

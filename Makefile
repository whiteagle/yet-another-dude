.PHONY: all build frontend backend test clean dev

BINARY := yad
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS := -ldflags "-X main.Version=$(VERSION)"

all: build

## frontend: Build React frontend and copy to embed location
frontend:
	cd web && npm install && npm run build
	rm -rf internal/frontend/dist
	cp -r web/dist internal/frontend/dist

## backend: Build Go binary (requires frontend to be built first)
backend:
	go build $(LDFLAGS) -o $(BINARY) ./cmd/yad

## build: Build frontend then binary
build: frontend backend

## test: Run all Go unit tests
test:
	go test ./internal/... -v -race

## lint: Run Go linter
lint:
	golangci-lint run ./...

## dev: Run frontend dev server + Go backend (separate terminals needed)
dev-backend:
	go run ./cmd/yad -db yad-dev.db

dev-frontend:
	cd web && npm run dev

## clean: Remove build artifacts
clean:
	rm -f $(BINARY)
	rm -rf web/dist
	rm -rf internal/frontend/dist

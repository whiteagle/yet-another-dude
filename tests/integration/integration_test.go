//go:build integration

package integration

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"
)

var baseURL string

func TestMain(m *testing.M) {
	baseURL = os.Getenv("YAD_URL")
	if baseURL == "" {
		baseURL = "http://localhost:8080"
	}

	// Wait for server to be ready
	for range 30 {
		resp, err := http.Get(baseURL + "/health")
		if err == nil && resp.StatusCode == 200 {
			resp.Body.Close()
			break
		}
		time.Sleep(time.Second)
	}

	os.Exit(m.Run())
}

func TestHealthEndpoint(t *testing.T) {
	resp, err := http.Get(baseURL + "/health")
	if err != nil {
		t.Fatalf("health check failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Errorf("health status = %d, want 200", resp.StatusCode)
	}
}

func TestDeviceCRUD(t *testing.T) {
	// Create
	body := `{"name":"test-router","ip":"10.99.99.1","type":"router","snmp_community":"public"}`
	resp, err := http.Post(baseURL+"/api/v1/devices", "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatalf("create device: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 201 {
		t.Fatalf("create status = %d, want 201", resp.StatusCode)
	}

	var device map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&device)
	deviceID := device["id"].(string)

	// Read
	resp, err = http.Get(baseURL + "/api/v1/devices/" + deviceID)
	if err != nil {
		t.Fatalf("get device: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Errorf("get status = %d, want 200", resp.StatusCode)
	}

	// List
	resp, err = http.Get(baseURL + "/api/v1/devices")
	if err != nil {
		t.Fatalf("list devices: %v", err)
	}
	defer resp.Body.Close()

	var devices []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&devices)
	if len(devices) < 1 {
		t.Error("expected at least 1 device in list")
	}

	// Delete
	req, _ := http.NewRequest("DELETE", baseURL+"/api/v1/devices/"+deviceID, nil)
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("delete device: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		t.Errorf("delete status = %d, want 200", resp.StatusCode)
	}
}

func TestDiscoveryScan(t *testing.T) {
	body := `{"cidr":"10.99.99.0/30"}`
	resp, err := http.Post(baseURL+"/api/v1/discovery/scan", "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatalf("start scan: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 202 {
		t.Errorf("scan status = %d, want 202", resp.StatusCode)
	}

	// Check status
	resp, err = http.Get(baseURL + "/api/v1/discovery/status")
	if err != nil {
		t.Fatalf("get scan status: %v", err)
	}
	defer resp.Body.Close()

	var status map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&status)

	fmt.Printf("scan status: %+v\n", status)
}

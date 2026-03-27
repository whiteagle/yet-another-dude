import type {
  Device,
  Service,
  Link,
  Outage,
  Metric,
  TopologyNode,
  AlertRule,
  AlertEvent,
  ScanStatus,
  ServerSettings,
  CreateDeviceRequest,
  CreateAlertRequest,
  ScanRequest,
} from '../types/api'

const API_BASE = '/api/v1'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

// Devices
export async function listDevices(): Promise<Device[]> {
  return request<Device[]>('/devices')
}

export async function getDevice(id: string): Promise<Device> {
  return request<Device>(`/devices/${id}`)
}

export async function createDevice(data: CreateDeviceRequest): Promise<Device> {
  return request<Device>('/devices', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateDevice(id: string, data: Partial<CreateDeviceRequest>): Promise<Device> {
  return request<Device>(`/devices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteDevice(id: string): Promise<void> {
  await request(`/devices/${id}`, { method: 'DELETE' })
}

export async function ackDevice(id: string): Promise<void> {
  await request(`/devices/${id}/ack`, { method: 'POST' })
}

// Services
export async function listServices(): Promise<Service[]> {
  return request<Service[]>('/services')
}

export async function listDeviceServices(deviceId: string): Promise<Service[]> {
  return request<Service[]>(`/services/device/${deviceId}`)
}

export async function createService(data: { device_id: string; probe: string; probe_type?: string; port?: number; notes?: string }): Promise<Service> {
  return request<Service>('/services', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteService(id: string): Promise<void> {
  await request(`/services/${id}`, { method: 'DELETE' })
}

// Links
export async function listLinks(): Promise<Link[]> {
  return request<Link[]>('/links')
}

export async function createLink(data: { device_id: string; peer_device_id?: string; interface_name?: string; link_type?: string; speed_mbps?: number }): Promise<Link> {
  return request<Link>('/links', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteLink(id: string): Promise<void> {
  await request(`/links/${id}`, { method: 'DELETE' })
}

// Outages
export async function listOutages(limit?: number): Promise<Outage[]> {
  const q = limit ? `?limit=${limit}` : ''
  return request<Outage[]>(`/outages${q}`)
}

// Discovery
export async function startScan(data: ScanRequest): Promise<{ message: string; cidr: string }> {
  return request('/discovery/scan', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getScanStatus(): Promise<ScanStatus> {
  return request<ScanStatus>('/discovery/status')
}

// Metrics
export async function getMetrics(
  deviceId: string,
  params?: { name?: string; from?: string; to?: string }
): Promise<Metric[]> {
  const searchParams = new URLSearchParams()
  if (params?.name) searchParams.set('name', params.name)
  if (params?.from) searchParams.set('from', params.from)
  if (params?.to) searchParams.set('to', params.to)

  const query = searchParams.toString()
  return request<Metric[]>(`/metrics/${deviceId}${query ? `?${query}` : ''}`)
}

// Topology
export async function getTopology(): Promise<TopologyNode[]> {
  return request<TopologyNode[]>('/topology')
}

export async function saveTopology(nodes: TopologyNode[]): Promise<void> {
  await request('/topology', {
    method: 'POST',
    body: JSON.stringify({ nodes }),
  })
}

// Alerts
export async function listAlertRules(): Promise<AlertRule[]> {
  return request<AlertRule[]>('/alerts')
}

export async function createAlertRule(data: CreateAlertRequest): Promise<AlertRule> {
  return request<AlertRule>('/alerts', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getAlertHistory(limit?: number): Promise<AlertEvent[]> {
  const query = limit ? `?limit=${limit}` : ''
  return request<AlertEvent[]>(`/alerts/history${query}`)
}

// Settings
export async function getSettings(): Promise<ServerSettings> {
  return request<ServerSettings>('/settings')
}

export async function saveSettings(s: ServerSettings): Promise<ServerSettings> {
  return request<ServerSettings>('/settings', { method: 'PUT', body: JSON.stringify(s) })
}

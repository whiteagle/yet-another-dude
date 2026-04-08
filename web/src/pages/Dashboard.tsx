import { useEffect, useState } from 'react'
import { Server, Wifi, WifiOff, AlertTriangle } from 'lucide-react'
import { listDevices, getAlertHistory } from '../api/client'
import type { Device, AlertEvent } from '../types/api'
import AlertPanel from '../components/AlertPanel'

export default function Dashboard() {
  const [devices, setDevices] = useState<Device[]>([])
  const [alerts, setAlerts] = useState<AlertEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [devs, alertHistory] = await Promise.all([
          listDevices(),
          getAlertHistory(20),
        ])
        setDevices(devs)
        setAlerts(alertHistory)
      } catch (err) {
        console.error('Failed to load dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse" style={{ color: 'var(--text-muted)' }}>Loading...</div>
      </div>
    )
  }

  const upCount = devices.filter((d) => d.status === 'up').length
  const downCount = devices.filter((d) => d.status === 'down').length

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard</h2>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Server className="w-5 h-5" />}
          label="Total Devices"
          value={devices.length}
          color="var(--accent)"
        />
        <StatCard
          icon={<Wifi className="w-5 h-5" />}
          label="Online"
          value={upCount}
          color="var(--status-up)"
        />
        <StatCard
          icon={<WifiOff className="w-5 h-5" />}
          label="Offline"
          value={downCount}
          color="var(--status-down)"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Alerts (24h)"
          value={alerts.length}
          color="var(--status-partial)"
        />
      </div>

      {/* Recent alerts */}
      <div className="rounded-lg p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Recent Alerts</h3>
        <AlertPanel alerts={alerts} />
      </div>

      {/* Device status table */}
      <div className="rounded-lg p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Device Status</h3>
        {devices.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No devices yet. Start a discovery scan or add devices manually.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                <th className="text-left py-2">Name</th>
                <th className="text-left py-2">IP</th>
                <th className="text-left py-2">Vendor</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((dev) => (
                <tr
                  key={dev.id}
                  className="hover:opacity-80"
                  style={{ borderBottom: '1px solid var(--border-muted)' }}
                >
                  <td className="py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{dev.name}</td>
                  <td className="py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>{dev.ip}</td>
                  <td className="py-2" style={{ color: 'var(--text-secondary)' }}>{dev.vendor || '-'}</td>
                  <td className="py-2">
                    <StatusBadge status={dev.status} />
                  </td>
                  <td className="py-2" style={{ color: 'var(--text-muted)' }}>
                    {dev.last_seen ? new Date(dev.last_seen).toLocaleString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}) {
  return (
    <div className="rounded-lg p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-2" style={{ color }}>
        {icon}
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <div className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colorVar: Record<string, string> = {
    up: 'var(--status-up)',
    down: 'var(--status-down)',
    unknown: 'var(--status-unknown)',
  }
  const c = colorVar[status] || colorVar.unknown
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-medium"
      style={{
        background: `color-mix(in srgb, ${c} 10%, transparent)`,
        color: c,
      }}
    >
      {status}
    </span>
  )
}

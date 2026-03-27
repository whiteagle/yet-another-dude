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
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    )
  }

  const upCount = devices.filter((d) => d.status === 'up').length
  const downCount = devices.filter((d) => d.status === 'down').length

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Server className="w-5 h-5" />}
          label="Total Devices"
          value={devices.length}
          color="text-blue-400"
        />
        <StatCard
          icon={<Wifi className="w-5 h-5" />}
          label="Online"
          value={upCount}
          color="text-emerald-400"
        />
        <StatCard
          icon={<WifiOff className="w-5 h-5" />}
          label="Offline"
          value={downCount}
          color="text-red-400"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Alerts (24h)"
          value={alerts.length}
          color="text-yellow-400"
        />
      </div>

      {/* Recent alerts */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
        <h3 className="text-lg font-semibold mb-4">Recent Alerts</h3>
        <AlertPanel alerts={alerts} />
      </div>

      {/* Device status table */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
        <h3 className="text-lg font-semibold mb-4">Device Status</h3>
        {devices.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No devices yet. Start a discovery scan or add devices manually.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2">Name</th>
                <th className="text-left py-2">IP</th>
                <th className="text-left py-2">Vendor</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((dev) => (
                <tr key={dev.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 font-medium">{dev.name}</td>
                  <td className="py-2 font-mono text-gray-400">{dev.ip}</td>
                  <td className="py-2 text-gray-400">{dev.vendor || '-'}</td>
                  <td className="py-2">
                    <StatusBadge status={dev.status} />
                  </td>
                  <td className="py-2 text-gray-500">
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
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <div className={`flex items-center gap-2 ${color} mb-2`}>
        {icon}
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    up: 'bg-emerald-400/10 text-emerald-400',
    down: 'bg-red-400/10 text-red-400',
    unknown: 'bg-gray-400/10 text-gray-400',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] || styles.unknown}`}>
      {status}
    </span>
  )
}

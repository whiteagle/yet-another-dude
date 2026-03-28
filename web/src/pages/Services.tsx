import { useEffect, useState } from 'react'
import { listServices, listDevices } from '../api/client'
import type { Service, Device } from '../types/api'

const STATUS_COLOR: Record<string, string> = {
  ok: '#22c55e',
  timeout: '#f97316',
  down: '#ef4444',
  unknown: '#9ca3af',
}

export default function Services() {
  const [services, setServices] = useState<Service[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    Promise.all([listServices(), listDevices()])
      .then(([svcs, devs]) => { setServices(svcs); setDevices(devs) })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load services'))
      .finally(() => setLoading(false))
  }, [])

  const deviceMap = Object.fromEntries(devices.map((d) => [d.id, d]))

  const filtered = services.filter((s) =>
    filterStatus === 'all' || s.status === filterStatus
  )

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="bg-[#d4d0c8] border-b border-[#808080] flex items-center gap-2 px-2 py-[2px] shrink-0 text-[11px]">
        <span className="text-gray-600">Status:</span>
        {['all', 'ok', 'timeout', 'down', 'unknown'].map((f) => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className={`px-2 py-[1px] border border-[#808080] capitalize
              ${filterStatus === f
                ? 'bg-[#ece9d8] shadow-[inset_1px_1px_#808080,inset_-1px_-1px_#fff]'
                : 'bg-[#d4d0c8] shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#808080] hover:bg-[#ece9d8]'}`}
          >
            {f}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-gray-500">{filtered.length} services</span>
      </div>

      <div className="flex-1 overflow-auto p-1">
        {loading ? (
          <div className="text-[12px] text-gray-500 p-2">Loading…</div>
        ) : error ? (
          <div className="text-[12px] text-red-600 p-2">Error: {error}</div>
        ) : (
          <div className="border border-[#808080] bg-white text-[12px]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#d4d0c8] sticky top-0">
                  {['Device', 'Probe', 'Type', 'Port', 'Status', 'Problem', 'Last Up', 'Last Down'].map((h) => (
                    <th key={h} className="text-left px-2 py-[2px] border-r border-b border-[#808080] font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-2 py-4 text-center text-gray-500">
                      No services configured
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <tr key={s.id} className="border-b border-[#e0e0e0] hover:bg-[#cce8ff]">
                      <td className="px-2 py-[1px]">{deviceMap[s.device_id]?.name ?? s.device_id}</td>
                      <td className="px-2 py-[1px] font-semibold">{s.probe}</td>
                      <td className="px-2 py-[1px]">{s.probe_type}</td>
                      <td className="px-2 py-[1px]">{s.port ?? '—'}</td>
                      <td className="px-2 py-[1px]">
                        <span style={{ color: STATUS_COLOR[s.status] ?? '#9ca3af' }}>{s.status}</span>
                      </td>
                      <td className="px-2 py-[1px] text-red-600 max-w-[160px] truncate">{s.problem || '—'}</td>
                      <td className="px-2 py-[1px] whitespace-nowrap text-[11px]">
                        {s.time_last_up ? new Date(s.time_last_up).toLocaleString() : '—'}
                      </td>
                      <td className="px-2 py-[1px] whitespace-nowrap text-[11px]">
                        {s.time_last_down ? new Date(s.time_last_down).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

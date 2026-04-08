import { useEffect, useState } from 'react'
import { listServices, listDevices } from '../api/client'
import type { Service, Device } from '../types/api'

const STATUS_COLOR: Record<string, string> = {
  ok: 'var(--status-up)',
  timeout: 'var(--status-partial)',
  down: 'var(--status-down)',
  unknown: 'var(--status-unknown)',
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
      <div
        className="flex items-center gap-2 px-2 py-[2px] shrink-0 text-[11px]"
        style={{ background: 'var(--chrome-bg)', borderBottom: '1px solid var(--chrome-border)' }}
      >
        <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
        {['all', 'ok', 'timeout', 'down', 'unknown'].map((f) => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className="px-2 py-[1px] capitalize"
            style={{
              border: '1px solid var(--chrome-border)',
              background: filterStatus === f ? 'var(--chrome-panel)' : 'var(--chrome-bg)',
              color: 'var(--text-primary)',
            }}
          >
            {f}
          </button>
        ))}
        <div className="flex-1" />
        <span style={{ color: 'var(--text-muted)' }}>{filtered.length} services</span>
      </div>

      <div className="flex-1 overflow-auto p-1">
        {loading ? (
          <div className="text-[12px] p-2" style={{ color: 'var(--text-muted)' }}>Loading…</div>
        ) : error ? (
          <div className="text-[12px] p-2" style={{ color: 'var(--status-down)' }}>Error: {error}</div>
        ) : (
          <div className="text-[12px]" style={{ border: '1px solid var(--chrome-border)', background: 'var(--bg-base)' }}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="sticky top-0" style={{ background: 'var(--chrome-bg)' }}>
                  {['Device', 'Probe', 'Type', 'Port', 'Status', 'Problem', 'Last Up', 'Last Down'].map((h) => (
                    <th key={h} className="text-left px-2 py-[2px] font-normal" style={{ borderRight: '1px solid var(--chrome-border)', borderBottom: '1px solid var(--chrome-border)', color: 'var(--text-primary)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                      No services configured
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <tr
                      key={s.id}
                      style={{ borderBottom: '1px solid var(--border-muted)' }}
                      className="cursor-default"
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--select-hover)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '' }}
                    >
                      <td className="px-2 py-[1px]" style={{ color: 'var(--text-primary)' }}>{deviceMap[s.device_id]?.name ?? s.device_id}</td>
                      <td className="px-2 py-[1px] font-semibold" style={{ color: 'var(--text-primary)' }}>{s.probe}</td>
                      <td className="px-2 py-[1px]" style={{ color: 'var(--text-primary)' }}>{s.probe_type}</td>
                      <td className="px-2 py-[1px]" style={{ color: 'var(--text-primary)' }}>{s.port ?? '—'}</td>
                      <td className="px-2 py-[1px]">
                        <span style={{ color: STATUS_COLOR[s.status] ?? 'var(--status-unknown)' }}>{s.status}</span>
                      </td>
                      <td className="px-2 py-[1px] max-w-[160px] truncate" style={{ color: 'var(--status-down)' }}>{s.problem || '—'}</td>
                      <td className="px-2 py-[1px] whitespace-nowrap text-[11px]" style={{ color: 'var(--text-primary)' }}>
                        {s.time_last_up ? new Date(s.time_last_up).toLocaleString() : '—'}
                      </td>
                      <td className="px-2 py-[1px] whitespace-nowrap text-[11px]" style={{ color: 'var(--text-primary)' }}>
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

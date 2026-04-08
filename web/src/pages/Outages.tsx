import { useEffect, useState } from 'react'
import { listOutages } from '../api/client'
import type { Outage } from '../types/api'

function fmtDuration(sec: number | null): string {
  if (sec == null) return '—'
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
}

export default function Outages() {
  const [outages, setOutages] = useState<Outage[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all')

  useEffect(() => {
    listOutages(500)
      .then(setOutages)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = outages.filter((o) => filter === 'all' || o.status === filter)

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-2 py-[2px] shrink-0 text-[11px]"
        style={{ background: 'var(--chrome-bg)', borderBottom: '1px solid var(--chrome-border)' }}
      >
        <span style={{ color: 'var(--text-secondary)' }}>Filter:</span>
        {(['all', 'active', 'resolved'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-2 py-[1px] capitalize"
            style={{
              border: '1px solid var(--chrome-border)',
              background: filter === f ? 'var(--chrome-panel)' : 'var(--chrome-bg)',
              color: 'var(--text-primary)',
            }}
          >
            {f}
          </button>
        ))}
        <div className="flex-1" />
        <span style={{ color: 'var(--text-muted)' }}>{filtered.length} outages</span>
      </div>

      <div className="flex-1 overflow-auto p-1">
        {loading ? (
          <div className="text-[12px] p-2" style={{ color: 'var(--text-muted)' }}>Loading…</div>
        ) : (
          <div className="text-[12px]" style={{ border: '1px solid var(--chrome-border)', background: 'var(--bg-base)' }}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="sticky top-0" style={{ background: 'var(--chrome-bg)' }}>
                  {['Device', 'Service', 'Status', 'Started', 'Resolved', 'Duration'].map((h) => (
                    <th key={h} className="text-left px-2 py-[2px] font-normal" style={{ borderRight: '1px solid var(--chrome-border)', borderBottom: '1px solid var(--chrome-border)', color: 'var(--text-primary)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                      No outages recorded
                    </td>
                  </tr>
                ) : (
                  filtered.map((o) => (
                    <tr
                      key={o.id}
                      style={{ borderBottom: '1px solid var(--border-muted)' }}
                      className="cursor-default"
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--select-hover)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '' }}
                    >
                      <td className="px-2 py-[1px]" style={{ color: 'var(--text-primary)' }}>{o.device_id}</td>
                      <td className="px-2 py-[1px]" style={{ color: 'var(--text-primary)' }}>{o.service_probe}</td>
                      <td className="px-2 py-[1px]">
                        <span
                          className="px-1 rounded-[1px] text-white text-[10px]"
                          style={{ background: o.status === 'active' ? 'var(--status-down)' : 'var(--status-up)' }}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="px-2 py-[1px] whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                        {new Date(o.started_at).toLocaleString()}
                      </td>
                      <td className="px-2 py-[1px] whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                        {o.resolved_at ? new Date(o.resolved_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-2 py-[1px]" style={{ color: 'var(--text-primary)' }}>{fmtDuration(o.duration_seconds)}</td>
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

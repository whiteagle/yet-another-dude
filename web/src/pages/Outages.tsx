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
      <div className="bg-[#d4d0c8] border-b border-[#808080] flex items-center gap-2 px-2 py-[2px] shrink-0 text-[11px]">
        <span className="text-gray-600">Filter:</span>
        {(['all', 'active', 'resolved'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-[1px] border border-[#808080] capitalize
              ${filter === f
                ? 'bg-[#ece9d8] shadow-[inset_1px_1px_#808080,inset_-1px_-1px_#fff]'
                : 'bg-[#d4d0c8] shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#808080] hover:bg-[#ece9d8]'}`}
          >
            {f}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-gray-500">{filtered.length} outages</span>
      </div>

      <div className="flex-1 overflow-auto p-1">
        {loading ? (
          <div className="text-[12px] text-gray-500 p-2">Loading…</div>
        ) : (
          <div className="border border-[#808080] bg-white text-[12px]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#d4d0c8] sticky top-0">
                  {['Device', 'Service', 'Status', 'Started', 'Resolved', 'Duration'].map((h) => (
                    <th key={h} className="text-left px-2 py-[2px] border-r border-b border-[#808080] font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-4 text-center text-gray-500">
                      No outages recorded
                    </td>
                  </tr>
                ) : (
                  filtered.map((o) => (
                    <tr key={o.id} className="border-b border-[#e0e0e0] hover:bg-[#cce8ff]">
                      <td className="px-2 py-[1px]">{o.device_id}</td>
                      <td className="px-2 py-[1px]">{o.service_probe}</td>
                      <td className="px-2 py-[1px]">
                        <span
                          className={`px-1 rounded-[1px] text-white text-[10px]
                            ${o.status === 'active' ? 'bg-red-500' : 'bg-green-600'}`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="px-2 py-[1px] whitespace-nowrap">
                        {new Date(o.started_at).toLocaleString()}
                      </td>
                      <td className="px-2 py-[1px] whitespace-nowrap">
                        {o.resolved_at ? new Date(o.resolved_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-2 py-[1px]">{fmtDuration(o.duration_seconds)}</td>
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

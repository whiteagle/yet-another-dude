import { useState } from 'react'
import type { Device } from '../types/api'
import { STATUS_COLORS } from '../types/api'

interface DeviceListProps {
  devices: Device[]
  onDelete: (id: string) => void
  onSelect?: (device: Device) => void
}

// The Dude-style flat device list with XP table styling
export default function DeviceList({ devices, onDelete, onSelect }: DeviceListProps) {
  const [selected, setSelected] = useState<string | null>(null)

  const handleRow = (dev: Device) => {
    setSelected(dev.id)
    onSelect?.(dev)
  }

  if (devices.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-16 text-[12px]"
        style={{ color: 'var(--text-muted)', background: 'var(--bg-base)', border: '1px solid var(--chrome-border)' }}
      >
        No devices found. Use Discover to scan, or add manually.
      </div>
    )
  }

  return (
    <div className="overflow-auto" style={{ border: '1px solid var(--chrome-border)', background: 'var(--bg-base)', maxHeight: 'calc(100vh - 220px)' }}>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="sticky top-0 z-10" style={{ background: 'var(--chrome-bg)' }}>
            {['Name', 'Addresses', 'MAC', 'Type', 'Status', 'Services Down', 'Last Seen'].map((col) => (
              <th
                key={col}
                className="text-left px-2 py-[2px] font-normal whitespace-nowrap select-none"
                style={{ color: 'var(--text-primary)', borderRight: '1px solid var(--chrome-border)', borderBottom: '1px solid var(--chrome-border)' }}
              >
                {col}
              </th>
            ))}
            <th className="w-6" style={{ borderBottom: '1px solid var(--chrome-border)' }} />
          </tr>
        </thead>
        <tbody>
          {devices.map((dev) => {
            const isSelected = selected === dev.id
            return (
              <tr
                key={dev.id}
                onClick={() => handleRow(dev)}
                onDoubleClick={() => onSelect?.(dev)}
                className="cursor-default"
                style={{
                  borderBottom: '1px solid var(--border-muted)',
                  backgroundColor: isSelected ? 'var(--select-bg)' : undefined,
                  color: isSelected ? '#fff' : 'var(--text-primary)',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--select-hover)' }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '' }}
              >
                {/* Name with colored status square */}
                <td className="px-2 py-[1px] flex items-center gap-1 min-w-[140px]">
                  <span
                    className="inline-block w-3 h-3 rounded-[1px] shrink-0"
                    style={{ backgroundColor: STATUS_COLORS[dev.status] ?? STATUS_COLORS.unknown }}
                  />
                  <span className="truncate">{dev.name}</span>
                </td>
                <td className="px-2 py-[1px] font-mono whitespace-nowrap">{dev.ip}</td>
                <td className="px-2 py-[1px] font-mono text-[11px] whitespace-nowrap">
                  {dev.mac || '—'}
                </td>
                <td className="px-2 py-[1px] capitalize whitespace-nowrap">
                  {dev.type.replace(/_/g, ' ')}
                </td>
                <td className="px-2 py-[1px] whitespace-nowrap">
                  <span style={{ color: isSelected ? '#fff' : STATUS_COLORS[dev.status] }}>
                    {dev.status}
                  </span>
                </td>
                <td className="px-2 py-[1px] text-center">
                  {/* Services down count — placeholder; real value comes from services API */}
                  0
                </td>
                <td className="px-2 py-[1px] whitespace-nowrap text-[11px]">
                  {dev.last_seen ? new Date(dev.last_seen).toLocaleString() : '—'}
                </td>
                <td className="px-1 py-[1px]">
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(dev.id) }}
                    title="Delete"
                    className="text-[10px] px-1 rounded hover:bg-red-100 hover:text-red-700"
                    style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

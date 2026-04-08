import { useEffect, useState } from 'react'
import { listDevices, createDevice, deleteDevice } from '../api/client'
import type { Device, CreateDeviceRequest, DeviceType } from '../types/api'
import DeviceList from '../components/DeviceList'
import DiscoveryWizard from '../components/DiscoveryWizard'

type Tab = 'list' | 'types' | 'mac'

// Windows XP-style button
function WinBtn({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode
  onClick?: () => void
  title?: string
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="px-2 py-[1px] text-[11px] border select-none"
      style={{
        background: active ? 'var(--chrome-panel)' : 'var(--chrome-bg)',
        borderColor: 'var(--chrome-border)',
        color: 'var(--text-primary)',
      }}
    >
      {children}
    </button>
  )
}

// Filter dropdown matching The Dude's filter bar
function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-[11px] h-5 px-0.5"
        style={{ border: '1px solid var(--chrome-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('list')
  const [showAdd, setShowAdd] = useState(false)
  const [showDiscovery, setShowDiscovery] = useState(false)
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterType, setFilterType] = useState('All')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Device | null>(null)

  const load = async () => {
    try {
      setError(null)
      setDevices(await listDevices())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleAdd = async (data: CreateDeviceRequest) => {
    try {
      setAddError(null)
      await createDevice(data)
      setShowAdd(false)
      await load()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to create device')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this device?')) return
    try {
      await deleteDevice(id)
      await load()
    } catch (err) {
      console.error('Failed to delete device:', err)
    }
  }

  const filtered = devices.filter((d) => {
    if (filterStatus !== 'All' && d.status !== filterStatus.toLowerCase()) return false
    if (filterType !== 'All' && d.type !== filterType.toLowerCase().replace(/ /g, '_')) return false
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.ip.includes(search)) return false
    return true
  })

  const TABS: { key: Tab; label: string }[] = [
    { key: 'list', label: 'List' },
    { key: 'types', label: 'Device Types' },
    { key: 'mac', label: 'Mac Mappings' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center gap-[2px] px-1 py-[2px] shrink-0 flex-wrap gap-y-1"
        style={{ background: 'var(--chrome-bg)', borderBottom: '1px solid var(--chrome-border)' }}
      >
        <WinBtn onClick={() => setShowAdd(true)} title="Add device">Add</WinBtn>
        <WinBtn title="Remove selected" onClick={() => selected && handleDelete(selected.id)}>Remove</WinBtn>
        <div className="w-px h-4 mx-0.5" style={{ background: 'var(--chrome-border)' }} />
        <WinBtn onClick={() => setShowDiscovery(true)}>Discover</WinBtn>
        <div className="w-px h-4 mx-0.5" style={{ background: 'var(--chrome-border)' }} />
        <FilterSelect
          label="Status"
          value={filterStatus}
          options={['All', 'Up', 'Down', 'Partial', 'Unknown', 'Acked']}
          onChange={setFilterStatus}
        />
        <FilterSelect
          label="Type"
          value={filterType}
          options={['All', 'Mikrotik', 'Router', 'Switch', 'Windows', 'Printer', 'Unknown']}
          onChange={setFilterType}
        />
        <div className="flex items-center gap-1 ml-1">
          <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Search:</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-[11px] h-5 px-1 w-28"
            style={{ border: '1px solid var(--chrome-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
            placeholder="name or IP…"
          />
        </div>
        <div className="flex-1" />
        <span className="text-[11px] pr-1" style={{ color: 'var(--text-muted)' }}>{filtered.length} devices</span>
      </div>

      {/* Tabs */}
      <div
        className="flex items-end px-1 shrink-0 h-5"
        style={{ background: 'var(--chrome-bg)', borderBottom: '1px solid var(--chrome-border)' }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-3 py-0 text-[11px] border border-b-0 mr-[1px] select-none"
            style={{
              background: tab === t.key ? 'var(--bg-base)' : 'var(--chrome-bg)',
              borderColor: tab === t.key ? 'var(--chrome-border)' : 'transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              marginBottom: tab === t.key ? -1 : 0,
              position: tab === t.key ? 'relative' : undefined,
              zIndex: tab === t.key ? 10 : 0,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main list / tab content */}
        <div className="flex-1 overflow-auto p-1">
          {showDiscovery && (
            <DiscoveryWizard onClose={() => { setShowDiscovery(false); load() }} />
          )}

          {showAdd && (
            <AddDeviceDialog onSubmit={handleAdd} onCancel={() => setShowAdd(false)} />
          )}

          {addError && (
            <div className="text-[11px] px-2 py-1 mb-1" style={{ color: 'var(--status-down)', background: 'color-mix(in srgb, var(--status-down) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--status-down) 30%, transparent)' }}>
              {addError}
            </div>
          )}
          {loading ? (
            <div className="text-[12px] p-2" style={{ color: 'var(--text-muted)' }}>Loading…</div>
          ) : error ? (
            <div className="text-[12px] p-2" style={{ color: 'var(--status-down)' }}>Error: {error}</div>
          ) : tab === 'list' ? (
            <DeviceList
              devices={filtered}
              onDelete={handleDelete}
              onSelect={setSelected}
            />
          ) : tab === 'types' ? (
            <DeviceTypesTable devices={devices} />
          ) : (
            <MacMappingsTable devices={devices} />
          )}
        </div>

        {/* Right panel: device details (only in list tab when device selected) */}
        {tab === 'list' && selected && (
          <div
            className="w-56 shrink-0 overflow-y-auto p-2 text-[11px]"
            style={{ borderLeft: '1px solid var(--chrome-border)', background: 'var(--bg-base)' }}
          >
            <div className="font-bold text-[12px] mb-1 truncate" style={{ color: 'var(--text-primary)' }}>{selected.name}</div>
            <table className="w-full">
              <tbody>
                {(
                  [
                    ['IP', selected.ip],
                    ['MAC', selected.mac || '—'],
                    ['Type', selected.type.replace(/_/g, ' ')],
                    ['Status', selected.status],
                    ['SNMP', `v${selected.snmp_version} / ${selected.snmp_community}`],
                    ['System', selected.system_name || '—'],
                    ['RouterOS', selected.routeros_version || '—'],
                    ...(selected.cpu_percent != null ? [['CPU', `${selected.cpu_percent.toFixed(0)}%`]] : []),
                    ...(selected.disk_percent != null ? [['Disk', `${selected.disk_percent.toFixed(0)}%`]] : []),
                    ...(selected.uptime_seconds != null
                      ? [['Uptime', `${Math.floor(selected.uptime_seconds / 86400)}d ${Math.floor((selected.uptime_seconds % 86400) / 3600)}h`]]
                      : []),
                    ['Last Seen', selected.last_seen ? new Date(selected.last_seen).toLocaleString() : '—'],
                  ] as [string, string][]
                ).map(([k, v]) => (
                    <tr key={k as string} style={{ borderBottom: '1px solid var(--border-muted)' }}>
                      <td className="pr-1 py-[1px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{k}:</td>
                      <td className="py-[1px] truncate max-w-[110px]" style={{ color: 'var(--text-primary)' }}>{v as string}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {selected.notes && (
              <div className="mt-2 italic pt-1" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-muted)' }}>
                {selected.notes}
              </div>
            )}
            <div className="mt-2 flex gap-1">
              <button
                onClick={() => handleDelete(selected.id)}
                className="px-2 py-[1px] text-[10px]"
                style={{
                  background: 'var(--chrome-bg)',
                  border: '1px solid var(--chrome-border)',
                  color: 'var(--text-primary)',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Summary of device types in the network
function DeviceTypesTable({ devices }: { devices: Device[] }) {
  const counts: Record<string, number> = {}
  for (const d of devices) {
    counts[d.type] = (counts[d.type] ?? 0) + 1
  }
  return (
    <div className="text-[12px]" style={{ border: '1px solid var(--chrome-border)', background: 'var(--bg-base)' }}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: 'var(--chrome-bg)' }}>
            <th className="text-left px-2 py-[2px]" style={{ borderRight: '1px solid var(--chrome-border)', borderBottom: '1px solid var(--chrome-border)', color: 'var(--text-primary)' }}>Device Type</th>
            <th className="text-left px-2 py-[2px]" style={{ borderBottom: '1px solid var(--chrome-border)', color: 'var(--text-primary)' }}>Count</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => (
              <tr
                key={type}
                style={{ borderBottom: '1px solid var(--border-muted)' }}
                className="cursor-default"
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--select-hover)' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '' }}
              >
                <td className="px-2 py-[1px] capitalize" style={{ color: 'var(--text-primary)' }}>{type.replace(/_/g, ' ')}</td>
                <td className="px-2 py-[1px]" style={{ color: 'var(--text-primary)' }}>{count}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}

// MAC address to device mapping table
function MacMappingsTable({ devices }: { devices: Device[] }) {
  const withMac = devices.filter((d) => d.mac)
  return (
    <div className="text-[12px]" style={{ border: '1px solid var(--chrome-border)', background: 'var(--bg-base)' }}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: 'var(--chrome-bg)' }}>
            {['MAC Address', 'Device', 'IP', 'Vendor'].map((h) => (
              <th key={h} className="text-left px-2 py-[2px]" style={{ borderRight: '1px solid var(--chrome-border)', borderBottom: '1px solid var(--chrome-border)', color: 'var(--text-primary)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {withMac.map((d) => (
            <tr
              key={d.id}
              style={{ borderBottom: '1px solid var(--border-muted)' }}
              className="cursor-default"
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--select-hover)' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '' }}
            >
              <td className="px-2 py-[1px] font-mono" style={{ color: 'var(--text-primary)' }}>{d.mac}</td>
              <td className="px-2 py-[1px]" style={{ color: 'var(--text-primary)' }}>{d.name}</td>
              <td className="px-2 py-[1px] font-mono" style={{ color: 'var(--text-primary)' }}>{d.ip}</td>
              <td className="px-2 py-[1px]" style={{ color: 'var(--text-primary)' }}>{d.vendor || '—'}</td>
            </tr>
          ))}
          {withMac.length === 0 && (
            <tr>
              <td colSpan={4} className="px-2 py-2 text-center" style={{ color: 'var(--text-muted)' }}>
                No MAC addresses recorded
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// Add device dialog — simple inline form matching The Dude's "Add Device" dialog
function AddDeviceDialog({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: CreateDeviceRequest) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [ip, setIp] = useState('')
  const [type, setType] = useState<DeviceType>('unknown')
  const [community, setCommunity] = useState('public')
  const [notes, setNotes] = useState('')

  const DEVICE_TYPES: DeviceType[] = [
    'mikrotik', 'bridge', 'router', 'switch', 'dude_server', 'windows',
    'hp_jetdirect', 'ftp_server', 'mail_server', 'web_server', 'dns_server',
    'pop3_server', 'imap4_server', 'news_server', 'time_server', 'printer', 'unknown',
  ]

  const handle = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ name, ip, type, snmp_community: community, notes })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-80" style={{ background: 'var(--chrome-panel)', border: '1px solid var(--chrome-border)', boxShadow: '2px 2px 8px rgba(0,0,0,0.4)' }}>
        {/* Title bar */}
        <div className="px-2 py-[2px] flex items-center" style={{ background: `linear-gradient(to right, var(--titlebar-from), var(--titlebar-to))` }}>
          <span className="text-white text-[11px] font-bold flex-1">Add Device</span>
          <button onClick={onCancel} className="text-white text-[11px] px-1 hover:bg-[var(--close-hover)] rounded-sm">✕</button>
        </div>
        <form onSubmit={handle} className="p-3 space-y-2 text-[12px]" style={{ color: 'var(--text-primary)' }}>
          {[
            { label: 'Name', value: name, set: setName, required: true },
            { label: 'IP Address', value: ip, set: setIp, required: true },
            { label: 'SNMP Community', value: community, set: setCommunity },
          ].map(({ label, value, set, required }) => (
            <div key={label} className="flex items-center gap-2">
              <label className="w-28 text-right shrink-0">{label}:</label>
              <input
                type="text"
                value={value}
                onChange={(e) => set(e.target.value)}
                required={required}
                className="flex-1 px-1 py-0.5 text-[12px] focus:outline-none"
                style={{ border: '1px solid var(--chrome-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
              />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <label className="w-28 text-right shrink-0">Type:</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DeviceType)}
              className="flex-1 px-1 py-0.5 text-[12px]"
              style={{ border: '1px solid var(--chrome-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
            >
              {DEVICE_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="w-28 text-right shrink-0">Notes:</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="flex-1 px-1 py-0.5 text-[12px] resize-none focus:outline-none"
              style={{ border: '1px solid var(--chrome-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1" style={{ borderTop: '1px solid var(--chrome-border)' }}>
            <button
              type="submit"
              className="px-4 py-[2px] text-[11px]"
              style={{ background: 'var(--chrome-bg)', border: '1px solid var(--chrome-border)', color: 'var(--text-primary)' }}
            >
              OK
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-[2px] text-[11px]"
              style={{ background: 'var(--chrome-bg)', border: '1px solid var(--chrome-border)', color: 'var(--text-primary)' }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

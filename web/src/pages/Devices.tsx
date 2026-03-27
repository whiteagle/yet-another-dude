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
      className={`px-2 py-[1px] text-[11px] border select-none
        ${
          active
            ? 'bg-[#ece9d8] border-[#808080] shadow-[inset_1px_1px_#808080,inset_-1px_-1px_#fff]'
            : 'bg-[#d4d0c8] border-[#808080] shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#808080] hover:bg-[#ece9d8]'
        }
        active:shadow-[inset_1px_1px_#808080,inset_-1px_-1px_#fff]`}
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
      <span className="text-[11px] text-gray-600">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-[11px] border border-[#808080] bg-white h-5 px-0.5"
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
  const [tab, setTab] = useState<Tab>('list')
  const [showAdd, setShowAdd] = useState(false)
  const [showDiscovery, setShowDiscovery] = useState(false)
  const [filterStatus, setFilterStatus] = useState('All')
  const [filterType, setFilterType] = useState('All')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Device | null>(null)

  const load = async () => {
    try {
      setDevices(await listDevices())
    } catch (err) {
      console.error('Failed to load devices:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleAdd = async (data: CreateDeviceRequest) => {
    try {
      await createDevice(data)
      setShowAdd(false)
      await load()
    } catch (err) {
      console.error('Failed to create device:', err)
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
      <div className="bg-[#d4d0c8] border-b border-[#808080] flex items-center gap-[2px] px-1 py-[2px] shrink-0 flex-wrap gap-y-1">
        <WinBtn onClick={() => setShowAdd(true)} title="Add device">Add</WinBtn>
        <WinBtn title="Remove selected" onClick={() => selected && handleDelete(selected.id)}>Remove</WinBtn>
        <div className="w-px h-4 bg-[#808080] mx-0.5" />
        <WinBtn onClick={() => setShowDiscovery(true)}>Discover</WinBtn>
        <div className="w-px h-4 bg-[#808080] mx-0.5" />
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
          <span className="text-[11px] text-gray-600">Search:</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-[11px] border border-[#808080] bg-white h-5 px-1 w-28"
            placeholder="name or IP…"
          />
        </div>
        <div className="flex-1" />
        <span className="text-[11px] text-gray-500 pr-1">{filtered.length} devices</span>
      </div>

      {/* Tabs */}
      <div className="bg-[#d4d0c8] border-b border-[#808080] flex items-end px-1 shrink-0 h-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-0 text-[11px] border border-b-0 mr-[1px] select-none
              ${
                tab === t.key
                  ? 'bg-white border-[#808080] text-gray-900 -mb-px relative z-10'
                  : 'bg-[#d4d0c8] border-transparent text-gray-600 hover:bg-[#ece9d8]'
              }`}
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

          {loading ? (
            <div className="text-[12px] text-gray-500 p-2">Loading…</div>
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
          <div className="w-56 shrink-0 border-l border-[#808080] bg-white overflow-y-auto p-2 text-[11px]">
            <div className="font-bold text-[12px] mb-1 truncate">{selected.name}</div>
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
                    <tr key={k as string} className="border-b border-gray-100">
                      <td className="text-gray-500 pr-1 py-[1px] whitespace-nowrap">{k}:</td>
                      <td className="text-gray-900 py-[1px] truncate max-w-[110px]">{v as string}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {selected.notes && (
              <div className="mt-2 text-gray-500 italic border-t border-gray-200 pt-1">
                {selected.notes}
              </div>
            )}
            <div className="mt-2 flex gap-1">
              <button
                onClick={() => handleDelete(selected.id)}
                className="px-2 py-[1px] bg-[#d4d0c8] border border-[#808080] text-[10px]
                  shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#808080] hover:bg-[#ece9d8]"
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
    <div className="border border-[#808080] bg-white text-[12px]">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#d4d0c8]">
            <th className="text-left px-2 py-[2px] border-r border-b border-[#808080]">Device Type</th>
            <th className="text-left px-2 py-[2px] border-b border-[#808080]">Count</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => (
              <tr key={type} className="border-b border-[#e0e0e0] hover:bg-[#cce8ff]">
                <td className="px-2 py-[1px] capitalize">{type.replace(/_/g, ' ')}</td>
                <td className="px-2 py-[1px]">{count}</td>
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
    <div className="border border-[#808080] bg-white text-[12px]">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#d4d0c8]">
            {['MAC Address', 'Device', 'IP', 'Vendor'].map((h) => (
              <th key={h} className="text-left px-2 py-[2px] border-r border-b border-[#808080]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {withMac.map((d) => (
            <tr key={d.id} className="border-b border-[#e0e0e0] hover:bg-[#cce8ff]">
              <td className="px-2 py-[1px] font-mono">{d.mac}</td>
              <td className="px-2 py-[1px]">{d.name}</td>
              <td className="px-2 py-[1px] font-mono">{d.ip}</td>
              <td className="px-2 py-[1px]">{d.vendor || '—'}</td>
            </tr>
          ))}
          {withMac.length === 0 && (
            <tr>
              <td colSpan={4} className="px-2 py-2 text-gray-500 text-center">
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
      <div className="bg-[#ece9d8] border border-[#808080] shadow-[2px_2px_8px_rgba(0,0,0,0.4)] w-80">
        {/* Title bar */}
        <div className="bg-gradient-to-r from-[#0058e6] to-[#3c9aff] px-2 py-[2px] flex items-center">
          <span className="text-white text-[11px] font-bold flex-1">Add Device</span>
          <button onClick={onCancel} className="text-white text-[11px] px-1 hover:bg-[#cc0000] rounded-sm">✕</button>
        </div>
        <form onSubmit={handle} className="p-3 space-y-2 text-[12px]">
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
                className="flex-1 border border-[#808080] px-1 py-0.5 text-[12px] bg-white focus:outline-none focus:border-[#0058e6]"
              />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <label className="w-28 text-right shrink-0">Type:</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DeviceType)}
              className="flex-1 border border-[#808080] px-1 py-0.5 text-[12px] bg-white"
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
              className="flex-1 border border-[#808080] px-1 py-0.5 text-[12px] bg-white resize-none focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1 border-t border-[#808080]">
            <button
              type="submit"
              className="px-4 py-[2px] bg-[#d4d0c8] border border-[#808080] text-[11px]
                shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#808080] hover:bg-[#ece9d8]"
            >
              OK
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-[2px] bg-[#d4d0c8] border border-[#808080] text-[11px]
                shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#808080] hover:bg-[#ece9d8]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

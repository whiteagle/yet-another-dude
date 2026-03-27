import { useState, useEffect } from 'react'
import { startScan, getScanStatus } from '../api/client'
import type { ScanStatus } from '../types/api'

interface DiscoveryWizardProps {
  onClose: () => void
}

export default function DiscoveryWizard({ onClose }: DiscoveryWizardProps) {
  const [cidr, setCidr] = useState('192.168.1.0/24')
  const [community, setCommunity] = useState('public')
  const [snmpVersion, setSnmpVersion] = useState(2)
  const [fastMode, setFastMode] = useState(false)
  const [addLinks, setAddLinks] = useState(true)
  const [identifyTypes, setIdentifyTypes] = useState(true)
  const [layoutAfter, setLayoutAfter] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [status, setStatus] = useState<ScanStatus | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'general' | 'services' | 'advanced'>('general')

  useEffect(() => {
    if (!scanning) return
    const interval = setInterval(async () => {
      try {
        const s = await getScanStatus()
        setStatus(s)
        if (!s.running) setScanning(false)
      } catch {}
    }, 1000)
    return () => clearInterval(interval)
  }, [scanning])

  const handleStart = async () => {
    setError('')
    try {
      await startScan({
        cidr,
        snmp_community: community,
        snmp_version: snmpVersion,
        fast_mode: fastMode,
        add_links: addLinks,
        identify_device_types: identifyTypes,
        layout_after: layoutAfter,
      })
      setScanning(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
    }
  }

  const progress =
    status && status.total > 0 ? Math.round((status.scanned / status.total) * 100) : 0
  const done = status && !status.running && !scanning

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-[#ece9d8] border border-[#808080] shadow-[2px_2px_8px_rgba(0,0,0,0.4)] w-[420px]">
        {/* Title bar */}
        <div className="bg-gradient-to-r from-[#0058e6] to-[#3c9aff] px-2 py-[2px] flex items-center">
          <span className="text-white text-[11px] font-bold flex-1">Discover Devices</span>
          <button onClick={onClose} className="text-white text-[11px] px-1 hover:bg-[#cc0000] rounded-sm">✕</button>
        </div>

        {/* Tab bar */}
        <div className="bg-[#d4d0c8] border-b border-[#808080] flex items-end px-1 h-5">
          {(['general', 'services', 'advanced'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-0 text-[11px] border border-b-0 mr-[1px] capitalize select-none
                ${tab === t
                  ? 'bg-[#ece9d8] border-[#808080] -mb-px z-10 relative'
                  : 'bg-[#d4d0c8] border-transparent text-gray-600 hover:bg-[#ece9d8]'}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-3 text-[12px] space-y-2 min-h-[200px]">
          {tab === 'general' && (
            <>
              <Row label="IP Range (CIDR)">
                <input
                  value={cidr}
                  onChange={(e) => setCidr(e.target.value)}
                  disabled={scanning}
                  className="flex-1 border border-[#808080] px-1 py-0.5 bg-white text-[12px] focus:outline-none disabled:bg-gray-100"
                />
              </Row>
              <Row label="SNMP Community">
                <input
                  value={community}
                  onChange={(e) => setCommunity(e.target.value)}
                  disabled={scanning}
                  className="flex-1 border border-[#808080] px-1 py-0.5 bg-white text-[12px] focus:outline-none disabled:bg-gray-100"
                />
              </Row>
              <Row label="SNMP Version">
                <select
                  value={snmpVersion}
                  onChange={(e) => setSnmpVersion(Number(e.target.value))}
                  disabled={scanning}
                  className="border border-[#808080] px-1 py-0.5 bg-white text-[12px]"
                >
                  <option value={1}>v1</option>
                  <option value={2}>v2c</option>
                  <option value={3}>v3</option>
                </select>
              </Row>
              <CheckRow
                label="Fast mode (ping only)"
                checked={fastMode}
                onChange={setFastMode}
                disabled={scanning}
              />
              <CheckRow
                label="Auto-detect and add links"
                checked={addLinks}
                onChange={setAddLinks}
                disabled={scanning}
              />
              <CheckRow
                label="Identify device types"
                checked={identifyTypes}
                onChange={setIdentifyTypes}
                disabled={scanning}
              />
              <CheckRow
                label="Auto-layout map after discovery"
                checked={layoutAfter}
                onChange={setLayoutAfter}
                disabled={scanning}
              />
            </>
          )}
          {tab === 'services' && (
            <div className="text-gray-500 text-[11px] p-2">
              <p className="mb-2 font-semibold text-gray-700">Default probes added to discovered devices:</p>
              {['ping (ICMP)', 'SNMP (UDP 161)', 'SSH (TCP 22)', 'HTTP (TCP 80)'].map((s) => (
                <div key={s} className="flex items-center gap-1 mb-1">
                  <input type="checkbox" defaultChecked className="w-3 h-3" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}
          {tab === 'advanced' && (
            <div className="text-gray-500 text-[11px] p-2 space-y-2">
              <Row label="Recursive hops">
                <select className="border border-[#808080] px-1 py-0.5 bg-white text-[12px]" defaultValue="0">
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </Row>
              <CheckRow label="Add subnet cloud icons to map" checked={false} onChange={() => {}} disabled={false} />
            </div>
          )}
        </div>

        {/* Progress bar when scanning */}
        {(scanning || done) && (
          <div className="px-3 pb-2 space-y-1">
            <div className="w-full bg-white border border-[#808080] h-4 relative">
              <div
                className="h-full bg-[#0058e6] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white mix-blend-difference">
                {progress}%
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-gray-600">
              <span>{status?.scanned ?? 0} / {status?.total ?? 0} hosts scanned</span>
              <span>{status?.found ?? 0} found</span>
            </div>
            {done && status && status.found > 0 && (
              <div className="text-green-700 text-[11px] font-semibold">
                Done — {status.found} device(s) discovered.
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="px-3 pb-2 text-red-600 text-[11px]">{error}</div>
        )}

        {/* Buttons */}
        <div className="border-t border-[#808080] px-3 py-2 flex justify-end gap-2">
          {!scanning && !done && (
            <button
              onClick={handleStart}
              className="px-4 py-[2px] bg-[#d4d0c8] border border-[#808080] text-[11px]
                shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#808080] hover:bg-[#ece9d8]
                active:shadow-[inset_1px_1px_#808080,inset_-1px_-1px_#fff]"
            >
              Start
            </button>
          )}
          {scanning && (
            <span className="text-[11px] text-gray-600 flex items-center gap-1 mr-2">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              Scanning…
            </span>
          )}
          <button
            onClick={onClose}
            className="px-4 py-[2px] bg-[#d4d0c8] border border-[#808080] text-[11px]
              shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#808080] hover:bg-[#ece9d8]"
          >
            {done ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-36 text-right shrink-0 text-gray-700">{label}:</label>
      {children}
    </div>
  )
}

function CheckRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled: boolean
}) {
  return (
    <div className="flex items-center gap-2 pl-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="w-3 h-3"
      />
      <label className="text-gray-700 cursor-pointer" onClick={() => !disabled && onChange(!checked)}>
        {label}
      </label>
    </div>
  )
}

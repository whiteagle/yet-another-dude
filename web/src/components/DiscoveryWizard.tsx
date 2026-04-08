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
      <div className="w-[420px]" style={{ background: 'var(--chrome-panel)', border: '1px solid var(--chrome-border)', boxShadow: '2px 2px 8px rgba(0,0,0,0.4)' }}>
        {/* Title bar */}
        <div className="px-2 py-[2px] flex items-center" style={{ background: `linear-gradient(to right, var(--titlebar-from), var(--titlebar-to))` }}>
          <span className="text-white text-[11px] font-bold flex-1">Discover Devices</span>
          <button onClick={onClose} className="text-white text-[11px] px-1 hover:bg-[var(--close-hover)] rounded-sm">✕</button>
        </div>

        {/* Tab bar */}
        <div className="flex items-end px-1 h-5" style={{ background: 'var(--chrome-bg)', borderBottom: '1px solid var(--chrome-border)' }}>
          {(['general', 'services', 'advanced'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-0 text-[11px] border border-b-0 mr-[1px] capitalize select-none"
              style={{
                background: tab === t ? 'var(--chrome-panel)' : 'var(--chrome-bg)',
                borderColor: tab === t ? 'var(--chrome-border)' : 'transparent',
                marginBottom: tab === t ? -1 : 0,
                zIndex: tab === t ? 10 : 0,
                position: tab === t ? 'relative' : undefined,
                color: tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-3 text-[12px] space-y-2 min-h-[200px]" style={{ color: 'var(--text-primary)' }}>
          {tab === 'general' && (
            <>
              <Row label="IP Range (CIDR)">
                <input
                  value={cidr}
                  onChange={(e) => setCidr(e.target.value)}
                  disabled={scanning}
                  className="flex-1 px-1 py-0.5 text-[12px] focus:outline-none disabled:opacity-60"
                  style={{ border: '1px solid var(--chrome-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                />
              </Row>
              <Row label="SNMP Community">
                <input
                  value={community}
                  onChange={(e) => setCommunity(e.target.value)}
                  disabled={scanning}
                  className="flex-1 px-1 py-0.5 text-[12px] focus:outline-none disabled:opacity-60"
                  style={{ border: '1px solid var(--chrome-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                />
              </Row>
              <Row label="SNMP Version">
                <select
                  value={snmpVersion}
                  onChange={(e) => setSnmpVersion(Number(e.target.value))}
                  disabled={scanning}
                  className="px-1 py-0.5 text-[12px]"
                  style={{ border: '1px solid var(--chrome-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
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
            <div className="text-[11px] p-2" style={{ color: 'var(--text-muted)' }}>
              <p className="mb-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Default probes added to discovered devices:</p>
              {['ping (ICMP)', 'SNMP (UDP 161)', 'SSH (TCP 22)', 'HTTP (TCP 80)'].map((s) => (
                <div key={s} className="flex items-center gap-1 mb-1">
                  <input type="checkbox" defaultChecked className="w-3 h-3" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}
          {tab === 'advanced' && (
            <div className="text-[11px] p-2 space-y-2" style={{ color: 'var(--text-muted)' }}>
              <Row label="Recursive hops">
                <select className="px-1 py-0.5 text-[12px]" defaultValue="0" style={{ border: '1px solid var(--chrome-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
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
            <div className="w-full h-4 relative" style={{ background: 'var(--bg-base)', border: '1px solid var(--chrome-border)' }}>
              <div
                className="h-full transition-all duration-300"
                style={{ width: `${progress}%`, background: 'var(--progress-bar)' }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white mix-blend-difference">
                {progress}%
              </span>
            </div>
            <div className="flex justify-between text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              <span>{status?.scanned ?? 0} / {status?.total ?? 0} hosts scanned</span>
              <span>{status?.found ?? 0} found</span>
            </div>
            {done && status && status.found > 0 && (
              <div className="text-[11px] font-semibold" style={{ color: 'var(--status-up)' }}>
                Done — {status.found} device(s) discovered.
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="px-3 pb-2 text-[11px]" style={{ color: 'var(--status-down)' }}>{error}</div>
        )}

        {/* Buttons */}
        <div className="px-3 py-2 flex justify-end gap-2" style={{ borderTop: '1px solid var(--chrome-border)' }}>
          {!scanning && !done && (
            <button
              onClick={handleStart}
              className="px-4 py-[2px] text-[11px]"
              style={{
                background: 'var(--chrome-bg)',
                border: '1px solid var(--chrome-border)',
                color: 'var(--text-primary)',
              }}
            >
              Start
            </button>
          )}
          {scanning && (
            <span className="text-[11px] flex items-center gap-1 mr-2" style={{ color: 'var(--text-secondary)' }}>
              <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
              Scanning…
            </span>
          )}
          <button
            onClick={onClose}
            className="px-4 py-[2px] text-[11px]"
            style={{
              background: 'var(--chrome-bg)',
              border: '1px solid var(--chrome-border)',
              color: 'var(--text-primary)',
            }}
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
      <label className="w-36 text-right shrink-0" style={{ color: 'var(--text-secondary)' }}>{label}:</label>
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
      <label className="cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => !disabled && onChange(!checked)}>
        {label}
      </label>
    </div>
  )
}

import { useEffect, useState, useCallback } from 'react'
import TopologyMap from '../components/TopologyMap'
import { listDevices, listLinks, getTopology, saveTopology } from '../api/client'
import type { Device, Link, TopologyNode } from '../types/api'

export default function Topology() {
  const [devices, setDevices] = useState<Device[]>([])
  const [links, setLinks] = useState<Link[]>([])
  const [positions, setPositions] = useState<TopologyNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [devs, lnks, topo] = await Promise.all([listDevices(), listLinks(), getTopology()])
        setDevices(devs)
        setLinks(lnks)
        setPositions(topo)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load topology')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = useCallback(async (nodes: TopologyNode[]) => {
    try {
      await saveTopology(nodes)
      setPositions(nodes)
      setSaveError(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save topology')
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[12px]" style={{ color: 'var(--text-muted)' }}>
        Loading topology…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-[12px]" style={{ color: 'var(--status-down)' }}>
        Error: {error}
      </div>
    )
  }

  return (
    <div className="h-full relative">
      {saveError && (
        <div
          className="absolute top-1 left-1/2 -translate-x-1/2 z-50 text-[11px] px-3 py-1 shadow"
          style={{
            background: 'color-mix(in srgb, var(--status-down) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--status-down) 30%, transparent)',
            color: 'var(--status-down)',
          }}
        >
          Save failed: {saveError}
        </div>
      )}
      <TopologyMap devices={devices} links={links} positions={positions} onSave={handleSave} />
    </div>
  )
}

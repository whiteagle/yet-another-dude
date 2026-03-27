import { useEffect, useState, useCallback } from 'react'
import TopologyMap from '../components/TopologyMap'
import { listDevices, listLinks, getTopology, saveTopology } from '../api/client'
import type { Device, Link, TopologyNode } from '../types/api'

export default function Topology() {
  const [devices, setDevices] = useState<Device[]>([])
  const [links, setLinks] = useState<Link[]>([])
  const [positions, setPositions] = useState<TopologyNode[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [devs, lnks, topo] = await Promise.all([listDevices(), listLinks(), getTopology()])
        setDevices(devs)
        setLinks(lnks)
        setPositions(topo)
      } catch (err) {
        console.error('Failed to load topology:', err)
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
    } catch (err) {
      console.error('Failed to save topology:', err)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[12px] text-gray-500">
        Loading topology…
      </div>
    )
  }

  return (
    <div className="h-full">
      <TopologyMap devices={devices} links={links} positions={positions} onSave={handleSave} />
    </div>
  )
}

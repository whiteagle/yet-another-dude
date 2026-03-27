import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type NodeChange,
  type Edge,
  type NodeProps,
} from 'reactflow'
import 'reactflow/dist/style.css'
import type { Device, Link, TopologyNode } from '../types/api'
import { STATUS_COLORS } from '../types/api'

interface TopologyMapProps {
  devices: Device[]
  links?: Link[]
  positions: TopologyNode[]
  onSave: (nodes: TopologyNode[]) => void
}

// Hover tooltip matching The Dude's mouse-over popup exactly
function DeviceTooltip({ device }: { device: Device }) {
  return (
    <div
      className="absolute z-50 bg-white border border-gray-500 shadow-lg p-2 text-[11px] w-60 pointer-events-none leading-tight"
      style={{ bottom: 'calc(100% + 4px)', left: '50%', transform: 'translateX(-50%)' }}
    >
      <div className="font-bold text-gray-900 mb-1">
        {device.name} ({device.type})
      </div>
      <div>IP: {device.ip}</div>
      {device.mac && <div>MAC: {device.mac}</div>}
      {device.system_name && <div>System Name: {device.system_name}</div>}
      {device.description && <div>Description: {device.description}</div>}
      {device.routeros_version && <div>RouterOS: {device.routeros_version}</div>}
      {device.uptime_seconds != null && (
        <div>
          Uptime:{' '}
          {Math.floor(device.uptime_seconds / 86400)}d{' '}
          {Math.floor((device.uptime_seconds % 86400) / 3600)}h
        </div>
      )}
      {device.notes && (
        <div className="text-gray-500 italic mt-1">Notes: {device.notes}</div>
      )}
      <div className="mt-1 border-t border-gray-200 pt-1 font-semibold">
        Status: <span style={{ color: STATUS_COLORS[device.status] }}>{device.status}</span>
      </div>
    </div>
  )
}

// Format bits/sec to human readable
function fmtBps(bps: number | null): string {
  if (bps == null) return '?'
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} kbps`
  return `${bps} bps`
}

// Custom device node — solid colored rectangle like The Dude
// Colors: green=up, orange=partial, red=down, grey=unknown, blue=acked
function DeviceNode({ data }: NodeProps) {
  const { device } = data as { device: Device }
  const [hovered, setHovered] = useState(false)
  const bgColor = STATUS_COLORS[device.status] ?? STATUS_COLORS.unknown

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Handles on all 4 sides (invisible) */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 6, height: 6 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 6, height: 6 }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 6, height: 6 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 6, height: 6 }} />

      {/* The Dude-style device box: solid colored rectangle */}
      <div
        className="rounded-[3px] px-2 py-1 min-w-[110px] max-w-[160px] text-center cursor-pointer select-none"
        style={{
          backgroundColor: bgColor,
          border: '1px solid rgba(0,0,0,0.35)',
          boxShadow: '1px 2px 4px rgba(0,0,0,0.25)',
        }}
      >
        {/* Device name or IP */}
        <div className="text-[11px] text-white font-semibold leading-tight truncate">
          {device.name !== device.ip ? device.name : ''}
        </div>
        {/* IP address */}
        <div className="text-[10px] text-white/90 leading-tight">{device.ip}</div>
        {/* CPU / disk if available */}
        {(device.cpu_percent != null || device.disk_percent != null) && (
          <div className="text-[9px] text-white/80 leading-tight mt-0.5">
            {device.cpu_percent != null && `cpu: ${device.cpu_percent.toFixed(0)}%`}
            {device.cpu_percent != null && device.disk_percent != null && ' '}
            {device.disk_percent != null && `disk: ${device.disk_percent.toFixed(0)}%`}
          </div>
        )}
      </div>

      {hovered && <DeviceTooltip device={device} />}
    </div>
  )
}

const NODE_TYPES = { device: DeviceNode }

export default function TopologyMap({ devices, links = [], positions, onSave }: TopologyMapProps) {
  const posMap = useMemo(() => {
    const m = new Map<string, TopologyNode>()
    for (const p of positions) m.set(p.device_id, p)
    return m
  }, [positions])

  const buildNodes = useCallback(
    (devs: Device[]): Node[] =>
      devs.map((dev, i) => {
        const pos = posMap.get(dev.id)
        return {
          id: dev.id,
          type: 'device',
          position: pos
            ? { x: pos.x, y: pos.y }
            : { x: 80 + (i % 5) * 240, y: 80 + Math.floor(i / 5) * 150 },
          data: { device: dev },
        }
      }),
    [posMap]
  )

  const buildEdges = useCallback(
    (ls: Link[]): Edge[] =>
      ls
        .filter((l) => l.peer_device_id)
        .map((l) => ({
          id: l.id,
          source: l.device_id,
          target: l.peer_device_id!,
          type: 'default',
          animated: false,
          // Wireless links are thinner/dashed
          style: {
            stroke: '#333',
            strokeWidth: l.link_type === 'wireless' ? 1 : 2,
            strokeDasharray: l.link_type === 'wireless' ? '4 2' : undefined,
          },
          // Traffic label: Rx/Tx like The Dude
          label:
            l.rx_bps != null || l.tx_bps != null
              ? `Rx: ${fmtBps(l.rx_bps)}\nTx: ${fmtBps(l.tx_bps)}`
              : l.interface_name || undefined,
          labelStyle: {
            fontSize: 9,
            fill: '#333',
            fontFamily: 'Tahoma, Arial, sans-serif',
          },
          labelBgStyle: { fill: 'rgba(255,255,255,0.8)', stroke: 'none' },
        })),
    []
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(buildNodes(devices))
  const [edges, , onEdgesChange] = useEdgesState(buildEdges(links))

  // Sync nodes when devices/positions change
  useEffect(() => {
    setNodes(buildNodes(devices))
  }, [devices, buildNodes, setNodes])

  useEffect(() => {
    // @ts-ignore
    setEdges(buildEdges(links))
  }, [links, buildEdges])

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes)
      const hasDragStop = changes.some(
        (c) => c.type === 'position' && !('dragging' in c && c.dragging)
      )
      if (hasDragStop) {
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => {
          setNodes((current) => {
            onSave(
              current.map((n) => ({ device_id: n.id, x: n.position.x, y: n.position.y }))
            )
            return current
          })
        }, 600)
      }
    },
    [onNodesChange, onSave, setNodes]
  )

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        minZoom={0.1}
        maxZoom={5}
        style={{ background: '#f8f8f8' }}
        defaultEdgeOptions={{ type: 'default' }}
      >
        {/* Light grey grid — matches The Dude's map background */}
        <Background
          variant={BackgroundVariant.Lines}
          gap={20}
          color="#d8d8d8"
          lineWidth={0.5}
        />
        <Controls
          style={{ background: '#d4d0c8', border: '1px solid #808080' }}
        />
        <MiniMap
          nodeColor={(n) => {
            const dev = devices.find((d) => d.id === n.id)
            return STATUS_COLORS[dev?.status ?? 'unknown']
          }}
          style={{ background: '#f0f0ee', border: '1px solid #aaa' }}
          maskColor="rgba(0,0,0,0.06)"
        />
      </ReactFlow>
    </div>
  )
}

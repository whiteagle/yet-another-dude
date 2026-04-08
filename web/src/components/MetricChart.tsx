import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getMetrics } from '../api/client'
import type { Metric } from '../types/api'

interface MetricChartProps {
  deviceId: string
  metricName: string
  title: string
  color?: string
  hours?: number
}

interface ChartDataPoint {
  time: string
  value: number
  timestamp: number
}

export default function MetricChart({
  deviceId,
  metricName,
  title,
  color = 'var(--chart-default-color)',
  hours = 1,
}: MetricChartProps) {
  const [data, setData] = useState<ChartDataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const now = new Date()
        const from = new Date(now.getTime() - hours * 60 * 60 * 1000)
        const metrics = await getMetrics(deviceId, {
          name: metricName,
          from: from.toISOString(),
          to: now.toISOString(),
        })

        const chartData: ChartDataPoint[] = metrics.map((m: Metric) => ({
          time: new Date(m.timestamp).toLocaleTimeString(),
          value: m.value,
          timestamp: new Date(m.timestamp).getTime(),
        }))

        setData(chartData)
      } catch (err) {
        console.error(`Failed to load metrics for ${metricName}:`, err)
      } finally {
        setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [deviceId, metricName, hours])

  if (loading) {
    return (
      <div
        className="rounded-lg p-4 h-48 flex items-center justify-center"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading {title}...</span>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div
        className="rounded-lg p-4 h-48 flex items-center justify-center"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>No data for {title}</span>
      </div>
    )
  }

  return (
    <div className="rounded-lg p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>{title}</h4>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis
            dataKey="time"
            stroke="var(--chart-axis)"
            fontSize={11}
            tickLine={false}
          />
          <YAxis stroke="var(--chart-axis)" fontSize={11} tickLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--chart-tooltip-bg)',
              border: '1px solid var(--chart-tooltip-border)',
              borderRadius: '6px',
              fontSize: '12px',
              color: 'var(--text-primary)',
            }}
            labelStyle={{ color: 'var(--chart-tooltip-label)' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

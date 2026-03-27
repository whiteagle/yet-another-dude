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
  color = '#34d399',
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
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 h-48 flex items-center justify-center">
        <span className="text-gray-500 text-sm">Loading {title}...</span>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 h-48 flex items-center justify-center">
        <span className="text-gray-500 text-sm">No data for {title}</span>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-400 mb-3">{title}</h4>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="time"
            stroke="#6b7280"
            fontSize={11}
            tickLine={false}
          />
          <YAxis stroke="#6b7280" fontSize={11} tickLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '6px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#9ca3af' }}
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

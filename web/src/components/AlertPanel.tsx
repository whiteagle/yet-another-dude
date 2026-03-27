import { AlertTriangle } from 'lucide-react'
import type { AlertEvent } from '../types/api'

interface AlertPanelProps {
  alerts: AlertEvent[]
}

export default function AlertPanel({ alerts }: AlertPanelProps) {
  if (alerts.length === 0) {
    return (
      <div className="text-gray-500 text-sm py-4 text-center">
        No recent alerts.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-800"
        >
          <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm">{alert.message}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span>Device: {alert.device_id.slice(0, 8)}...</span>
              <span>Value: {alert.value.toFixed(2)}</span>
              <span>{new Date(alert.triggered_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

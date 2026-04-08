import { AlertTriangle } from 'lucide-react'
import type { AlertEvent } from '../types/api'

interface AlertPanelProps {
  alerts: AlertEvent[]
}

export default function AlertPanel({ alerts }: AlertPanelProps) {
  if (alerts.length === 0) {
    return (
      <div className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
        No recent alerts.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-start gap-3 p-3 rounded-lg"
          style={{
            background: 'var(--bg-highlight)',
            border: '1px solid var(--border)',
          }}
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--status-partial)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{alert.message}</p>
            <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
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

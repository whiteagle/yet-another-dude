import { useEffect, useRef, useState } from 'react'
import { getAlertHistory, listSyslogMessages } from '../api/client'
import type { AlertEvent, SyslogMessage } from '../types/api'

type Tab = 'event' | 'syslog' | 'action' | 'debug'

const SEVERITY_COLOR: Record<number, string> = {
  0: 'var(--status-down)',     // EMERG
  1: 'var(--status-down)',     // ALERT
  2: 'var(--status-down)',     // CRIT
  3: 'var(--status-down)',     // ERR
  4: 'var(--status-partial)',  // WARNING
  5: 'var(--accent)',          // NOTICE
  6: 'var(--text-secondary)',  // INFO
  7: 'var(--text-muted)',      // DEBUG
}

const SEVERITY_NAME = ['EMERG', 'ALERT', 'CRIT', 'ERR', 'WARN', 'NOTICE', 'INFO', 'DEBUG']

export default function Logs() {
  const [tab, setTab] = useState<Tab>('event')
  const [events, setEvents] = useState<AlertEvent[]>([])
  const [syslog, setSyslog] = useState<SyslogMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setError(null)
    setLoading(true)

    if (tab === 'event') {
      getAlertHistory(500)
        .then(setEvents)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load alert history'))
        .finally(() => setLoading(false))
    } else if (tab === 'syslog') {
      listSyslogMessages(500)
        .then(setSyslog)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load syslog messages'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events, syslog])

  const count = tab === 'event' ? events.length : tab === 'syslog' ? syslog.length : 0

  return (
    <div className="flex flex-col h-full text-[12px]">
      {/* Tab bar */}
      <div
        className="flex items-end px-1 shrink-0 h-5"
        style={{ background: 'var(--chrome-bg)', borderBottom: '1px solid var(--chrome-border)' }}
      >
        {(['event', 'syslog', 'action', 'debug'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3 py-0 text-[11px] border border-b-0 mr-[1px] capitalize select-none"
            style={{
              background: tab === t ? 'var(--bg-base)' : 'var(--chrome-bg)',
              borderColor: tab === t ? 'var(--chrome-border)' : 'transparent',
              color: tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
              marginBottom: tab === t ? -1 : 0,
              position: tab === t ? 'relative' : undefined,
              zIndex: tab === t ? 10 : 0,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Log output area — monospace */}
      <div className="flex-1 overflow-auto font-mono p-1" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        {loading && (
          <div className="p-2" style={{ color: 'var(--text-muted)' }}>Loading…</div>
        )}
        {!loading && error && (
          <div className="p-2" style={{ color: 'var(--status-down)' }}>Error: {error}</div>
        )}

        {/* Alert events */}
        {!loading && !error && tab === 'event' && (
          events.length === 0
            ? <div className="p-2" style={{ color: 'var(--text-muted)' }}>No alert events</div>
            : events.map((e) => (
              <div key={e.id} className="leading-[1.4]" style={{ color: 'var(--status-partial)' }}>
                <span className="mr-2 select-none" style={{ color: 'var(--text-muted)' }}>
                  {new Date(e.triggered_at).toLocaleTimeString()}
                </span>
                <span className="text-[10px] font-bold mr-2">[ALERT]</span>
                {e.message}
                <span className="ml-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>device:{e.device_id.slice(0, 8)}</span>
              </div>
            ))
        )}

        {/* Syslog messages — syslog fields (hostname, tag, message) are rendered as JSX text
            children, which React auto-escapes, so no XSS risk from untrusted device data. */}
        {!loading && !error && tab === 'syslog' && (
          syslog.length === 0
            ? <div className="p-2" style={{ color: 'var(--text-muted)' }}>No syslog messages. Enable the syslog server in Preferences → Syslog.</div>
            : [...syslog].reverse().map((m) => (
              <div key={m.id} className="leading-[1.4]" style={{ color: SEVERITY_COLOR[m.severity] ?? 'var(--text-secondary)' }}>
                <span className="mr-2 select-none" style={{ color: 'var(--text-muted)' }}>
                  {new Date(m.received_at).toLocaleTimeString()}
                </span>
                <span className="text-[10px] font-bold mr-2">
                  [{SEVERITY_NAME[m.severity] ?? '?'}]
                </span>
                {m.hostname && <span className="mr-1" style={{ color: 'var(--accent)' }}>{m.hostname}</span>}
                {m.tag && <span className="mr-1" style={{ color: 'var(--status-partial)' }}>{m.tag}:</span>}
                {m.message}
              </div>
            ))
        )}

        {/* Action / Debug — backend streaming not yet implemented */}
        {!loading && !error && (tab === 'action' || tab === 'debug') && (
          <div className="p-2" style={{ color: 'var(--text-muted)' }}>
            Real-time {tab} log streaming is not yet implemented.
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Status bar */}
      <div
        className="px-2 py-[1px] text-[11px] shrink-0"
        style={{ background: 'var(--chrome-bg)', borderTop: '1px solid var(--chrome-border)', color: 'var(--text-secondary)' }}
      >
        {count > 0 ? `${count} entries` : ''}
      </div>
    </div>
  )
}

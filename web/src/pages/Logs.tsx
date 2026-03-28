import { useEffect, useRef, useState } from 'react'
import { getAlertHistory, listSyslogMessages } from '../api/client'
import type { AlertEvent, SyslogMessage } from '../types/api'

type Tab = 'event' | 'syslog' | 'action' | 'debug'

const SEVERITY_COLOR: Record<number, string> = {
  0: 'text-red-700',   // EMERG
  1: 'text-red-600',   // ALERT
  2: 'text-red-500',   // CRIT
  3: 'text-red-500',   // ERR
  4: 'text-orange-500', // WARNING
  5: 'text-blue-600',  // NOTICE
  6: 'text-gray-700',  // INFO
  7: 'text-gray-400',  // DEBUG
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
      <div className="bg-[#d4d0c8] border-b border-[#808080] flex items-end px-1 shrink-0 h-5">
        {(['event', 'syslog', 'action', 'debug'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-0 text-[11px] border border-b-0 mr-[1px] capitalize select-none
              ${tab === t
                ? 'bg-white border-[#808080] -mb-px z-10 relative'
                : 'bg-[#d4d0c8] border-transparent text-gray-600 hover:bg-[#ece9d8]'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Log output area — monospace */}
      <div className="flex-1 overflow-auto bg-white font-mono p-1">
        {loading && (
          <div className="text-gray-400 p-2">Loading…</div>
        )}
        {!loading && error && (
          <div className="text-red-600 p-2">Error: {error}</div>
        )}

        {/* Alert events */}
        {!loading && !error && tab === 'event' && (
          events.length === 0
            ? <div className="text-gray-400 p-2">No alert events</div>
            : events.map((e) => (
              <div key={e.id} className="leading-[1.4] text-orange-600">
                <span className="text-gray-400 mr-2 select-none">
                  {new Date(e.triggered_at).toLocaleTimeString()}
                </span>
                <span className="text-[10px] font-bold mr-2">[ALERT]</span>
                {e.message}
                <span className="text-gray-400 ml-2 text-[10px]">device:{e.device_id.slice(0, 8)}</span>
              </div>
            ))
        )}

        {/* Syslog messages */}
        {!loading && !error && tab === 'syslog' && (
          syslog.length === 0
            ? <div className="text-gray-400 p-2">No syslog messages. Enable the syslog server in Preferences → Syslog.</div>
            : [...syslog].reverse().map((m) => (
              <div key={m.id} className={`leading-[1.4] ${SEVERITY_COLOR[m.severity] ?? 'text-gray-700'}`}>
                <span className="text-gray-400 mr-2 select-none">
                  {new Date(m.received_at).toLocaleTimeString()}
                </span>
                <span className="text-[10px] font-bold mr-2">
                  [{SEVERITY_NAME[m.severity] ?? '?'}]
                </span>
                {m.hostname && <span className="text-blue-500 mr-1">{m.hostname}</span>}
                {m.tag && <span className="text-purple-600 mr-1">{m.tag}:</span>}
                {m.message}
              </div>
            ))
        )}

        {/* Action / Debug — backend streaming not yet implemented */}
        {!loading && !error && (tab === 'action' || tab === 'debug') && (
          <div className="text-gray-400 p-2">
            Real-time {tab} log streaming is not yet implemented.
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Status bar */}
      <div className="bg-[#d4d0c8] border-t border-[#808080] px-2 py-[1px] text-[11px] text-gray-600 shrink-0">
        {count > 0 ? `${count} entries` : ''}
      </div>
    </div>
  )
}

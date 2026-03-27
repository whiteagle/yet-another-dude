import { useEffect, useRef, useState } from 'react'

interface LogEntry {
  ts: string
  level: 'info' | 'warn' | 'error'
  msg: string
}

// Real-time log viewer using Server-Sent Events (when backend supports it)
// Falls back to polling alert history as a placeholder
export default function Logs() {
  const [entries] = useState<LogEntry[]>([
    { ts: new Date().toISOString(), level: 'info', msg: 'Yet Another Dude started' },
  ])
  const [tab, setTab] = useState<'action' | 'event' | 'debug'>('event')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  const levelColor: Record<string, string> = {
    info: 'text-gray-700',
    warn: 'text-orange-600',
    error: 'text-red-600',
  }

  return (
    <div className="flex flex-col h-full text-[12px]">
      {/* Tab bar */}
      <div className="bg-[#d4d0c8] border-b border-[#808080] flex items-end px-1 shrink-0 h-5">
        {(['event', 'action', 'debug'] as const).map((t) => (
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

      {/* Log output area — monospace, light background */}
      <div className="flex-1 overflow-auto bg-white border-0 font-mono p-1">
        {entries.map((e, i) => (
          <div key={i} className={`leading-[1.4] ${levelColor[e.level]}`}>
            <span className="text-gray-400 mr-2 select-none">
              {new Date(e.ts).toLocaleTimeString()}
            </span>
            <span className="uppercase mr-2 text-[10px] font-bold">
              [{e.level}]
            </span>
            {e.msg}
          </div>
        ))}
        {entries.length === 0 && (
          <div className="text-gray-400 p-2">No log entries</div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Status bar */}
      <div className="bg-[#d4d0c8] border-t border-[#808080] px-2 py-[1px] text-[11px] text-gray-600 shrink-0">
        {entries.length} entries
      </div>
    </div>
  )
}

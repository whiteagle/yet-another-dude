import { useState } from 'react'

export default function Settings() {
  const [pollInterval, setPollInterval] = useState('30')
  const [snmpCommunity, setSnmpCommunity] = useState('public')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    // Settings are stored server-side via CLI flags for now
    // This page serves as a reference/documentation
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h2 className="text-2xl font-bold">Settings</h2>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-lg">Polling Configuration</h3>
        <p className="text-sm text-gray-400">
          These settings are configured via command-line flags when starting YAD.
          Restart required for changes to take effect.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Poll Interval (seconds)
            </label>
            <input
              type="number"
              value={pollInterval}
              onChange={(e) => setPollInterval(e.target.value)}
              min="5"
              max="3600"
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm w-32 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Default SNMP Community
            </label>
            <input
              type="text"
              value={snmpCommunity}
              onChange={(e) => setSnmpCommunity(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm w-64 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-sm transition-colors"
          >
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-lg">CLI Reference</h3>
        <pre className="bg-gray-950 rounded p-4 text-sm text-gray-300 overflow-x-auto">
{`yad \\
  --listen :8080 \\
  --db yad.db \\
  --poll-interval 30s \\
  --snmp-community public \\
  --snmp-timeout 5s \\
  --max-workers 256 \\
  --log-level info`}
        </pre>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-lg">About</h3>
        <div className="text-sm text-gray-400 space-y-1">
          <p><strong className="text-gray-300">YAD</strong> - Yet Another Dude</p>
          <p>Open-source network monitoring, inspired by MikroTik The Dude.</p>
          <p>Licensed under MIT</p>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import PrefsDialog from '../components/PrefsDialog'

// The Settings route shows the Preferences dialog inline.
// All settings are persisted server-side via GET/PUT /api/v1/settings.
export default function Settings() {
  const [open, setOpen] = useState(true)
  return (
    <>
      {open && <PrefsDialog onClose={() => setOpen(false)} />}
      {!open && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: 'Tahoma, Arial, sans-serif' }}>
          <button onClick={() => setOpen(true)} style={{ padding: '4px 20px', fontSize: 12, cursor: 'pointer', background: 'var(--chrome-bg)', border: '1px solid var(--chrome-border)', color: 'var(--text-primary)' }}>
            Open Preferences
          </button>
        </div>
      )}
    </>
  )
}

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
          <button onClick={() => setOpen(true)} style={{ padding: '4px 20px', fontSize: 12, cursor: 'pointer', background: '#d4d0c8', border: '1px solid #808080', boxShadow: 'inset 1px 1px #fff, inset -1px -1px #808080' }}>
            Open Preferences
          </button>
        </div>
      )}
    </>
  )
}

import { useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Topology from './pages/Topology'
import Devices from './pages/Devices'
import SettingsPage from './pages/Settings'
import Outages from './pages/Outages'
import Services from './pages/Services'
import Logs from './pages/Logs'
import DiscoveryWizard from './components/DiscoveryWizard'
import PrefsDialog from './components/PrefsDialog'

// Contents tree — mirrors The Dude's left panel structure exactly
interface MenuItem {
  label: string
  path?: string
  children?: MenuItem[]
}

const MENU_ITEMS: MenuItem[] = [
  { label: 'Address Lists', path: '/address-lists' },
  { label: 'Admins', path: '/admins' },
  { label: 'Charts', children: [{ label: 'Chart Chart', path: '/charts' }] },
  { label: 'Devices', path: '/devices' },
  { label: 'Files', path: '/files' },
  { label: 'Functions', path: '/functions' },
  { label: 'History Actions', path: '/history' },
  { label: 'Links', path: '/links' },
  {
    label: 'Logs',
    children: [
      { label: 'Action', path: '/logs/action' },
      { label: 'Debug', path: '/logs/debug' },
      { label: 'Event', path: '/logs/event' },
      { label: 'Syslog', path: '/logs/syslog' },
    ],
  },
  { label: 'Mib Nodes', path: '/mib' },
  {
    label: 'Network Maps',
    children: [
      { label: 'Local', path: '/' },
      { label: 'Networks', path: '/networks' },
    ],
  },
  { label: 'Notifications', path: '/notifications' },
  { label: 'Outages', path: '/outages' },
  { label: 'Panels', path: '/panels' },
  { label: 'Probes', path: '/probes' },
  { label: 'Services', path: '/services' },
  { label: 'Tools', path: '/tools' },
]

interface TreeNodeProps {
  item: MenuItem
  depth?: number
}

function TreeNode({ item, depth = 0 }: TreeNodeProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const hasChildren = !!(item.children && item.children.length > 0)
  const childIsActive = hasChildren && item.children!.some((c) => c.path === location.pathname)
  const [open, setOpen] = useState(childIsActive)
  const isActive = item.path === location.pathname

  const handleClick = () => {
    if (hasChildren) setOpen((v) => !v)
    else if (item.path) navigate(item.path)
  }

  return (
    <div>
      <div
        role={hasChildren ? 'button' : 'link'}
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() } }}
        aria-expanded={hasChildren ? open : undefined}
        aria-current={isActive ? 'page' : undefined}
        className="flex items-center gap-0.5 py-[1px] cursor-pointer select-none text-[12px]"
        style={{
          paddingLeft: `${4 + depth * 12}px`,
          backgroundColor: isActive ? 'var(--select-bg)' : undefined,
          color: isActive ? '#fff' : 'var(--text-primary)',
        }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--select-hover)' }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = '' }}
      >
        {hasChildren ? (
          open ? (
            <ChevronDown className="w-3 h-3 shrink-0" style={{ color: 'var(--text-secondary)' }} />
          ) : (
            <ChevronRight className="w-3 h-3 shrink-0" style={{ color: 'var(--text-secondary)' }} />
          )
        ) : (
          <span className="w-3 h-3 shrink-0 inline-block" />
        )}
        {item.label}
      </div>
      {hasChildren && open && (
        <div>
          {item.children!.map((child) => (
            <TreeNode key={child.label} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

// Windows XP-style button
function WinBtn({ children, onClick, title, className = '' }: {
  children: React.ReactNode
  onClick?: () => void
  title?: string
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-2 py-[1px] text-[11px]
        ${className}`}
      style={{
        background: 'var(--chrome-bg)',
        border: '1px solid var(--chrome-border)',
        color: 'var(--text-primary)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--chrome-hover)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--chrome-bg)' }}
    >
      {children}
    </button>
  )
}

// Toolbar is aware of current route so buttons do the right thing
function Toolbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [showDiscovery, setShowDiscovery] = useState(false)
  const isTopology = location.pathname === '/' || location.pathname === '/topology'

  return (
    <>
      <div
        className="flex items-center gap-[2px] px-1 py-[2px] shrink-0"
        style={{ background: 'var(--chrome-bg)', borderBottom: '1px solid var(--chrome-border)' }}
      >
        <WinBtn title="Add device" onClick={() => navigate('/devices')}>+</WinBtn>
        <WinBtn title="Remove">−</WinBtn>
        <WinBtn title="Copy">⎘</WinBtn>
        <WinBtn title="Paste">📋</WinBtn>
        <WinBtn title="Lock">🔒</WinBtn>
        <WinBtn title="Drag mode">✥</WinBtn>
        <WinBtn title="Select mode">↖</WinBtn>
        <div className="w-px h-4 mx-0.5" style={{ background: 'var(--chrome-border)' }} />
        <WinBtn onClick={() => navigate('/settings')}>Settings</WinBtn>
        <WinBtn onClick={() => setShowDiscovery(true)}>Discover</WinBtn>
        <ToolsMenu />
        <div className="w-px h-4 mx-0.5" style={{ background: 'var(--chrome-border)' }} />
        <WinBtn title="Find device">🔍</WinBtn>
        {isTopology && <WinBtn title="Align in rows">⠿</WinBtn>}
        {isTopology && <WinBtn title="Align in circle">◎</WinBtn>}
        <div className="flex-1" />
        <span className="text-[11px] mr-0.5" style={{ color: 'var(--text-secondary)' }}>Layer:</span>
        <select className="text-[11px] h-5 px-0.5" style={{ border: '1px solid var(--chrome-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
          <option>links</option>
          <option>dependencies</option>
        </select>
        <span className="text-[11px] ml-1 mr-0.5" style={{ color: 'var(--text-secondary)' }}>Zoom:</span>
        <select className="text-[11px] h-5 px-0.5 w-16" style={{ border: '1px solid var(--chrome-border)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
          <option>100%</option>
          <option>75%</option>
          <option>50%</option>
          <option>150%</option>
          <option>200%</option>
        </select>
      </div>

      {/* Discovery wizard overlay — rendered at toolbar level so it works from toolbar */}
      {showDiscovery && <DiscoveryWizard onClose={() => setShowDiscovery(false)} />}
    </>
  )
}

// ▼ Tools dropdown menu
function ToolsMenu() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const items = [
    { label: 'Ping…', action: () => {} },
    { label: 'Traceroute…', action: () => {} },
    { label: 'DNS Lookup…', action: () => {} },
    { label: '─', action: () => {} },
    { label: 'Outages', action: () => navigate('/outages') },
    { label: 'Services', action: () => navigate('/services') },
    { label: 'Logs', action: () => navigate('/logs/event') },
  ]

  return (
    <div className="relative">
      <WinBtn onClick={() => setOpen((v) => !v)}>▼ Tools</WinBtn>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full left-0 z-50 min-w-[140px] py-0.5 text-[12px]"
            style={{
              background: 'var(--chrome-panel)',
              border: '1px solid var(--chrome-border)',
              boxShadow: '2px 2px 4px rgba(0,0,0,0.3)',
              color: 'var(--text-primary)',
            }}
          >
            {items.map((item) =>
              item.label === '─' ? (
                <div key="sep" className="my-0.5" style={{ borderTop: '1px solid var(--chrome-border)' }} />
              ) : (
                <div
                  key={item.label}
                  onClick={() => { item.action(); setOpen(false) }}
                  className="px-4 py-[2px] cursor-default"
                  style={{ color: 'var(--text-primary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--select-bg)'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-primary)' }}
                >
                  {item.label}
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function App() {
  const [showPrefs, setShowPrefs] = useState(false)

  return (
    <div className="flex flex-col h-screen font-[Tahoma,Arial,sans-serif]" style={{ background: 'var(--chrome-panel)', color: 'var(--text-primary)' }}>
      {/* Top header bar */}
      <header
        className="flex items-center gap-1 px-1 py-[2px] shrink-0"
        style={{ background: 'var(--chrome-bg)', borderBottom: '1px solid var(--chrome-border)' }}
      >
        <WinBtn onClick={() => setShowPrefs(true)}>Preferences</WinBtn>
        <div
          className="flex items-center gap-1 px-2 py-[1px] text-[11px]"
          style={{
            background: 'var(--chrome-bg)',
            border: '1px solid var(--chrome-border)',
            color: 'var(--text-primary)',
          }}
        >
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--status-up)' }} />
          Local Server
        </div>
        <WinBtn>Help</WinBtn>
        <div className="flex-1" />
        <span className="text-[10px] italic pr-2" style={{ color: 'var(--text-muted)' }}>Yet Another Dude v0.1</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: Contents tree */}
        <aside
          className="w-44 flex flex-col shrink-0 overflow-hidden"
          style={{ background: 'var(--bg-base)', borderRight: '1px solid var(--chrome-border)' }}
        >
          <div
            className="px-2 py-[1px] text-[11px] font-bold"
            style={{ background: 'var(--chrome-bg)', borderBottom: '1px solid var(--chrome-border)', color: 'var(--text-primary)' }}
          >
            Contents /
          </div>
          <div className="flex-1 overflow-y-auto py-0.5">
            {MENU_ITEMS.map((item) => (
              <TreeNode key={item.label} item={item} />
            ))}
          </div>
          <div
            className="h-24 flex items-center justify-center shrink-0"
            style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-highlight)' }}
          >
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>[ mini map ]</span>
          </div>
        </aside>

        {/* Main area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar — route-aware */}
          <Toolbar />

          {/* Pane tab */}
          <div
            className="flex items-end px-1 shrink-0 h-5"
            style={{ background: 'var(--chrome-bg)', borderBottom: '1px solid var(--chrome-border)' }}
          >
            <div
              className="px-3 py-0 text-[11px] -mb-px"
              style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--chrome-border)',
                borderBottom: '1px solid var(--bg-base)',
                color: 'var(--text-primary)',
              }}
            >
              ▼ Local
            </div>
          </div>

          {/* Page content */}
          <div className="flex-1 overflow-hidden">
            <Routes>
              <Route path="/" element={<Topology />} />
              <Route path="/topology" element={<Topology />} />
              <Route path="/devices" element={<Devices />} />
              <Route path="/services" element={<Services />} />
              <Route path="/outages" element={<Outages />} />
              <Route path="/logs/*" element={<Logs />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/dashboard" element={<Dashboard />} />
            </Routes>
          </div>
        </main>
      </div>

      {/* Status bar */}
      <footer
        className="flex items-center px-2 text-[11px] shrink-0 h-5"
        style={{ background: 'var(--chrome-bg)', borderTop: '1px solid var(--chrome-border)' }}
      >
        <span className="font-semibold mr-4" style={{ color: 'var(--status-up)' }}>Connected</span>
        <span style={{ color: 'var(--text-secondary)' }}>Client: rx 0 bps / tx 0 bps</span>
        <div className="flex-1" />
        <span style={{ color: 'var(--text-secondary)' }}>Server: rx 0 bps / tx 0 bps</span>
      </footer>

      {showPrefs && <PrefsDialog onClose={() => setShowPrefs(false)} />}
    </div>
  )
}

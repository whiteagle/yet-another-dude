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
        onClick={handleClick}
        className={`flex items-center gap-0.5 py-[1px] cursor-pointer select-none text-[12px]
          ${isActive ? 'bg-[#0066cc] text-white' : 'text-gray-900 hover:bg-[#cce8ff]'}
        `}
        style={{ paddingLeft: `${4 + depth * 12}px` }}
      >
        {hasChildren ? (
          open ? (
            <ChevronDown className="w-3 h-3 shrink-0 text-gray-500" />
          ) : (
            <ChevronRight className="w-3 h-3 shrink-0 text-gray-500" />
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

// Windows XP–style button
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
      className={`px-2 py-[1px] bg-[#d4d0c8] border border-[#808080] text-[11px] hover:bg-[#ece9d8]
        shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#808080] active:shadow-[inset_1px_1px_#808080,inset_-1px_-1px_#fff]
        ${className}`}
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
  const [showPrefs, setShowPrefs] = useState(false)
  const isTopology = location.pathname === '/' || location.pathname === '/topology'

  return (
    <>
      <div className="bg-[#d4d0c8] border-b border-[#808080] flex items-center gap-[2px] px-1 py-[2px] shrink-0">
        <WinBtn title="Add device" onClick={() => navigate('/devices')}>+</WinBtn>
        <WinBtn title="Remove">−</WinBtn>
        <WinBtn title="Copy">⎘</WinBtn>
        <WinBtn title="Paste">📋</WinBtn>
        <WinBtn title="Lock">🔒</WinBtn>
        <WinBtn title="Drag mode">✥</WinBtn>
        <WinBtn title="Select mode">↖</WinBtn>
        <div className="w-px h-4 bg-[#808080] mx-0.5" />
        <WinBtn onClick={() => navigate('/settings')}>Settings</WinBtn>
        <WinBtn onClick={() => setShowDiscovery(true)}>Discover</WinBtn>
        <ToolsMenu />
        <div className="w-px h-4 bg-[#808080] mx-0.5" />
        <WinBtn title="Find device">🔍</WinBtn>
        {isTopology && <WinBtn title="Align in rows">⠿</WinBtn>}
        {isTopology && <WinBtn title="Align in circle">◎</WinBtn>}
        <div className="flex-1" />
        <span className="text-[11px] text-gray-600 mr-0.5">Layer:</span>
        <select className="text-[11px] border border-[#808080] bg-white h-5 px-0.5">
          <option>links</option>
          <option>dependencies</option>
        </select>
        <span className="text-[11px] text-gray-600 ml-1 mr-0.5">Zoom:</span>
        <select className="text-[11px] border border-[#808080] bg-white h-5 px-0.5 w-16">
          <option>100%</option>
          <option>75%</option>
          <option>50%</option>
          <option>150%</option>
          <option>200%</option>
        </select>
      </div>

      {/* Discovery wizard overlay — rendered at app level so it works from toolbar */}
      {showDiscovery && <DiscoveryOverlay onClose={() => setShowDiscovery(false)} />}
      {showPrefs && <PrefsDialog onClose={() => setShowPrefs(false)} />}
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
          <div className="absolute top-full left-0 z-50 bg-[#ece9d8] border border-[#808080]
            shadow-[2px_2px_4px_rgba(0,0,0,0.3)] min-w-[140px] py-0.5 text-[12px]">
            {items.map((item) =>
              item.label === '─' ? (
                <div key="sep" className="border-t border-[#808080] my-0.5" />
              ) : (
                <div
                  key={item.label}
                  onClick={() => { item.action(); setOpen(false) }}
                  className="px-4 py-[2px] hover:bg-[#0066cc] hover:text-white cursor-default"
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

import DiscoveryWizard from './components/DiscoveryWizard'
import PrefsDialog from './components/PrefsDialog'

function DiscoveryOverlay({ onClose }: { onClose: () => void }) {
  return <DiscoveryWizard onClose={onClose} />
}

export default function App() {
  const [showPrefs, setShowPrefs] = useState(false)

  return (
    <div className="flex flex-col h-screen bg-[#ece9d8] text-gray-900 font-[Tahoma,Arial,sans-serif]">
      {/* Top header bar */}
      <header className="bg-[#d4d0c8] border-b border-[#808080] flex items-center gap-1 px-1 py-[2px] shrink-0">
        <WinBtn onClick={() => setShowPrefs(true)}>Preferences</WinBtn>
        <div className="flex items-center gap-1 px-2 py-[1px] bg-[#d4d0c8] border border-[#808080]
          shadow-[inset_1px_1px_#fff,inset_-1px_-1px_#808080] text-[11px]">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          Local Server
        </div>
        <WinBtn>Help</WinBtn>
        <div className="flex-1" />
        <span className="text-[10px] text-gray-500 italic pr-2">Yet Another Dude v0.1</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: Contents tree */}
        <aside className="w-44 bg-white border-r border-[#808080] flex flex-col shrink-0 overflow-hidden">
          <div className="bg-[#d4d0c8] border-b border-[#808080] px-2 py-[1px] text-[11px] font-bold">
            Contents /
          </div>
          <div className="flex-1 overflow-y-auto py-0.5">
            {MENU_ITEMS.map((item) => (
              <TreeNode key={item.label} item={item} />
            ))}
          </div>
          <div className="h-24 border-t border-gray-300 bg-[#f0f0f0] flex items-center justify-center shrink-0">
            <span className="text-[10px] text-gray-400">[ mini map ]</span>
          </div>
        </aside>

        {/* Main area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar — route-aware */}
          <Toolbar />

          {/* Pane tab */}
          <div className="bg-[#d4d0c8] border-b border-[#808080] flex items-end px-1 shrink-0 h-5">
            <div className="bg-white border border-b-white border-[#808080] px-3 py-0 text-[11px] text-gray-800 -mb-px">
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
      <footer className="bg-[#d4d0c8] border-t border-[#808080] flex items-center px-2 text-[11px] shrink-0 h-5">
        <span className="text-green-700 font-semibold mr-4">Connected</span>
        <span className="text-gray-600">Client: rx 0 bps / tx 0 bps</span>
        <div className="flex-1" />
        <span className="text-gray-600">Server: rx 0 bps / tx 0 bps</span>
      </footer>

      {showPrefs && <PrefsDialog onClose={() => setShowPrefs(false)} />}
    </div>
  )
}

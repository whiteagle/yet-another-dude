import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Mock heavy page components — toolbar tests don't care about page content
vi.mock('../pages/Topology', () => ({ default: () => <div data-testid="page-topology" /> }))
vi.mock('../pages/Devices', () => ({ default: () => <div data-testid="page-devices" /> }))
vi.mock('../pages/Services', () => ({ default: () => <div data-testid="page-services" /> }))
vi.mock('../pages/Outages', () => ({ default: () => <div data-testid="page-outages" /> }))
vi.mock('../pages/Logs', () => ({ default: () => <div data-testid="page-logs" /> }))
vi.mock('../pages/Settings', () => ({ default: () => <div data-testid="page-settings" /> }))
vi.mock('../pages/Dashboard', () => ({ default: () => <div data-testid="page-dashboard" /> }))

// Mock DiscoveryWizard
vi.mock('../components/DiscoveryWizard', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="discovery-wizard">
      <button onClick={onClose}>Close Wizard</button>
    </div>
  ),
}))

// Mock API so PrefsDialog loads without a real server
vi.mock('../api/client', () => ({
  getSettings: vi.fn().mockResolvedValue({
    undo_queue_size: 32, db_commit_interval_sec: 30, mac_mapping_refresh_sec: 300,
    ask_confirm_remove: true, resolve_mac_manufacturer: true, contents_pane_behavior: 'single_click',
    primary_dns: '8.8.8.8', secondary_dns: '8.8.4.4',
    snmp_default_port: 161, snmp_timeout_sec: 3,
    probe_interval_sec: 30, probe_timeout_sec: 10, probe_down_count: 5,
    notify_popup: true, notify_beep: false, notify_email: false, notify_program: false,
    server_port: 8080, server_secure_port: 8443, server_allowed_networks: '',
    web_enabled: true, web_port: 8080, web_secure_port: 8443,
    web_allowed_networks: '', web_session_timeout: 3600, web_refresh_interval: 60,
    syslog_enabled: false, syslog_port: 514, syslog_log_file: 'syslog',
    syslog_start_new_file: 'never', syslog_logs_to_keep: 10, syslog_buffered_entries: 100,
    primary_smtp: '', secondary_smtp: '', smtp_from: '',
    map_antialiased: true, map_gradients: true,
    chart_value_keep_days: 90,
    report_font_family: 'DejaVu Sans', report_font_size: 10,
    discover_item_width: 90, discover_item_height: 60, discover_group_size: 10,
    routeros_timeout_sec: 5, routeros_interval_sec: 60,
  }),
  saveSettings: vi.fn().mockResolvedValue({}),
  listDevices: vi.fn().mockResolvedValue([]),
  listLinks: vi.fn().mockResolvedValue([]),
  getTopology: vi.fn().mockResolvedValue([]),
}))

import App from '../App'

function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>
  )
}

describe('Toolbar buttons', () => {
  beforeEach(() => mockNavigate.mockClear())

  it('Settings button navigates to /settings', () => {
    renderApp()
    // There are two "Settings" texts possible (toolbar + header Preferences)
    // Settings is the one in toolbar (second occurrence); let's get by title or by getting all
    const settingsBtn = screen.getByRole('button', { name: 'Settings' })
    fireEvent.click(settingsBtn)
    expect(mockNavigate).toHaveBeenCalledWith('/settings')
  })

  it('Add device (+) button navigates to /devices', () => {
    renderApp()
    fireEvent.click(screen.getByTitle('Add device'))
    expect(mockNavigate).toHaveBeenCalledWith('/devices')
  })

  it('Discover button opens DiscoveryWizard overlay', () => {
    renderApp()
    expect(screen.queryByTestId('discovery-wizard')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Discover' }))
    expect(screen.getByTestId('discovery-wizard')).toBeInTheDocument()
  })

  it('DiscoveryWizard close button hides overlay', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Discover' }))
    fireEvent.click(screen.getByText('Close Wizard'))
    expect(screen.queryByTestId('discovery-wizard')).toBeNull()
  })

  // Helper: get the dropdown menu item (not sidebar item) by text
  // Sidebar items have class containing 'select-none'; dropdown items have class 'cursor-default'
  function getDropdownItem(label: string) {
    return screen.getAllByText(label).find(
      (el) => el.className.includes('cursor-default') || el.closest('[class*="cursor-default"]') != null
    )!
  }

  it('Tools dropdown opens on click and shows navigation items', () => {
    renderApp()
    fireEvent.click(screen.getByText('▼ Tools'))
    expect(screen.getByText('Ping…')).toBeInTheDocument()
    expect(screen.getByText('Traceroute…')).toBeInTheDocument()
    // Outages/Services/Logs appear in both sidebar and dropdown — at least 2 of each
    expect(screen.getAllByText('Outages').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Services').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Logs').length).toBeGreaterThanOrEqual(2)
  })

  it('Tools → Outages navigates to /outages', () => {
    renderApp()
    fireEvent.click(screen.getByText('▼ Tools'))
    fireEvent.click(getDropdownItem('Outages'))
    expect(mockNavigate).toHaveBeenCalledWith('/outages')
  })

  it('Tools → Services navigates to /services', () => {
    renderApp()
    fireEvent.click(screen.getByText('▼ Tools'))
    fireEvent.click(getDropdownItem('Services'))
    expect(mockNavigate).toHaveBeenCalledWith('/services')
  })

  it('Tools → Logs navigates to /logs/event', () => {
    renderApp()
    fireEvent.click(screen.getByText('▼ Tools'))
    fireEvent.click(getDropdownItem('Logs'))
    expect(mockNavigate).toHaveBeenCalledWith('/logs/event')
  })

  it('Preferences header button opens real PrefsDialog with tabs', async () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Preferences' }))
    // All major tabs present (these are unique to the dialog, not in sidebar)
    expect(screen.getByText('Misc')).toBeInTheDocument()
    expect(screen.getByText('General')).toBeInTheDocument()
    expect(screen.getByText('SNMP')).toBeInTheDocument()
    expect(screen.getByText('Service Polling')).toBeInTheDocument()
    expect(screen.getByText('Web Access')).toBeInTheDocument()
    expect(screen.getByText('Syslog')).toBeInTheDocument()
    expect(screen.getByText('SMTP')).toBeInTheDocument()
    expect(screen.getByText('RouterOS')).toBeInTheDocument()
    // Has OK/Apply/Cancel buttons
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('Preferences Cancel button closes dialog', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Preferences' }))
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
  })
})

describe('Toolbar topology-specific buttons', () => {
  it('Align buttons shown on root path (topology)', () => {
    renderApp('/')
    expect(screen.getByTitle('Align in rows')).toBeInTheDocument()
    expect(screen.getByTitle('Align in circle')).toBeInTheDocument()
  })

  it('Align buttons shown on /topology path', () => {
    renderApp('/topology')
    expect(screen.getByTitle('Align in rows')).toBeInTheDocument()
    expect(screen.getByTitle('Align in circle')).toBeInTheDocument()
  })

  it('Align buttons NOT shown on /devices path', () => {
    renderApp('/devices')
    expect(screen.queryByTitle('Align in rows')).toBeNull()
    expect(screen.queryByTitle('Align in circle')).toBeNull()
  })

  it('Align buttons NOT shown on /settings path', () => {
    renderApp('/settings')
    expect(screen.queryByTitle('Align in rows')).toBeNull()
    expect(screen.queryByTitle('Align in circle')).toBeNull()
  })
})

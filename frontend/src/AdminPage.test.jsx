import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { AppearanceProvider } from './AppearanceContext'
import AdminPage from './AdminPage'

// The admin tabs each read `isDark` from useAppearance(); a missing call there threw
// "ReferenceError: isDark is not defined" and blanked the whole page, which a build never catches.
const payloads = {
  '/api/admin/options': { pages: [], cores: ['kg'], scope_modes: ['all'], branches: [], supervisors: [] },
  '/api/admin/roles': [],
  '/api/admin/users': [],
  '/api/admin/audit': { count: 1, limit: 50, offset: 0, rows: [
    { id: 1, ts: '2026-11-21T10:00:00', actor: 'admin', action: 'login', target_type: '', target: '',
      detail: { device: 'آیفون' }, ip: '127.0.0.1' },
  ] },
  '/api/admin/sessions': { online: 0, count: 0, rows: [] },
}

beforeEach(() => {
  global.fetch = vi.fn(async (url) => {
    const path = new URL(url, 'http://x').pathname
    return { ok: true, status: 200, json: async () => payloads[path] ?? {} }
  })
})

afterEach(() => vi.restoreAllMocks())

describe('AdminPage tabs render', () => {
  it('renders the users tab (default) without a ReferenceError', async () => {
    render(<AppearanceProvider><AdminPage /></AppearanceProvider>)
    await waitFor(() => expect(screen.getByText('کاربران سامانه')).toBeInTheDocument())
  })

  it('renders the audit tab and shows the device column', async () => {
    render(<AppearanceProvider><AdminPage /></AppearanceProvider>)
    await waitFor(() => expect(screen.getByText('کاربران سامانه')).toBeInTheDocument())
    screen.getByRole('button', { name: /گزارش رویدادها/ }).click()
    await waitFor(() => expect(screen.getByText('گزارش رویدادها (Audit Logs)')).toBeInTheDocument())
    expect(screen.getByText('دستگاه')).toBeInTheDocument()
  })

  it('renders the online users tab', async () => {
    render(<AppearanceProvider><AdminPage /></AppearanceProvider>)
    await waitFor(() => expect(screen.getByText('کاربران سامانه')).toBeInTheDocument())
    screen.getByRole('button', { name: /کاربران آنلاین/ }).click()
    await waitFor(() => expect(screen.getByText('کاربران آنلاین')).toBeInTheDocument())
  })
})

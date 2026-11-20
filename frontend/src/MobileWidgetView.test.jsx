import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { vi, afterEach } from 'vitest'
import MobileWidgetView, { SCRIPTABLE_CODE, widgetQuery, scriptableCode } from './MobileWidgetView'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('widget response states', () => {
  it('passes the same core, month and repeated target filters to the API and installed script', async () => {
    const filters = { branch: 'شعبه تهران', visitor: ['11', '12'] }
    const query = widgetQuery('kg', '140507', filters)
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      schema_version: 2, available: false, reason: 'بدون داده',
    }) })
    vi.stubGlobal('fetch', fetch)
    render(<MobileWidgetView principal={{}} core="kg" month="140507" filters={filters} />)
    await screen.findByText('بدون داده')
    expect(fetch.mock.calls[0][0]).toBe(`/api/mobile/widget-pulse?${query}`)
    expect(new URLSearchParams(query).getAll('visitor')).toEqual(['11', '12'])
    expect(scriptableCode('https://example.test', query)).toContain(`/api/mobile/widget-pulse?${query}`)
  })
  it('renders unavailable data without fabricated scores', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      schema_version: 2, available: false, role_view: 'visitor', reason: 'حساب متصل نیست', freshness: 'unknown',
    }) }))
    render(<MobileWidgetView principal={{}} />)
    expect(await screen.findByText('حساب متصل نیست')).toBeInTheDocument()
    expect(screen.queryByText('گرید عملکرد')).not.toBeInTheDocument()
  })

  it('handles expired sessions without displaying old metrics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    render(<MobileWidgetView principal={{}} />)
    expect(await screen.findByText('نشست پایان یافته؛ دوباره وارد شوید')).toBeInTheDocument()
    expect(screen.queryByText('گرید عملکرد')).not.toBeInTheDocument()
  })

  it('uses no-store and rejects incompatible response versions', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ schema_version: 1 }) })
    vi.stubGlobal('fetch', fetch)
    render(<MobileWidgetView principal={{}} />)
    await waitFor(() => expect(screen.getByText('نسخه پاسخ ویجت پشتیبانی نمی‌شود')).toBeInTheDocument())
    expect(fetch.mock.calls[0][1].cache).toBe('no-store')
  })
})

describe('MobileWidgetView and PWA Integration', () => {
  it('includes ready-to-copy iOS Scriptable script template with correct endpoint', () => {
    // Check that scriptable template contains widget-pulse URL and Iranian localization
    expect(SCRIPTABLE_CODE).toBeDefined()
    expect(SCRIPTABLE_CODE).toContain('/api/mobile/widget-pulse')
    expect(SCRIPTABLE_CODE).toContain('نبض فروش')
    expect(SCRIPTABLE_CODE).toContain('total_score')
    expect(SCRIPTABLE_CODE).toContain('net_rial_vat')
    expect(SCRIPTABLE_CODE).toContain('role_view')
    expect(SCRIPTABLE_CODE).toContain('Keychain')
    expect(SCRIPTABLE_CODE).toContain('Authorization')
    expect(SCRIPTABLE_CODE).not.toContain('copagostar.internal')
  })

  it('validates manifest configuration structure', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const manifestPath = path.resolve('public/manifest.webmanifest')
    expect(fs.existsSync(manifestPath)).toBe(true)

    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    expect(content.name).toContain('نبض فروش')
    expect(content.dir).toBe('rtl')
    expect(content.lang).toBe('fa')
    expect(content.theme_color).toBe('#0071E3')
    expect(content.display).toBe('standalone')
    expect(content.widgets).toBeDefined()
    expect(content.widgets.length).toBeGreaterThan(0)
    expect(content.widgets[0].data).toBe('/api/mobile/widget-pulse')
  })

  it('validates service worker existence and event handling', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const swPath = path.resolve('public/sw.js')
    expect(fs.existsSync(swPath)).toBe(true)

    const swContent = fs.readFileSync(swPath, 'utf-8')
    expect(swContent).toContain('/api/')
    expect(swContent).toContain('widgetclick')
    expect(swContent).toContain('caches.open')
    // Guarantee no console.log
    expect(swContent).not.toContain('console.log')
  })
})

import { SCRIPTABLE_CODE } from './MobileWidgetView'

describe('MobileWidgetView and PWA Integration', () => {
  it('includes ready-to-copy iOS Scriptable script template with correct endpoint', () => {
    // Check that scriptable template contains widget-pulse URL and Iranian localization
    expect(SCRIPTABLE_CODE).toBeDefined()
    expect(SCRIPTABLE_CODE).toContain('/api/mobile/widget-pulse')
    expect(SCRIPTABLE_CODE).toContain('نبض فروش')
    expect(SCRIPTABLE_CODE).toContain('total_score')
    expect(SCRIPTABLE_CODE).toContain('net_rial_vat')
    expect(SCRIPTABLE_CODE).toContain('role_view')
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

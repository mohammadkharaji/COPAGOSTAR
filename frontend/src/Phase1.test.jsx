import { describe, expect, it } from 'bun:test'
import { getActiveModule } from './AmbientCanvas'
import { isItemActive, MODULAR_PILLARS, UTILITY_PILLAR } from './ExecutiveDashboard'

describe('Appearance and Theme Logic', () => {
  it('correctly maps route pages to module types for ambient glow', () => {
    expect(getActiveModule('overview')).toBe('sales')
    expect(getActiveModule('trend')).toBe('sales')
    expect(getActiveModule('target')).toBe('sales')
    expect(getActiveModule('customer')).toBe('sales')
    expect(getActiveModule('club_b2b')).toBe('club_b2b')
    expect(getActiveModule('club_visitor')).toBe('club_visitor')
    expect(getActiveModule('tickets')).toBe('sales')
  })
})

describe('Modular 3-Pillar Architecture', () => {
  it('defines 3 distinct pillars with exact accent colors', () => {
    const salesPillar = MODULAR_PILLARS.find((p) => p.id === 'sales')
    const b2bPillar = MODULAR_PILLARS.find((p) => p.id === 'club_b2b')
    const visitorPillar = MODULAR_PILLARS.find((p) => p.id === 'club_visitor')

    expect(salesPillar).toBeDefined()
    expect(salesPillar.accentColor).toBe('#0071E3')

    expect(b2bPillar).toBeDefined()
    expect(b2bPillar.accentColor).toBe('#D97706')

    expect(visitorPillar).toBeDefined()
    expect(visitorPillar.accentColor).toBe('#059669')
  })

  it('contains all required items in Sales & Analytics pillar', () => {
    const salesPillar = MODULAR_PILLARS.find((p) => p.id === 'sales')
    const allItems = salesPillar.subgroups.flatMap((sg) => sg.items).map((item) => item.id)

    const expected = [
      'overview', 'trend', 'monthly', 'growth', 'target',
      'branch', 'product', 'profile', 'pareto',
      'returns', 'quantity', 'inactive', 'potential',
      'invoice', 'customer',
    ]

    for (const req of expected) {
      expect(allItems).toContain(req)
    }
  })

  it('contains the 3 required sub-items in Customer Club B2B pillar', () => {
    const b2bPillar = MODULAR_PILLARS.find((p) => p.id === 'club_b2b')
    expect(b2bPillar.items).toHaveLength(3)

    const labels = b2bPillar.items.map((i) => i.label)
    expect(labels).toContain('داشبورد باشگاه مشتریان')
    expect(labels).toContain('سطوح وفاداری (برنزی، نقره‌ای، طلایی)')
    expect(labels).toContain('امتیازات و جوایز')
  })

  it('contains the 3 required sub-items in Visitor Club pillar', () => {
    const visitorPillar = MODULAR_PILLARS.find((p) => p.id === 'club_visitor')
    expect(visitorPillar.items).toHaveLength(3)

    const labels = visitorPillar.items.map((i) => i.label)
    expect(labels).toContain('داشبورد ویزیتورها')
    expect(labels).toContain('تحقق تارگت و پورسانت')
    expect(labels).toContain('رتبه‌بندی و چالش‌ها')
  })

  it('contains utility items above footer', () => {
    expect(UTILITY_PILLAR.items).toBeDefined()
    const ids = UTILITY_PILLAR.items.map((i) => i.id)
    expect(ids).toContain('chat')
    expect(ids).toContain('tickets')
    expect(ids).toContain('admin')
  })

  it('correctly determines active items with args for Customer Club and Visitor Club', () => {
    // Customer Club
    const b2bDashboard = { id: 'club_b2b', arg: 'dashboard' }
    const b2bTiers = { id: 'club_b2b', arg: 'tiers' }
    const b2bPoints = { id: 'club_b2b', arg: 'points' }

    expect(isItemActive(b2bDashboard, 'club_b2b', '')).toBe(true)
    expect(isItemActive(b2bDashboard, 'club_b2b', 'dashboard')).toBe(true)
    expect(isItemActive(b2bTiers, 'club_b2b', 'tiers')).toBe(true)
    expect(isItemActive(b2bTiers, 'club_b2b', 'dashboard')).toBe(false)
    expect(isItemActive(b2bPoints, 'club_b2b', 'points')).toBe(true)

    // Visitor Club
    const visDashboard = { id: 'club_visitor', arg: 'dashboard' }
    const visTargets = { id: 'club_visitor', arg: 'targets' }
    const visRankings = { id: 'club_visitor', arg: 'rankings' }

    expect(isItemActive(visDashboard, 'club_visitor', '')).toBe(true)
    expect(isItemActive(visTargets, 'club_visitor', 'targets')).toBe(true)
    expect(isItemActive(visRankings, 'club_visitor', 'rankings')).toBe(true)
    expect(isItemActive(visTargets, 'club_visitor', 'rankings')).toBe(false)

    // Sales item
    const overviewItem = { id: 'overview' }
    expect(isItemActive(overviewItem, 'overview')).toBe(true)
    expect(isItemActive(overviewItem, 'trend')).toBe(false)
  })
})

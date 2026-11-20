import { ringsFromScorecard, linearRings } from './ReportCard'

const sc = {
  kpis: [
    { key: 'rial', label: 'ریالی کل', metric: 'rial', target: 1200, actual: 1000, ratio: 0.8333, score: 14.79, weight: 0.6, weighted: 8.874 },
    { key: 'cov', label: 'پوشش', metric: 'coverage', target: 3, actual: 2, ratio: 0.6667, score: 8.75, weight: 0.4, weighted: 3.5 },
  ],
}

describe('report card rings', () => {
  it('normalizes basket groups against the final ladder step', () => {
    const rings = ringsFromScorecard({ kpis: [{ metric: 'basket', ratio: 4, actual: 0, ladder: [[2, 8], [6, 25]] }] })
    expect(rings[2].progress).toBeCloseTo(4 / 6)
    expect(rings[2].value).toContain('۴')
    expect(rings[2].target).toContain('۶')
  })

  it('keeps the real percentage above 100 while capping the ring', () => {
    const ring = ringsFromScorecard({ kpis: [{ metric: 'rial', ratio: 1.2, actual: 120, target: 100 }] })[0]
    expect(ring.progress).toBe(1)
    expect(ring.percentage).toBe(120)
  })
  it('maps kpis to three rings and marks a missing metric', () => {
    const rings = ringsFromScorecard(sc)
    expect(rings.length).toBe(3)
    expect(rings[0].progress).toBeCloseTo(0.8333, 3)
    expect(rings[2].label).toBe('تعریف نشده')
    expect(rings[2].progress).toBe(0)
  })

  it('linear rings use the target page achievement and never a fixed collection rate', () => {
    const rings = linearRings({ customers_count: 20, prev_customers_count: 25 }, { achieved_pct: 0.9 })
    expect(rings.length).toBe(2)
    expect(rings[0].progress).toBeCloseTo(0.9)
    expect(rings[1].progress).toBeCloseTo(0.8)
  })
})

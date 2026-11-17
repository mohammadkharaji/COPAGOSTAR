import { describe, expect, it } from 'bun:test'
import { DEFAULT_KPIS, validateConfig, weightSum, parseLadder, formatLadder } from './ladder'

describe('ladder config helpers', () => {
  it('default kpis sum to one and validate', () => {
    expect(weightSum(DEFAULT_KPIS)).toBeCloseTo(1, 3)
    expect(validateConfig({ kpis: DEFAULT_KPIS, grade_bands: [], prize_table: [] })).toEqual([])
  })

  it('rejects weights that do not sum to one', () => {
    const kpis = [{ ...DEFAULT_KPIS[0], weight: 0.5 }]
    expect(validateConfig({ kpis, grade_bands: [], prize_table: [] })[0]).toContain('ضرایب')
  })

  it('rejects overlapping prize ranges and non-increasing ladders', () => {
    const errs = validateConfig({
      kpis: [{ ...DEFAULT_KPIS[0], ladder: [[0.9, 25], [0.6, 8]] }],
      grade_bands: [],
      prize_table: [{ rank_from: 1, rank_to: 3, amount: 1 }, { rank_from: 3, rank_to: 5, amount: 1 }],
    })
    expect(errs.length).toBe(2)
  })

  it('parses and formats ladder text', () => {
    expect(parseLadder('0.6:8.75, 0.7:11.38')).toEqual([[0.6, 8.75], [0.7, 11.38]])
    expect(formatLadder([[0.6, 8.75]])).toBe('0.6:8.75')
  })
})

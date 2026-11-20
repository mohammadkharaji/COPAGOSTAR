export const DEFAULT_LADDER = [[0.6, 8.75], [0.7, 11.38], [0.8, 14.79], [0.9, 19.23], [1.05, 25]]
export const DEFAULT_BASKET_LADDER = [[2, 8.75], [3, 11.38], [4, 14.79], [5, 19.23], [6, 25]]

export const DEFAULT_KPIS = [
  { key: 'rial', label: 'ریالی کل', metric: 'rial', weight: 0.7, ladder: DEFAULT_LADDER, product_groups: null },
  { key: 'basket', label: 'سبد فروشی', metric: 'basket', weight: 0.3, ladder: DEFAULT_BASKET_LADDER, threshold: 0.7 },
]

export const weightSum = (kpis = []) => kpis.reduce((total, kpi) => total + (Number(kpi.weight) || 0), 0)

export function parseLadder(text) {
  if (!text.trim()) return []
  return text.split(',').map((entry) => entry.trim().split(':').map(Number))
}

export const formatLadder = (pairs = []) => pairs.map(([threshold, score]) => `${threshold}:${score}`).join(', ')

export function validateConfig(config = {}) {
  const errors = []
  const kpis = config.kpis ?? []
  if (!kpis.length) errors.push('حداقل یک شاخص لازم است.')
  if (Math.abs(weightSum(kpis) - 1) > 0.001) errors.push('مجموع ضرایب شاخص‌ها باید برابر ۱ باشد.')
  for (const kpi of kpis) {
    const ladder = kpi.ladder ?? []
    if (!ladder.length || ladder.some((pair) => pair.length !== 2 || pair.some((n) => !Number.isFinite(n) || n < 0))) {
      errors.push(`نردبان «${kpi.label}» معتبر نیست.`)
      continue
    }
    if (kpi.metric === 'basket' && (!(kpi.threshold > 0) || kpi.threshold > 1)) errors.push('آستانه سبد باید بزرگ‌تر از صفر و حداکثر یک باشد.')
    if (ladder.slice(1).some(([threshold], i) => threshold <= ladder[i][0])) {
      errors.push(`آستانه‌های نردبان «${kpi.label}» باید صعودی باشند.`)
    }
    if (ladder.slice(1).some(([, score], i) => score < ladder[i][1])) {
      errors.push(`امتیاز نردبان «${kpi.label}» نباید کاهش یابد.`)
    }
    if (kpi.metric === 'rial' && kpi.product_groups?.some((group) => !group.trim())) {
      errors.push('گروه‌های محصول شاخص ریالی معتبر نیستند.')
    }
  }
  const prizes = [...(config.prize_table ?? [])].sort((a, b) => a.rank_from - b.rank_from)
  if (prizes.some((row) => row.rank_from > row.rank_to || row.rank_from < 1)) errors.push('بازه رتبه جایزه نامعتبر است.')
  if (prizes.slice(1).some((row, i) => row.rank_from <= prizes[i].rank_to)) errors.push('بازه‌های رتبه جوایز نباید هم‌پوشانی داشته باشند.')
  return errors
}

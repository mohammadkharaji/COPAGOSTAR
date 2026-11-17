import { Plus, Trash2 } from 'lucide-react'
import { faDigits } from '../format'
import { formatLadder, parseLadder, validateConfig, weightSum } from './ladder'

const INPUT = 'bg-white border border-black/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-[#1D1D1F]'
const METRICS = [['rial', 'ریالی'], ['coverage', 'پوشش'], ['basket', 'سبد فروشی']]

// Controlled editor for {kpis, grade_bands, prize_table}; every change returns a new object.
export default function LadderPlanForm({ value, onChange }) {
  const { kpis, grade_bands: bands, prize_table: prizes } = value
  const errors = validateConfig(value)
  const set = (patch) => onChange({ ...value, ...patch })
  const setKpi = (i, patch) => set({ kpis: kpis.map((k, n) => (n === i ? { ...k, ...patch } : k)) })
  const setPrize = (i, key, v) => set({ prize_table: prizes.map((p, n) => (n === i ? { ...p, [key]: Number(v) || 0 } : p)) })
  // three bands: C at 0, then B and A thresholds
  const bandMin = (grade) => bands.find((b) => b.grade === grade)?.min_rial ?? ''
  const setBands = (b, a) => set({ grade_bands: [{ grade: 'C', min_rial: 0 }, { grade: 'B', min_rial: Number(b) || 0 }, { grade: 'A', min_rial: Number(a) || 0 }] })

  return (
    <div className="p-4 rounded-2xl bg-white border border-black/[0.05] space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#1D1D1F]">شاخص‌ها و نردبان تحقق</span>
        <span className={`text-xs font-semibold tabular-nums ${errors.length ? 'text-rose-600' : 'text-emerald-700'}`}>
          جمع ضرایب: {faDigits(weightSum(kpis).toFixed(2))}
        </span>
      </div>
      {kpis.map((k, i) => (
        <div className="flex items-center gap-2 flex-wrap bg-[#F5F5F7] p-2.5 rounded-xl" key={k.key}>
          <input className={INPUT} placeholder="عنوان" value={k.label} onChange={(e) => setKpi(i, { label: e.target.value })} />
          <select className={INPUT} value={k.metric} onChange={(e) => setKpi(i, { metric: e.target.value })}>
            {METRICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {k.metric === 'rial' && (
            <input className={`${INPUT} w-40`} placeholder="گروه‌های محصول (با ویرگول)" defaultValue={(k.product_groups ?? []).join(',')}
              onBlur={(e) => setKpi(i, { product_groups: e.target.value.trim() ? e.target.value.split(',').map((g) => g.trim()).filter(Boolean) : null })} />
          )}
          <input className={`${INPUT} w-20`} placeholder="ضریب" inputMode="decimal" value={k.weight}
            onChange={(e) => setKpi(i, { weight: e.target.value === '' ? 0 : Number(e.target.value) || 0 })} />
          <input className={`${INPUT} flex-1 min-w-[220px]`} dir="ltr" defaultValue={formatLadder(k.ladder)}
            onBlur={(e) => setKpi(i, { ladder: parseLadder(e.target.value) })} aria-label="نردبان آستانه:امتیاز" />
          <button type="button" className="text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 mr-auto" onClick={() => set({ kpis: kpis.filter((_, n) => n !== i) })}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button type="button" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0071E3]/10 text-[#0071E3]"
        onClick={() => set({ kpis: [...kpis, { key: `kpi${Date.now()}`, label: '', metric: 'rial', weight: 0, ladder: [[0.6, 8.75]], product_groups: null }] })}>
        <Plus size={13} /><span>افزودن شاخص</span>
      </button>

      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="font-bold text-[#1D1D1F]">درجه‌بندی (میانگین ماهانه فروش سه ماه قبل):</span>
        <label>B از <input className={`${INPUT} w-32`} inputMode="numeric" value={bandMin('B')} onChange={(e) => setBands(e.target.value, bandMin('A'))} /></label>
        <label>A از <input className={`${INPUT} w-32`} inputMode="numeric" value={bandMin('A')} onChange={(e) => setBands(bandMin('B'), e.target.value)} /></label>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-bold text-[#1D1D1F]">جدول جوایز (بر اساس رتبه کشوری)</span>
        {prizes.map((p, i) => (
          <div className="flex items-center gap-2" key={i}>
            <input className={`${INPUT} w-20`} placeholder="از رتبه" inputMode="numeric" value={p.rank_from} onChange={(e) => setPrize(i, 'rank_from', e.target.value)} />
            <input className={`${INPUT} w-20`} placeholder="تا رتبه" inputMode="numeric" value={p.rank_to} onChange={(e) => setPrize(i, 'rank_to', e.target.value)} />
            <input className={`${INPUT} w-36`} placeholder="مبلغ" inputMode="numeric" value={p.amount} onChange={(e) => setPrize(i, 'amount', e.target.value)} />
            <button type="button" className="text-rose-600 p-1.5 rounded-lg hover:bg-rose-50" onClick={() => set({ prize_table: prizes.filter((_, n) => n !== i) })}><Trash2 size={15} /></button>
          </div>
        ))}
        <button type="button" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0071E3]/10 text-[#0071E3]"
          onClick={() => set({ prize_table: [...prizes, { rank_from: prizes.length + 1, rank_to: prizes.length + 1, amount: 0 }] })}>
          <Plus size={13} /><span>افزودن جایزه</span>
        </button>
      </div>

      {errors.length > 0 && (
        <ul className="text-[11px] font-semibold text-rose-600 list-disc pr-4" role="alert">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
    </div>
  )
}

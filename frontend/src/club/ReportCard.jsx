import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Sparkles, Target, Users } from 'lucide-react'
import { useAppearance } from '../AppearanceContext'
import { fa, faDigits, monthLabel } from '../format'
import { Table } from '../ui'

const RING = {
  rial: { color: '#10B981', colorEnd: '#34D399', icon: Target, label: 'ریالی کل' },
  coverage: { color: '#8B5CF6', colorEnd: '#A78BFA', icon: Users, label: 'پوشش' },
  basket: { color: '#0071E3', colorEnd: '#42A1EC', icon: Sparkles, label: 'سبد فروشی' },
}

// One ring per KPI metric; a metric the plan does not score still gets a ring, marked as undefined.
export function ringsFromScorecard(scorecard) {
  const kpis = scorecard?.kpis ?? []
  return ['rial', 'coverage', 'basket'].map((metric) => {
    const kpi = kpis.find((k) => k.metric === metric)
    const style = RING[metric]
    if (!kpi) {
      return { id: metric, ...style, label: 'تعریف نشده', value: '—', target: '—', progress: 0, percentage: 0 }
    }
    const basketTarget = metric === 'basket' ? Math.max(...(kpi.ladder ?? []).map(([t]) => t), 0) : null
    const ratio = metric === 'basket' ? (basketTarget > 0 ? kpi.ratio / basketTarget : 0) : (kpi.ratio ?? 0)
    const progress = Math.min(Math.max(ratio, 0), 1)
    return {
      id: metric, label: kpi.label || style.label,
      value: metric === 'basket' ? `${fa(kpi.ratio)} گروه` : fa(Math.round(kpi.actual)),
      target: metric === 'basket' ? `${fa(basketTarget)} گروه` : kpi.target == null ? '—' : fa(Math.round(kpi.target)),
      progress, percentage: Math.round(Math.max(ratio, 0) * 100),
      color: style.color, colorEnd: style.colorEnd, icon: style.icon,
    }
  })
}

// Linear plans: the rial ring is the Target page's own achievement; the coverage ring compares this
// month's buyers with the previous month's. There is no third ring because nothing measures it.
export function linearRings(summary, target) {
  const achieved = Math.min(Math.max(target?.achieved_pct ?? 0, 0), 1)
  const now = summary?.customers_count ?? 0
  const before = summary?.prev_customers_count ?? 0
  const coverage = before > 0 ? Math.min(now / before, 1) : 0
  return [
    { id: 'rial', label: 'تحقق تارگت ریالی', value: `${faDigits(Math.round(achieved * 100))}٪`, target: '۱۰۰٪',
      progress: achieved, percentage: Math.round(achieved * 100), ...RING.rial },
    { id: 'coverage', label: 'مشتریان نسبت به ماه قبل', value: fa(now), target: fa(before),
      progress: coverage, percentage: Math.round(coverage * 100), ...RING.coverage },
  ]
}

const ladderRule = (ladder = [], metric) =>
  ladder.map(([t, s]) => `از ${metric === 'basket' ? `${fa(t)} گروه` : `${faDigits(Math.round(t * 100))}٪ تحقق`} ${fa(s)} امتیاز`).join(' · ')

export default function ReportCard({ scorecard, months = [], month, onMonth }) {
  const { isDark } = useAppearance()
  if (!scorecard) return null
  const rows = scorecard.kpis ?? []
  const history = (scorecard.history ?? []).map((h) => ({ ...h, label: monthLabel(h.month) }))
  const tone = isDark ? 'text-slate-400' : 'text-[#86868B]'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <div className="text-sm font-bold text-[#1D1D1F]">{scorecard.name || scorecard.code}</div>
          <div className={`text-[11px] mt-0.5 ${tone}`}>
            درجه {scorecard.grade ?? '—'} · {fa(scorecard.tenure ?? 0)} ماه · رتبه کشوری {fa(scorecard.rank_national ?? '—')}
            {' · '}رتبه شعبه و درجه {fa(scorecard.rank_branch ?? '—')}
            {scorecard.prize ? ` · جایزه برآوردی ${fa(scorecard.prize)} ریال` : ''}
          </div>
        </div>
        <div className="mr-auto flex items-center gap-2">
          <span className={`text-xs ${tone}`}>ماه:</span>
          <select value={month ?? scorecard.month ?? ''} onChange={(e) => onMonth?.(e.target.value)}
            className="bg-white border border-black/[0.08] rounded-xl px-3 py-1.5 text-xs text-[#1D1D1F]">
            {months.map((m) => <option key={m.month} value={m.month}>{monthLabel(m.month)}</option>)}
          </select>
        </div>
      </div>

      <div className={`text-xs leading-relaxed ${tone}`}>
        <p>{scorecard.ranking_note}</p>
        {scorecard.data_cutoff && <p>آخرین تاریخ فروش در داده: {faDigits(scorecard.data_cutoff)}</p>}
        <p>امتیاز این ماه: {scorecard.month_provisional ? 'موقت' : 'ماه پایان‌یافته'}؛ جمع ماه‌های پایان‌یافته: {fa(Number((scorecard.total ?? 0).toFixed(2)))}</p>
      </div>

      {history.length > 0 && (
        <div className="h-56 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={history} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#E5E5EA" strokeDasharray="3 3" />
              <XAxis dataKey="label" reversed tickLine={false} axisLine={false} tick={{ fill: '#86868B', fontSize: 11 }} />
              <YAxis orientation="right" tickFormatter={fa} tickLine={false} axisLine={false} width={44} tick={{ fill: '#86868B', fontSize: 11 }} />
              <Tooltip formatter={(v) => [fa(v), 'امتیاز']} />
              {scorecard.ladder_max ? <ReferenceLine y={scorecard.ladder_max} stroke="#e4a53a" strokeDasharray="4 4" /> : null}
              <Bar dataKey="points" name="امتیاز" fill="#0071E3" radius={[8, 8, 0, 0]} maxBarSize={34} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3" role="status">
          {scorecard.note || 'برای این ماه کارنامه‌ای ثبت نشده است.'}
        </p>
      ) : (
        <Table name="شاخص‌های کارنامه" rows={rows.map((k) => ({ ...k, _key: k.key }))} columns={[
          { label: 'شاخص', render: (r) => <b className="font-bold text-[#1D1D1F]">{r.label}</b>, value: (r) => r.label },
          { label: 'هدف', render: (r) => r.metric === 'basket' ? `${fa(Math.max(...r.ladder.map(([t]) => t)))} گروه` : (r.target == null ? '—' : <span className="tabular-nums">{fa(Math.round(r.target))}</span>), value: (r) => r.target ?? 0 },
          { label: 'واقعی', render: (r) => <span className="tabular-nums">{r.metric === 'basket' ? `${fa(r.ratio)} گروه` : fa(Math.round(r.actual))}</span>, value: (r) => r.metric === 'basket' ? r.ratio : r.actual },
          { label: 'تحقق', render: (r) => <span className="tabular-nums">{r.metric === 'basket' ? `${fa(r.ratio)} گروه` : `${faDigits(Math.round((r.ratio ?? 0) * 100))}٪`}</span>, value: (r) => r.ratio },
          { label: 'امتیاز', render: (r) => <span className="tabular-nums font-bold text-[#1D1D1F]">{fa(r.score)}</span>, value: (r) => r.score },
          { label: 'ضریب', render: (r) => <span className="tabular-nums">{fa(r.weight)}</span>, value: (r) => r.weight },
          { label: 'امتیاز وزنی', render: (r) => <span className="tabular-nums font-extrabold text-[#0071E3]">{fa(Number((r.weighted ?? 0).toFixed(2)))}</span>, value: (r) => r.weighted },
        ]} />
      )}

      {rows.filter((k) => k.ladder?.length).map((k) => (
        <p key={k.key} className={`text-[11px] leading-relaxed ${tone}`}>قاعده نردبان {k.label}: {ladderRule(k.ladder, k.metric)}</p>
      ))}
      {rows.length > 0 && <section aria-label="قدم بعدی" className="space-y-2 border rounded-xl p-3">
        <h3 className="text-sm font-bold">قدم بعدی برای ارتقای امتیاز</h3>
        {rows.map((k) => <p key={k.key} className="text-xs leading-relaxed">
          {k.label}: {k.target_missing ? 'هدف ثبت نشده؛ ابتدا هدف این شاخص باید تکمیل شود.'
            : k.next_step ? `${fa(Math.ceil(k.next_step.additional))} ${k.metric === 'basket' ? 'گروه' : k.metric === 'coverage' ? 'مشتری' : 'ریال'} تا پله بعد؛ ${fa(Number(k.next_step.weighted_gain.toFixed(2)))} امتیاز وزنی بیشتر`
            : 'بالاترین پلهٔ امتیازی این شاخص محقق شده است.'}
        </p>)}
        <p className={`text-xs ${tone}`}>این فاصله با ثابت ماندن هدف و سایر داده‌ها محاسبه می‌شود؛ مرجوعی یا اصلاح هدف می‌تواند نتیجه را تغییر دهد.</p>
      </section>}
    </div>
  )
}

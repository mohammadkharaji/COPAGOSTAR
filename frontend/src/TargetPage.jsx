import { useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { motion } from 'motion/react'
import { Target, TrendingUp, Calendar, CheckCircle2, Award, CircleDollarSign, Filter, Layers, Clock, AlertTriangle } from 'lucide-react'
import { useApi } from './api'
import { billions, billions1, dayLabel, fa, monthLabel } from './format'
import { ChartTip, Table, pct } from './ui'

const BY = [['branch', 'شعبه'], ['manager', 'مدیر'], ['supervisor', 'سرپرست'], ['visitor', 'ویزیتور'], ['line', 'لاین'], ['group', 'گروه کالا'], ['category', 'دسته کالا']]
const FILTERS = [['branch', 'شعبه'], ['line', 'لاین'], ['manager', 'مدیر'], ['supervisor', 'سرپرست'], ['group', 'گروه کالا'], ['category', 'دسته کالا'], ['visitor', 'ویزیتور']]
const STATUS = { ahead: ['در مسیر یا جلوتر', 'good'], near: ['کمی عقب‌تر', 'warn'], behind: ['عقب‌تر از مسیر', 'bad'] }
const bn = (v) => (v == null ? '—' : billions1(v))
const optLabel = (o) => (typeof o === 'string' ? o : o.label)
const optValue = (o) => (typeof o === 'string' ? o : o.value)

/* ---------- Apple Bento Components ---------- */
function AppleCard({ title, subtitle, badge, action, children, className = '' }) {
  return (
    <div className={`rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 ${className}`}>
      {(title || subtitle || badge || action) && (
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            {title && <h2 className="text-base font-bold text-[#1D1D1F]">{title}</h2>}
            {subtitle && <p className="text-xs text-[#86868B] mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {badge && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#0071E3]/10 text-[#0071E3]">
                {badge}
              </span>
            )}
            {action}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

function AppleKpiCard({ label, value, unit, icon: Icon, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-500/10 text-blue-600',
    teal: 'bg-teal-500/10 text-teal-600',
    amber: 'bg-amber-500/10 text-amber-600',
    violet: 'bg-violet-500/10 text-violet-600',
    pink: 'bg-pink-500/10 text-pink-600',
    green: 'bg-emerald-500/10 text-emerald-600',
    red: 'bg-rose-500/10 text-rose-600',
  }
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="rounded-3xl bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-5 flex flex-col justify-between hover:shadow-[0_12px_30px_rgb(0,0,0,0.07)] transition-shadow text-right"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[#86868B]">{label}</span>
        <div className={`w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 ${tones[tone] || tones.blue}`}>
          {Icon ? <Icon size={16} /> : null}
        </div>
      </div>
      <div>
        <div className="text-xl font-extrabold text-[#1D1D1F] tracking-tight tabular-nums truncate">{value}</div>
        <div className="text-[11px] text-[#86868B] mt-1 truncate">{unit}</div>
      </div>
    </motion.div>
  )
}

function StatusBadge({ status }) {
  if (!status) return <span className="text-xs text-[#86868B]">—</span>
  const styles = {
    ahead: 'bg-emerald-500/15 text-emerald-700',
    near: 'bg-amber-500/15 text-amber-700',
    behind: 'bg-rose-500/15 text-rose-700',
  }
  const [text] = STATUS[status] ?? ['—', '']
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status] ?? 'bg-black/[0.06] text-[#86868B]'}`}>
      {text}
    </span>
  )
}

function Bar({ value, expected }) {
  const w = Math.min((value ?? 0) / 1.2, 1) * 100
  const expW = Math.min((expected ?? 0) / 1.2, 1) * 100
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-[#1D1D1F] tabular-nums min-w-[38px]">{pct(value)}</span>
      <div className="relative w-20 h-2 bg-black/[0.06] rounded-full overflow-hidden shrink-0" title={`تحقق ${pct(value)}، انتظار ${pct(expected)}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            (value ?? 0) >= (expected ?? 0)
              ? 'bg-emerald-500'
              : (value ?? 0) >= (expected ?? 0) * 0.9
              ? 'bg-amber-500'
              : 'bg-rose-500'
          }`}
          style={{ width: `${w}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-[#1D1D1F] z-10"
          style={{ right: `${expW}%` }}
        />
      </div>
    </div>
  )
}

export default function TargetPage({ core, onUnavailable }) {
  const [month, setMonth] = useState('')
  const [by, setBy] = useState('branch')
  const [sel, setSel] = useState({})
  const params = { core, by, ...(month && { month }), ...sel }
  const r = useApi('/target', params)
  const setFilter = (k, v) => setSel((s) => { const n = { ...s }; if (v) n[k] = v; else delete n[k]; return n })

  if (r.error) return <div className="banner err" role="alert">دریافت داده ناموفق بود.</div>
  if (r.loading && !r.data) return <div className="banner">در حال بارگذاری…</div>
  if (!r.data) return null

  const d = r.data
  if (!d.available) {
    return (
      <div className="w-full max-w-[1600px] mx-auto p-6">
        <div className="rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] p-8 text-center text-[#86868B] space-y-2">
          <AlertTriangle className="mx-auto text-amber-500" size={32} />
          <h3 className="text-base font-bold text-[#1D1D1F]">داده تارگت در دسترس نیست</h3>
          <p className="text-sm">{d.reason}</p>
        </div>
      </div>
    )
  }

  const s = d.summary
  const exp = d.expected_pct
  const columns = [
    { label: BY.find(([k]) => k === by)[1], render: (x) => <b className="text-[#1D1D1F] font-bold">{x.label}</b>, value: (x) => x.label },
    { label: 'هدف', unit: 'میلیارد ریال', render: (x) => <span className="tabular-nums font-medium">{bn(x.target_rial)}</span>, value: (x) => x.target_rial },
    { label: 'تحقق', unit: 'میلیارد ریال', render: (x) => <span className="tabular-nums font-bold text-[#1D1D1F]">{bn(x.actual_rial)}</span>, value: (x) => x.actual_rial },
    { label: 'درصد تحقق', render: (x) => <Bar value={x.achieved_pct} expected={exp} />, value: (x) => x.achieved_pct ?? -1 },
    { label: 'اختلاف تا امروز', unit: 'میلیارد ریال', render: (x) => (x.synthetic && !x.target_rial ? '—' : <span className={`tabular-nums font-bold px-2 py-0.5 rounded-full text-xs ${x.gap_rial < 0 ? 'bg-rose-500/10 text-rose-700' : 'bg-emerald-500/10 text-emerald-700'}`} dir="ltr">{bn(x.gap_rial)}</span>), value: (x) => x.gap_rial },
    { label: 'لازم در هر روز کاری', unit: 'میلیارد ریال', render: (x) => <span className="tabular-nums text-[#86868B]">{bn(x.needed_per_day_rial)}</span>, value: (x) => x.needed_per_day_rial ?? -1 },
    { label: 'پیش‌بینی پایان ماه', render: (x) => <span className="tabular-nums font-semibold text-[#1D1D1F]">{pct(x.projected_pct)}</span>, value: (x) => x.projected_pct ?? -1 },
    { label: 'وضعیت', render: (x) => <StatusBadge status={x.status} />, value: (x) => x.status ?? '' },
  ]
  const counts = d.status_counts
  const q = d.quality

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6">
      {/* Apple Floating Glass Filter & Control Bar */}
      <div className="rounded-[24px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#86868B]">ماه تارگت:</span>
            <select
              value={d.month}
              onChange={(e) => { setMonth(e.target.value); setSel({}) }}
              className="bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3 py-1.5 text-xs font-bold text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/25 focus:border-[#0071E3]"
            >
              {d.months.map((m) => <option key={m.month} value={m.month}>{monthLabel(m.month)}</option>)}
            </select>
          </div>

          {/* By Dimension Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-[#E8E8ED]/80 rounded-2xl flex-wrap">
            {BY.map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setBy(k)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  by === k ? 'bg-[#0071E3] text-white shadow-sm' : 'text-[#1D1D1F] hover:bg-black/[0.05]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Analytical Dimension Filters */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-black/[0.04]">
          <span className="text-xs font-medium text-[#86868B] flex items-center gap-1"><Filter size={13} />فیلترها:</span>
          {FILTERS.map(([k, label]) => (
            <select
              key={k}
              value={d.filters[k]?.[0] ?? ''}
              onChange={(e) => setFilter(k, e.target.value)}
              className="bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-2.5 py-1 text-xs text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/25"
            >
              <option value="">همه {label}‌ها</option>
              {d.options[k].map((o) => <option key={optValue(o)} value={optValue(o)}>{optLabel(o)}</option>)}
            </select>
          ))}
          {Object.keys(sel).length > 0 && (
            <button
              type="button"
              onClick={() => setSel({})}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-3 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 transition-colors"
            >
              پاک کردن فیلترها
            </button>
          )}
        </div>
      </div>

      {/* 5 Apple Bento KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 w-full">
        <AppleKpiCard label="هدف ماه" value={bn(s.target_rial)} unit="میلیارد ریال" icon={Target} tone="blue" />
        <AppleKpiCard label="تحقق تا امروز" value={bn(s.actual_rial)} unit={d.as_of ? `تا ${dayLabel(d.as_of)}` : 'میلیارد ریال'} icon={CheckCircle2} tone="teal" />
        <AppleKpiCard
          label="درصد تحقق"
          value={pct(s.achieved_pct)}
          unit={`انتظار: ${pct(exp)} (${fa(d.elapsed_working_days)} از ${fa(d.working_days)} روز)`}
          icon={TrendingUp}
          tone={s.status === 'behind' ? 'red' : s.status === 'ahead' ? 'green' : 'amber'}
        />
        <AppleKpiCard label="لازم در هر روز کاری" value={bn(s.needed_per_day_rial)} unit={`${fa(d.remaining_working_days)} روز کاری باقی‌مانده`} icon={Calendar} tone="amber" />
        <AppleKpiCard label="پیش‌بینی پایان ماه" value={pct(s.projected_pct)} unit={`≈ ${bn(s.projected_rial)} میلیارد`} icon={Award} tone="violet" />
      </div>

      {/* Hero Line Chart & Today Status Widgets Bento */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch w-full">
        <div className="lg:col-span-8">
          <AppleCard
            title="تحقق تجمعی در برابر مسیر مورد انتظار"
            subtitle="فروش تجمعی (خط آبی) در برابر مسیر مورد انتظار روزهای کاری (خط خاکستری) · میلیارد ریال"
            badge="مسیر تارگت"
          >
            <div className="h-72 w-full mt-2" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={d.daily.map((x) => ({ ...x, actual: x.actual_cum_rial == null ? null : x.actual_cum_rial / 1e9, expected: x.expected_cum_rial / 1e9 }))} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5EA" />
                  <XAxis dataKey="date" reversed tickFormatter={dayLabel} tickLine={false} axisLine={false} minTickGap={24} tick={{ fill: '#86868B', fontSize: 12 }} />
                  <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={55} tick={{ fill: '#86868B', fontSize: 12 }} />
                  <Tooltip content={<ChartTip labelFn={dayLabel} unit="میلیارد ریال" />} />
                  <Legend />
                  <Line type="monotone" dataKey="expected" name="مسیر مورد انتظار" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                  <Line type="monotone" dataKey="actual" name="تحقق تجمعی" stroke="#0071E3" strokeWidth={2.5} dot={false} connectNulls={false} activeDot={{ r: 5, fill: '#0071E3', stroke: '#FFFFFF', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </AppleCard>
        </div>

        <div className="lg:col-span-4 flex flex-col justify-between">
          <AppleCard
            title="وضعیت امروز"
            subtitle="مقایسه تحقق و سهم مورد انتظار تا امروز"
            className="h-full flex flex-col justify-between"
          >
            <div className="space-y-3 my-auto">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-emerald-800 block">در مسیر یا جلوتر</span>
                  <span className="text-[11px] text-emerald-600">تحقق بیش از ۱۰۰٪ انتظار</span>
                </div>
                <b className="text-2xl font-black text-emerald-700 tabular-nums">{fa(counts.ahead ?? 0)}</b>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-amber-800 block">کمی عقب‌تر</span>
                  <span className="text-[11px] text-amber-600">تحقق بین ۹۰ تا ۱۰۰٪</span>
                </div>
                <b className="text-2xl font-black text-amber-700 tabular-nums">{fa(counts.near ?? 0)}</b>
              </div>

              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-rose-800 block">عقب‌تر از مسیر</span>
                  <span className="text-[11px] text-rose-600">تحقق کمتر از ۹۰٪</span>
                </div>
                <b className="text-2xl font-black text-rose-700 tabular-nums">{fa(counts.behind ?? 0)}</b>
              </div>
            </div>
          </AppleCard>
        </div>
      </div>

      {/* Main Breakdown Table Bento */}
      <AppleCard
        title={`جدول به تفکیک ${BY.find(([k]) => k === by)[1]}`}
        subtitle="روی عنوان ستون برای مرتب‌سازی کلیک کنید · درصد انتظار روزانه بر پایه روزهای کاری است"
        badge={by}
      >
        <Table name={`target-${d.month}-${by}`} columns={columns} rows={d.rows} />
      </AppleCard>

      {/* Data Quality Control Bento */}
      <AppleCard
        title="کنترل کیفیت داده تارگت"
        subtitle={d.method}
        badge="کیفیت داده"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-[#F5F5F7] p-4 rounded-2xl border border-black/[0.03]">
            <span className="text-xs text-[#86868B] block mb-1">ویزیتورهای فایل تارگت</span>
            <b className="text-base font-bold text-[#1D1D1F] block">{fa(q.visitors_in_target)} نفر</b>
            <span className="text-[11px] text-[#86868B] mt-1 block">بدون کد: {fa(q.visitors_without_code)} نفر ({billions(q.target_rial_without_code)} م ریال)</span>
          </div>

          <div className="bg-[#F5F5F7] p-4 rounded-2xl border border-black/[0.03]">
            <span className="text-xs text-[#86868B] block mb-1">فروش کالاهای بدون دسته تارگتی</span>
            <b className="text-base font-bold text-[#1D1D1F] block">{billions(q.sales_outside_target_categories_rial)} میلیارد ریال</b>
            <span className="text-[11px] text-[#86868B] mt-1 block">در ردیف «سایر» جدا نمایش داده می‌شود</span>
          </div>

          <div className="bg-[#F5F5F7] p-4 rounded-2xl border border-black/[0.03]">
            <span className="text-xs text-[#86868B] block mb-1">دسته‌های کالای تارگتی</span>
            <b className="text-base font-bold text-[#1D1D1F] block">{fa(q.target_categories)} دسته</b>
            <span className="text-[11px] text-[#86868B] mt-1 block">طبق تفکیک فایل تارگت</span>
          </div>
        </div>
      </AppleCard>
    </div>
  )
}

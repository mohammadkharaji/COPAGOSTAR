import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CircleDollarSign,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Calendar,
  FileText,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  Percent,
} from 'lucide-react'
import { useApi } from '../api'
import { useAppearance } from '../AppearanceContext'
import { Status, pct, rial } from '../ui'
import { fa, billions1 } from '../format'

const GROWTH_PERIODS = [
  { id: 'month', label: 'ماهانه (MoM)' },
  { id: 'season', label: 'فصلی (QoQ)' },
  { id: 'half', label: '۶ماهه (نیم‌سال)' },
]

/**
 * Custom Glassmorphic Dark/Light Growth Tooltip
 */
function GrowthChartTooltip({ active, payload, label, isDark }) {
  if (!active || !payload?.length) return null

  const row = payload[0]?.payload
  if (!row) return null

  const current = row.currentRaw || 0
  const previous = row.prevRaw || 0
  const delta = current - previous
  const growth = previous > 0 ? ((delta / previous) * 100) : null

  return (
    <div
      dir="rtl"
      className={`rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl transition-all border text-right min-w-[220px] ${
        isDark
          ? 'bg-[#0F1412]/95 border-white/10 text-slate-100 shadow-[0_16px_40px_rgba(0,0,0,0.6)]'
          : 'bg-white/95 border-slate-200 text-slate-900 shadow-xl'
      }`}
    >
      <div className={`flex items-center justify-between pb-2 mb-2 border-b text-xs font-bold ${
        isDark ? 'border-white/[0.08] text-slate-300' : 'border-slate-100 text-slate-700'
      }`}>
        <span className="flex items-center gap-1.5">
          <Calendar size={13} className="text-emerald-400" />
          <span>{label}</span>
        </span>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
          isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-600'
        }`}>
          {row.range || ''}
        </span>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between gap-3">
          <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span>فروش این دوره:</span>
          </span>
          <b className={`font-sans font-bold tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
            {fa(current)} <span className="text-[10px] font-normal text-slate-400">ریال</span>
          </b>
        </div>

        {previous > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
              <span>دوره مقایسه ({row.compareLabel}):</span>
            </span>
            <b className={`font-sans font-bold tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {fa(previous)} <span className="text-[10px] font-normal text-slate-400">ریال</span>
            </b>
          </div>
        )}

        {growth != null && (
          <div className={`flex items-center justify-between gap-3 pt-1.5 border-t text-[11px] ${
            isDark ? 'border-white/[0.06]' : 'border-slate-100'
          }`}>
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>تغییر و رشد:</span>
            <span className={`font-sans font-bold tabular-nums flex items-center gap-0.5 ${
              growth >= 0
                ? isDark ? 'text-emerald-400' : 'text-emerald-700'
                : isDark ? 'text-rose-400' : 'text-rose-700'
            }`}>
              {growth >= 0 ? '+' : ''}{pct(growth / 100, 1)}
              <span className="text-[10px] font-normal text-slate-400">
                ({delta >= 0 ? '+' : ''}{billions1(delta)} م. ریال)
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * ─────────────────────────────────────────────────────────────
 * GrowthPage (آنالیز رشد و افت فروش) - Executive Dark Bento Theme
 * ─────────────────────────────────────────────────────────────
 */
export default function GrowthPage({ p }) {
  const { isDark } = useAppearance()
  const [kind, setKind] = useState('month')
  const { month: _month, start: _start, end: _end, ...query } = p
  const r = useApi('/growth', { ...query, kind })

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5 sm:space-y-6">
      <Status state={r}>{(j) => {
        const periods = j.periods ?? []
        const last = periods[periods.length - 1]

        const chartData = periods.map((x) => ({
          label: x.label,
          range: `${x.start} تا ${x.end}`,
          current: Number(((x.sales_rial || 0) / 1e9).toFixed(2)),
          currentRaw: x.sales_rial || 0,
          previous: x.compare ? Number(((x.compare.sales_rial || 0) / 1e9).toFixed(2)) : null,
          prevRaw: x.compare ? (x.compare.sales_rial || 0) : 0,
          compareLabel: x.compare?.label ?? 'دوره قبل',
          growth: x.compare?.growth?.sales_rial ?? null,
        }))

        const latestGrowth = last?.compare?.growth?.sales_rial
        const latestDelta = last?.compare?.delta?.sales_rial

        return (
          <>
            {/* ── 1. Top Segmented Period Control Bar ── */}
            <div className={`rounded-2xl sm:rounded-3xl p-3 sm:px-6 sm:py-4 flex items-center justify-between gap-4 flex-wrap transition-colors border ${
              isDark
                ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
                : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
            }`}>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  بازه زمانی مقایسه:
                </span>
                <div className={`flex items-center gap-1 p-1 rounded-2xl border ${
                  isDark ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-slate-100 border-slate-200'
                }`}>
                  {GROWTH_PERIODS.map((item) => {
                    const active = kind === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setKind(item.id)}
                        className={`relative px-4 py-1.5 rounded-xl text-xs font-bold transition-all select-none cursor-pointer ${
                          active
                            ? 'text-[#090C0B]'
                            : isDark
                            ? 'text-slate-400 hover:text-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="growthPeriodTab"
                            className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm"
                            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                          />
                        )}
                        <span className="relative z-10">{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {j.last_date && (
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                    isDark
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>داده تا {j.last_date}</span>
                  </span>
                </div>
              )}
            </div>

            {!periods.length ? (
              <div className={`rounded-3xl p-12 text-center text-xs border ${
                isDark ? 'bg-[#0F1412] border-white/[0.06] text-slate-500' : 'bg-white border-slate-200 text-slate-400'
              }`}>
                دوره‌ای برای مقایسه با فیلترهای انتخابی یافت نشد.
              </div>
            ) : (
              <>
                {/* ── 2. Top 4-Card Executive KPI Strip ── */}
                {last && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
                    {/* Card 1: Current Period Sales */}
                    <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all border ${
                      isDark
                        ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
                        : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
                    }`}>
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                          فروش دوره جاری ({last.label})
                        </span>
                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          <CircleDollarSign size={17} />
                        </span>
                      </div>
                      <div className="my-2">
                        <div className={`text-xl sm:text-2xl font-black tabular-nums font-sans tracking-tight truncate ${
                          isDark ? 'text-slate-100' : 'text-slate-900'
                        }`}>
                          {billions1(last.sales_rial)} <span className={`text-xs font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>م. ریال</span>
                        </div>
                        <div className={`text-[11px] font-mono font-medium tabular-nums mt-0.5 truncate ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          {fa(last.sales_rial)} ریال
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold pt-2 border-t border-white/[0.06]">
                        <CheckCircle2 size={13} />
                        <span>وضعیت: {last.complete ? 'دوره کامل' : 'در جریان (تا امروز)'}</span>
                      </div>
                    </div>

                    {/* Card 2: Previous Compare Period */}
                    <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all border ${
                      isDark
                        ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
                        : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
                    }`}>
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                          فروش دوره مبنا ({last.compare?.label ?? '—'})
                        </span>
                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          isDark ? 'bg-slate-500/15 text-slate-400' : 'bg-slate-100 text-slate-700'
                        }`}>
                          <RotateCcw size={17} />
                        </span>
                      </div>
                      <div className="my-2">
                        <div className={`text-xl sm:text-2xl font-black tabular-nums font-sans tracking-tight truncate ${
                          isDark ? 'text-slate-100' : 'text-slate-900'
                        }`}>
                          {last.compare ? billions1(last.compare.sales_rial) : '—'} <span className="text-xs font-bold text-slate-400">م. ریال</span>
                        </div>
                        <div className={`text-[11px] font-mono font-medium tabular-nums mt-0.5 truncate ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          {last.compare ? `${fa(last.compare.sales_rial)} ریال` : 'بدون مبنا'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold pt-2 border-t border-white/[0.06]">
                        <Calendar size={13} />
                        <span>{last.compare ? `${fa(last.compare.sales_days)} روز دارای فروش` : '—'}</span>
                      </div>
                    </div>

                    {/* Card 3: Growth Percentage & Delta */}
                    <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all border ${
                      isDark
                        ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
                        : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
                    }`}>
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>نرخ رشد فروش</span>
                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          (latestGrowth ?? 0) >= 0
                            ? isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                            : isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {(latestGrowth ?? 0) >= 0 ? <TrendingUp size={17} /> : <TrendingDown size={17} />}
                        </span>
                      </div>
                      <div className="my-2">
                        <div className={`text-xl sm:text-2xl font-black tabular-nums font-sans tracking-tight ${
                          (latestGrowth ?? 0) >= 0
                            ? isDark ? 'text-emerald-400' : 'text-emerald-700'
                            : isDark ? 'text-rose-400' : 'text-rose-700'
                        }`}>
                          {latestGrowth != null ? `${latestGrowth >= 0 ? '+' : ''}${pct(latestGrowth, 1)}` : '—'}
                        </div>
                        <div className={`text-[11px] font-bold tabular-nums font-sans mt-0.5 truncate ${
                          (latestDelta ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {latestDelta != null ? `${latestDelta >= 0 ? '+' : ''}${billions1(latestDelta)} میلیارد ریال تغییر` : '—'}
                        </div>
                      </div>
                      <div className={`flex items-center gap-1.5 text-[11px] font-semibold pt-2 border-t border-white/[0.06] ${
                        (latestGrowth ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {(latestGrowth ?? 0) >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                        <span>{(latestGrowth ?? 0) >= 0 ? 'روند افزایشی مثبت' : 'افت فروش نسبت به دوره قبل'}</span>
                      </div>
                    </div>

                    {/* Card 4: Invoices and Customers Count */}
                    <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all border ${
                      isDark
                        ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
                        : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
                    }`}>
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>فاکتور و پوشش خریداران</span>
                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700'
                        }`}>
                          <FileText size={17} />
                        </span>
                      </div>
                      <div className="my-2">
                        <div className={`text-xl sm:text-2xl font-black tabular-nums font-sans tracking-tight ${
                          isDark ? 'text-slate-100' : 'text-slate-900'
                        }`}>
                          {fa(last.invoice_count)} <span className="text-xs font-bold text-slate-400">فقره فاکتور</span>
                        </div>
                        <div className={`text-[11px] font-medium mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {fa(last.active_customers)} مشتری فعال یکتا
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-semibold pt-2 border-t border-white/[0.06]">
                        <Users size={13} />
                        <span>سرانه: {last.active_customers > 0 ? fa(Math.round(last.invoice_count / last.active_customers * 10) / 10) : '—'} فاکتور/مشتری</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── 3. Growth Trend Comparison Glow Bar Chart ── */}
                <div className={`rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 flex flex-col justify-between transition-colors border ${
                  isDark
                    ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
                    : 'bg-white border-slate-200/90 text-slate-900 shadow-[0_4px_24px_rgba(15,23,42,0.05)]'
                }`}>
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${isDark ? 'bg-emerald-400 shadow-[0_0_10px_#10B981]' : 'bg-emerald-500'}`} />
                        <h2 className={`text-base sm:text-lg font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          نمودار مقایسه فروش دوره‌ها ({GROWTH_PERIODS.find((x) => x.id === kind)?.label})
                        </h2>
                      </div>
                      <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        مقایسه فروش عادی هر دوره در برابر دورهٔ متناظر قبل · ارقام به میلیارد ریال
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span>این دوره</span>
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                        <span>دورهٔ قبل</span>
                      </span>
                    </div>
                  </div>

                  <div className="h-72 sm:h-80 w-full mt-2" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }} barGap={6}>
                        <defs>
                          <linearGradient id="emeraldGrowthCurrent" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10B981" />
                            <stop offset="100%" stopColor="#059669" />
                          </linearGradient>
                          <linearGradient id="slateGrowthPrev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#64748B" />
                            <stop offset="100%" stopColor="#475569" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          vertical={false}
                          stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'}
                          strokeDasharray="3 3"
                        />
                        <XAxis
                          dataKey="label"
                          reversed
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 12, fontFamily: 'Vazirmatn' }}
                        />
                        <YAxis
                          orientation="right"
                          tickFormatter={(v) => fa(v)}
                          tickLine={false}
                          axisLine={false}
                          width={52}
                          tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11, fontFamily: 'Vazirmatn' }}
                        />
                        <Tooltip
                          content={<GrowthChartTooltip isDark={isDark} />}
                          cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', radius: 8 }}
                        />
                        <Bar
                          dataKey="current"
                          name="این دوره"
                          fill="url(#emeraldGrowthCurrent)"
                          radius={[8, 8, 2, 2]}
                          maxBarSize={32}
                        />
                        <Bar
                          dataKey="previous"
                          name="دورهٔ قبل"
                          fill="url(#slateGrowthPrev)"
                          radius={[8, 8, 2, 2]}
                          maxBarSize={32}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* ── 4. Detailed Growth Matrix Table ── */}
                <div className={`rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 overflow-hidden transition-colors border ${
                  isDark
                    ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
                    : 'bg-white border-slate-200/90 text-slate-900 shadow-[0_4px_24px_rgba(15,23,42,0.05)]'
                }`}>
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div>
                      <h3 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        ماتریس تفصیلی رشد و افت دوره‌ها
                      </h3>
                      <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        دوره‌های ناقص بر اساس روزهای کاری معادل با هم‌بازهٔ قبلی مقایسه می‌شوند
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      isDark
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}>
                      {fa(periods.length)} دوره ثبت‌شده
                    </span>
                  </div>

                  <div className="w-full overflow-x-auto exec-hover-scrollbar">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className={`border-b ${isDark ? 'border-white/[0.08] text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                          <th className="py-3 px-3 font-bold">دوره</th>
                          <th className="py-3 px-3 font-bold">بازه زمانی</th>
                          <th className="py-3 px-3 font-bold">وضعیت</th>
                          <th className="py-3 px-3 font-bold">فروش عادی (ریال)</th>
                          <th className="py-3 px-3 font-bold">ریال خالص</th>
                          <th className="py-3 px-3 font-bold">تعداد فاکتور</th>
                          <th className="py-3 px-3 font-bold">مشتری فعال</th>
                          <th className="py-3 px-3 font-bold">دوره مبنا</th>
                          <th className="py-3 px-3 font-bold">نرخ رشد</th>
                          <th className="py-3 px-3 font-bold">تغییر ریالی</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {periods.map((x) => {
                          const g = x.compare?.growth?.sales_rial
                          const delta = x.compare?.delta?.sales_rial

                          return (
                            <tr
                              key={x.key}
                              className={`transition-colors ${
                                isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="py-3 px-3 font-bold">
                                {x.label}
                              </td>
                              <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                                {x.start} تا {x.end}
                              </td>
                              <td className="py-3 px-3">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                  x.complete
                                    ? isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-800'
                                    : x.full_coverage
                                    ? isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-800'
                                    : isDark ? 'bg-slate-500/15 text-slate-400' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {x.complete ? 'کامل' : x.full_coverage ? 'ناقص' : 'پوشش ناقص'}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-sans font-bold tabular-nums text-emerald-400">
                                {fa(x.sales_rial)}
                              </td>
                              <td className="py-3 px-3 font-sans font-medium tabular-nums text-slate-300">
                                {fa(x.net_rial)}
                              </td>
                              <td className="py-3 px-3 font-sans font-bold tabular-nums text-amber-400">
                                {fa(x.invoice_count)}
                              </td>
                              <td className="py-3 px-3 font-sans font-bold tabular-nums text-cyan-400">
                                {fa(x.active_customers)}
                              </td>
                              <td className="py-3 px-3 text-[11px] text-slate-400">
                                {x.compare ? x.compare.label : '—'}
                              </td>
                              <td className="py-3 px-3 font-sans tabular-nums">
                                {g != null ? (
                                  <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                    g >= 0
                                      ? isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-800'
                                      : isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-50 text-rose-800'
                                  }`}>
                                    {g >= 0 ? '+' : ''}{pct(g, 1)}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                              <td className="py-3 px-3 font-sans font-bold tabular-nums" dir="ltr">
                                {delta != null ? (
                                  <span className={delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                    {delta >= 0 ? '+' : ''}{billions1(delta)} م. ریال
                                  </span>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── 5. Bottom Executive Callout ── */}
                {last?.compare && (
                  <div className={`rounded-2xl p-4 text-xs flex items-center justify-between flex-wrap gap-3 border ${
                    (latestGrowth ?? 0) >= 0
                      ? isDark
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : isDark
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} />
                      <span>
                        جمع‌بندی تحلیلی: آخرین دوره (<b>{last.label}</b>) به مبلغ <b>{billions1(last.sales_rial)} میلیارد ریال</b> در مقایسه با دوره مبنا (<b>{last.compare.label}</b> با {fa(last.compare.sales_days)} روز کاری) به تغییر <b>{latestGrowth >= 0 ? '+' : ''}{pct(latestGrowth, 1)}</b> دست یافته است.
                      </span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      (latestGrowth ?? 0) >= 0
                        ? isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-800'
                        : isDark ? 'bg-rose-500/20 text-rose-300' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {latestGrowth >= 0 ? 'روند صعودی' : 'هشدار کاهش فروش'}
                    </span>
                  </div>
                )}
              </>
            )}
          </>
        )
      }}</Status>
    </div>
  )
}

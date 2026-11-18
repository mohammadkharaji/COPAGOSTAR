import { useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CircleDollarSign,
  Calendar,
  TrendingUp,
  Award,
  FileText,
  Users,
  Percent,
  ArrowUpRight,
  BarChart3,
  Sparkles,
  Layers,
  ArrowDownRight,
} from 'lucide-react'
import { useApi } from '../api'
import { useAppearance } from '../AppearanceContext'
import { Status, pct, rial } from '../ui'
import { fa, monthName, monthLabel, billions1 } from '../format'

const PIE_OPTIONS = [
  ['month', 'ماه'],
  ['branch', 'شعبه'],
  ['region', 'منطقه'],
  ['brand', 'برند'],
  ['main_group', 'گروه کالا'],
  ['grade', 'گرید مشتری'],
]

const PALETTE = [
  '#10B981', // emerald
  '#06B6D4', // cyan
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#F59E0B', // amber
  '#14B8A6', // teal
  '#6366F1', // indigo
  '#64748B', // slate
]

/**
 * Custom Glassmorphic Dark/Light Monthly Chart Tooltip
 */
function MonthlyChartTooltip({ active, payload, label, isDark }) {
  if (!active || !payload?.length) return null

  const row = payload[0]?.payload
  if (!row) return null

  const promoAmount = Math.max(0, (row.sum_rial_vat || 0) - (row.net_rial || 0))
  const promoPct = row.sum_rial_vat > 0 ? (promoAmount / row.sum_rial_vat) : 0

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
          <span>{monthName(label)}</span>
        </span>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
          isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-600'
        }`}>
          {monthLabel(label)}
        </span>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between gap-3">
          <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span>فروش ناخالص:</span>
          </span>
          <b className={`font-sans font-bold tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
            {fa(row.sum_rial_vat)} <span className="text-[10px] font-normal text-slate-400">ریال</span>
          </b>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
            <span>ریال خالص:</span>
          </span>
          <b className={`font-sans font-bold tabular-nums ${isDark ? 'text-teal-400' : 'text-teal-700'}`}>
            {fa(row.net_rial)} <span className="text-[10px] font-normal text-slate-400">ریال</span>
          </b>
        </div>

        {promoAmount > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
              <span>مبلغ پروموشن:</span>
            </span>
            <span className="font-sans font-semibold tabular-nums text-rose-400">
              {fa(promoAmount)} ریال ({pct(promoPct)})
            </span>
          </div>
        )}

        {row.invoice_count > 0 && (
          <div className={`flex items-center justify-between gap-3 pt-1.5 border-t text-[11px] ${
            isDark ? 'border-white/[0.06] text-slate-400' : 'border-slate-100 text-slate-500'
          }`}>
            <span>تعداد فاکتورها:</span>
            <span className="font-sans font-semibold tabular-nums text-amber-400">
              {fa(row.invoice_count)} فاکتور
            </span>
          </div>
        )}

        {row.active_customers > 0 && (
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>مشتریان فعال:</span>
            <span className="font-sans font-semibold tabular-nums text-cyan-400">
              {fa(row.active_customers)} خریدار یکتا
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Modern Executive Monthly Share Donut Card
 */
function MonthlyShareDonut({ p, defaultBy = 'month' }) {
  const { isDark } = useAppearance()
  const [by, setBy] = useState(defaultBy)
  const r = useApi('/breakdown', { ...p, by, limit: 40 })

  return (
    <div className={`rounded-[24px] sm:rounded-[28px] p-5 sm:p-6 flex flex-col justify-between h-full transition-colors border ${
      isDark
        ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
        : 'bg-white border-slate-200/90 text-slate-900 shadow-[0_4px_24px_rgba(15,23,42,0.05)]'
    }`}>
      <div>
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isDark ? 'bg-emerald-400 shadow-[0_0_8px_#10B981]' : 'bg-emerald-500'}`} />
            <h2 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>سهم از فروش</h2>
          </div>
          <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>۸ مورد برتر + سایر</span>
        </div>

        {/* Dimension Selector Pills */}
        <div className={`flex items-center gap-1 p-1 rounded-2xl overflow-x-auto no-scrollbar mb-3 border ${
          isDark ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-slate-100 border-slate-200/80'
        }`} role="tablist">
          {PIE_OPTIONS.map(([k, label]) => {
            const active = by === k
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setBy(k)}
                className={`relative shrink-0 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all select-none cursor-pointer ${
                  active
                    ? 'text-white'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId={`monthlyPieFilter-${defaultBy}`}
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{label}</span>
              </button>
            )
          })}
        </div>

        <Status state={r}>{(rows) => {
          const pos = rows.filter((x) => x.sum_rial_vat > 0).sort((a, b) => b.sum_rial_vat - a.sum_rial_vat)
          const label = (x) => (by === 'month' ? monthName(String(x.key)) : String(x.key))
          const top = pos.slice(0, 8).map((x) => ({ name: label(x), value: x.sum_rial_vat }))
          const rest = pos.slice(8).reduce((s, x) => s + x.sum_rial_vat, 0)
          if (rest > 0) top.push({ name: 'سایر', value: rest })
          const total = top.reduce((s, x) => s + x.value, 0)

          if (!top.length) {
            return (
              <div className={`text-center py-12 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                داده‌ای برای این فیلترها وجود ندارد.
              </div>
            )
          }

          return (
            <>
              {/* Donut Chart */}
              <div className="relative w-full h-44 my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={top}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="64%"
                      outerRadius="88%"
                      paddingAngle={3}
                      stroke="none"
                    >
                      {top.map((s, i) => (
                        <Cell key={s.name} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v, n) => [`${fa(v)} ریال (${pct(v / total)})`, n]}
                      contentStyle={{
                        background: isDark ? '#0F1412' : '#FFFFFF',
                        borderRadius: '16px',
                        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #E2E8F0',
                        color: isDark ? '#F1F5F9' : '#0F172A',
                        fontSize: '12px',
                        direction: 'rtl',
                        fontFamily: 'Vazirmatn, sans-serif',
                        boxShadow: '0 16px 36px rgba(0,0,0,0.3)',
                      }}
                      itemStyle={{ color: isDark ? '#F1F5F9' : '#0F172A' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>مجموع سهم</span>
                  <span className={`text-base font-extrabold tabular-nums font-sans mt-0.5 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    {fa(Math.round(total / 1e9))}
                  </span>
                  <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>میلیارد ریال</span>
                </div>
              </div>

              {/* Breakdown List with Hover Scrollbar */}
              <ul className={`space-y-2 mt-3 pt-3 border-t max-h-44 overflow-y-auto exec-hover-scrollbar w-full px-1 pl-2 ${
                isDark ? 'border-white/[0.06]' : 'border-slate-100'
              }`}>
                {top.map((s, i) => (
                  <li key={s.name} className="flex items-center justify-between gap-2 text-xs w-full px-1">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                      <span className={`text-xs font-medium truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        {s.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-semibold tabular-nums font-sans ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        {pct(s.value / total)}
                      </span>
                      <span aria-hidden="true" className={`w-12 h-1.5 rounded-full overflow-hidden shrink-0 ${isDark ? 'bg-white/[0.06]' : 'bg-slate-200'}`}>
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${(s.value / total) * 100}%`,
                            background: PALETTE[i % PALETTE.length],
                          }}
                        />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )
        }}</Status>
      </div>
    </div>
  )
}

/**
 * ─────────────────────────────────────────────────────────────
 * MonthlyTrendPage (روند ماهانه فروش) - Redesigned Executive Dark Theme
 * ─────────────────────────────────────────────────────────────
 */
export default function MonthlyTrendPage({ p }) {
  const { isDark } = useAppearance()
  // Monthly overview strips the specific month/date filter so user sees full seasonal curve:
  const { month: _m, start: _s, end: _e, ...q } = p
  const m = useApi('/monthly', q)
  const [activeTab, setActiveTab] = useState('sales') // 'sales' | 'growth'

  return (
    <Status state={m}>{(rows) => {
      const d = rows.map((r) => {
        const gross = Number(((r.sum_rial_vat || 0) / 1e9).toFixed(2))
        const net = Number(((r.net_rial || 0) / 1e9).toFixed(2))
        const promoAmount = Math.max(0, (r.sum_rial_vat || 0) - (r.net_rial || 0))
        const promoGross = Number((promoAmount / 1e9).toFixed(2))
        const invoiceCount = Number(r.invoice_count || 0)
        const activeCust = Number(r.active_customers || 0)
        const aov = invoiceCount > 0 ? Math.round((r.net_rial || r.sum_rial_vat) / invoiceCount) : 0
        const growth = r.invoice_growth != null ? Number(r.invoice_growth) : null

        return {
          ...r,
          gross,
          net,
          promoGross,
          invoiceCount,
          activeCust,
          aov,
          growth,
        }
      })

      const totalGross = rows.reduce((s, r) => s + (r.sum_rial_vat || 0), 0)
      const totalNet = rows.reduce((s, r) => s + (r.net_rial || 0), 0)
      const totalInvoices = rows.reduce((s, r) => s + (r.invoice_count || 0), 0)
      const totalPromo = Math.max(0, totalGross - totalNet)
      const overallPromoPct = totalGross > 0 ? (totalPromo / totalGross) : 0
      const avgMonthlySales = rows.length ? totalGross / rows.length : 0
      const bestMonth = rows.reduce((a, r) => (r.sum_rial_vat > (a?.sum_rial_vat ?? -Infinity) ? r : a), null)

      return (
        <div className="w-full max-w-[1600px] mx-auto space-y-5 sm:space-y-6">
          {/* ── 1. Top 4-Card Executive KPI Strip ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
            {/* Card 1: Total Gross Sales */}
            <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all border ${
              isDark
                ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
                : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
            }`}>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>مجموع ناخالص دوره</span>
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
                  {billions1(totalGross)} <span className={`text-xs font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>م. ریال</span>
                </div>
                <div className={`text-[11px] font-mono font-medium tabular-nums mt-0.5 truncate ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  {fa(totalGross)} ریال
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold pt-2 border-t border-white/[0.06]">
                <ArrowUpRight size={13} />
                <span>شامل مالیات و عوارض (Rial+Vat)</span>
              </div>
            </div>

            {/* Card 2: Net Sales */}
            <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all border ${
              isDark
                ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
                : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
            }`}>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>فروش خالص دوره</span>
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isDark ? 'bg-teal-500/15 text-teal-400' : 'bg-teal-50 text-teal-700'
                }`}>
                  <TrendingUp size={17} />
                </span>
              </div>
              <div className="my-2">
                <div className={`text-xl sm:text-2xl font-black tabular-nums font-sans tracking-tight truncate ${
                  isDark ? 'text-slate-100' : 'text-slate-900'
                }`}>
                  {billions1(totalNet)} <span className={`text-xs font-bold ${isDark ? 'text-teal-400' : 'text-teal-700'}`}>م. ریال</span>
                </div>
                <div className={`text-[11px] font-medium mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  پروموشن کل: {pct(overallPromoPct)} ({billions1(totalPromo)} م. ریال)
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-teal-400 font-semibold pt-2 border-t border-white/[0.06]">
                <Percent size={13} />
                <span>خالص پس از کسر پروموشن</span>
              </div>
            </div>

            {/* Card 3: Monthly Run-Rate */}
            <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all border ${
              isDark
                ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
                : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
            }`}>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>میانگین فروش ماهانه</span>
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isDark ? 'bg-cyan-500/15 text-cyan-400' : 'bg-cyan-50 text-cyan-700'
                }`}>
                  <Calendar size={17} />
                </span>
              </div>
              <div className="my-2">
                <div className={`text-xl sm:text-2xl font-black tabular-nums font-sans tracking-tight truncate ${
                  isDark ? 'text-slate-100' : 'text-slate-900'
                }`}>
                  {billions1(avgMonthlySales)} <span className={`text-xs font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>م. ریال</span>
                </div>
                <div className={`text-[11px] font-medium mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  طی {fa(rows.length)} ماه مالی ثبت‌شده
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-cyan-400 font-semibold pt-2 border-t border-white/[0.06]">
                <BarChart3 size={13} />
                <span>میانگین جریان ماهانه</span>
              </div>
            </div>

            {/* Card 4: Peak Month Record */}
            <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all border ${
              isDark
                ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
                : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
            }`}>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>بهترین ماه (رکورد سال)</span>
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700'
                }`}>
                  <Award size={17} />
                </span>
              </div>
              <div className="my-2">
                <div className={`text-lg sm:text-xl font-black tracking-tight truncate ${
                  isDark ? 'text-amber-400' : 'text-amber-700'
                }`}>
                  {bestMonth ? monthName(bestMonth.year_month) : '—'}
                </div>
                <div className={`text-xs font-bold tabular-nums font-sans mt-0.5 truncate ${
                  isDark ? 'text-slate-200' : 'text-slate-800'
                }`}>
                  {bestMonth ? `${billions1(bestMonth.sum_rial_vat)} میلیارد ریال` : '—'}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-semibold pt-2 border-t border-white/[0.06]">
                <Sparkles size={13} />
                <span>{bestMonth ? `${fa(bestMonth.invoice_count)} فاکتور صادرشده` : '—'}</span>
              </div>
            </div>
          </div>

          {/* ── 2. Middle Row: Monthly Sales Bar Chart (8 Cols) + Share Donut (4 Cols) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch w-full">
            {/* Right Card: Monthly Sales Chart */}
            <div className={`lg:col-span-8 rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 flex flex-col justify-between transition-colors border ${
              isDark
                ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
                : 'bg-white border-slate-200/90 text-slate-900 shadow-[0_4px_24px_rgba(15,23,42,0.05)]'
            }`}>
              {/* Header & Controls */}
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isDark ? 'bg-emerald-400 shadow-[0_0_10px_#10B981]' : 'bg-emerald-500'}`} />
                    <h2 className={`text-base sm:text-lg font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                      روند ماهانه فروش و مقایسه ناخالص و خالص
                    </h2>
                  </div>
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    مبالغ بر حسب میلیارد ریال به تفکیک ماه‌های سال مالی
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>ناخالص (Rial+Vat)</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-teal-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-400" />
                    <span>ریال خالص</span>
                  </span>
                </div>
              </div>

              {/* Bar Chart Container */}
              <div className="h-72 sm:h-80 w-full mt-2" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d} margin={{ top: 12, right: 12, left: 0, bottom: 0 }} barGap={6}>
                    <defs>
                      <linearGradient id="emeraldMonthlyGross" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                      <linearGradient id="tealMonthlyNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#14B8A6" />
                        <stop offset="100%" stopColor="#0D9488" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'}
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="year_month"
                      reversed
                      tickFormatter={monthName}
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
                      content={<MonthlyChartTooltip isDark={isDark} />}
                      cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', radius: 8 }}
                    />
                    <Bar
                      dataKey="gross"
                      name="فروش ناخالص"
                      fill="url(#emeraldMonthlyGross)"
                      radius={[8, 8, 2, 2]}
                      maxBarSize={28}
                    />
                    <Bar
                      dataKey="net"
                      name="ریال خالص"
                      fill="url(#tealMonthlyNet)"
                      radius={[8, 8, 2, 2]}
                      maxBarSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Card Footer Summary */}
              <div className={`flex items-center justify-between pt-4 mt-3 border-t text-xs ${
                isDark ? 'border-white/[0.06] text-slate-400' : 'border-slate-100 text-slate-500'
              }`}>
                <span>مجموع دوره: {billions1(totalGross)} میلیارد ریال</span>
                <span className="text-teal-400 font-bold">خالص نهایی: {billions1(totalNet)} میلیارد ریال</span>
              </div>
            </div>

            {/* Left Card: Monthly Share of Sales Donut */}
            <div className="lg:col-span-4">
              <MonthlyShareDonut p={q} defaultBy="month" />
            </div>
          </div>

          {/* ── 3. Bottom Row: Invoices and Active Customers Across Months ── */}
          <div className={`rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 transition-colors border ${
            isDark
              ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
              : 'bg-white border-slate-200/90 text-slate-900 shadow-[0_4px_24px_rgba(15,23,42,0.05)]'
          }`}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isDark ? 'bg-cyan-400 shadow-[0_0_10px_#06B6D4]' : 'bg-cyan-500'}`} />
                <div>
                  <h2 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    روند ماهانه تعداد فاکتور و مشتریان فعال
                  </h2>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    شمار فاکتورهای قطعی صادرشده در برابر تعداد خریداران یکتا در هر ماه
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>تعداد فاکتور</span>
                </span>
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <span>مشتری فعال</span>
                </span>
              </div>
            </div>

            <div className="h-60 sm:h-68 w-full mt-2" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barGap={6}>
                  <defs>
                    <linearGradient id="amberMonthlyInvoice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F59E0B" />
                      <stop offset="100%" stopColor="#D97706" />
                    </linearGradient>
                    <linearGradient id="cyanMonthlyCust" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06B6D4" />
                      <stop offset="100%" stopColor="#0891B2" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="year_month"
                    reversed
                    tickFormatter={monthName}
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
                    content={<MonthlyChartTooltip isDark={isDark} />}
                    cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', radius: 8 }}
                  />
                  <Bar
                    dataKey="invoiceCount"
                    name="تعداد فاکتور"
                    fill="url(#amberMonthlyInvoice)"
                    radius={[8, 8, 2, 2]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="activeCust"
                    name="مشتری فعال"
                    fill="url(#cyanMonthlyCust)"
                    radius={[8, 8, 2, 2]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── 4. Full Monthly Summary Table ── */}
          <div className={`rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 overflow-hidden transition-colors border ${
            isDark
              ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
              : 'bg-white border-slate-200/90 text-slate-900 shadow-[0_4px_24px_rgba(15,23,42,0.05)]'
          }`}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h3 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  جدول جامع عملکرد ماهانه
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  جزئیات آماری فروش، ریال خالص، پروموشن، تعداد فاکتور و مشتریان به تفکیک ماه
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                isDark
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}>
                {fa(rows.length)} ماه مالی ثبت‌شده
              </span>
            </div>

            <div className="w-full overflow-x-auto exec-hover-scrollbar">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-white/[0.08] text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                    <th className="py-3 px-3 font-bold">ماه</th>
                    <th className="py-3 px-3 font-bold">فروش ناخالص (ریال)</th>
                    <th className="py-3 px-3 font-bold">ریال خالص (ریال)</th>
                    <th className="py-3 px-3 font-bold">درصد پروموشن</th>
                    <th className="py-3 px-3 font-bold">تعداد فاکتور</th>
                    <th className="py-3 px-3 font-bold">رشد فاکتور</th>
                    <th className="py-3 px-3 font-bold">مشتری فعال</th>
                    <th className="py-3 px-3 font-bold">میانگین ارزش فاکتور</th>
                    <th className="py-3 px-3 font-bold">سهم از کل دوره</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {d.map((row) => {
                    const isBest = bestMonth && row.year_month === bestMonth.year_month
                    const share = totalGross > 0 ? (row.sum_rial_vat / totalGross) : 0
                    const promoPct = row.sum_rial_vat > 0 ? (row.promoGross / row.gross) : 0

                    return (
                      <tr
                        key={row.year_month}
                        className={`transition-colors ${
                          isBest
                            ? isDark
                              ? 'bg-amber-500/10 hover:bg-amber-500/15'
                              : 'bg-amber-50 hover:bg-amber-100'
                            : isDark
                            ? 'hover:bg-white/[0.03]'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-3 font-bold">
                          <div className="flex items-center gap-1.5">
                            {isBest && <Award size={14} className="text-amber-400 shrink-0" />}
                            <span className="font-bold">{monthName(row.year_month)}</span>
                            <span className="text-[10px] font-mono text-slate-400">({monthLabel(row.year_month)})</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-sans font-bold tabular-nums text-emerald-400">
                          {fa(row.sum_rial_vat)}
                        </td>
                        <td className="py-3 px-3 font-sans font-bold tabular-nums text-teal-400">
                          {fa(row.net_rial)}
                        </td>
                        <td className="py-3 px-3 font-sans font-semibold tabular-nums text-rose-400">
                          {pct(promoPct, 1)}
                        </td>
                        <td className="py-3 px-3 font-sans font-bold tabular-nums text-amber-400">
                          {fa(row.invoiceCount)}
                        </td>
                        <td className="py-3 px-3 font-sans tabular-nums">
                          {row.growth != null ? (
                            <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              row.growth >= 0
                                ? isDark
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : 'bg-emerald-50 text-emerald-800'
                                : isDark
                                ? 'bg-rose-500/15 text-rose-400'
                                : 'bg-rose-50 text-rose-800'
                            }`}>
                              {row.growth >= 0 ? '+' : ''}{pct(row.growth, 1)}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-sans font-bold tabular-nums text-cyan-400">
                          {fa(row.activeCust)}
                        </td>
                        <td className="py-3 px-3 font-sans font-medium tabular-nums">
                          {fa(row.aov)} ریال
                        </td>
                        <td className="py-3 px-3 font-sans tabular-nums">
                          <div className="flex items-center gap-2">
                            <span className="w-10 text-left font-bold">{pct(share)}</span>
                            <div className={`flex-1 h-1.5 max-w-[80px] rounded-full overflow-hidden ${
                              isDark ? 'bg-white/10' : 'bg-slate-200'
                            }`}>
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${share * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )
    }}</Status>
  )
}

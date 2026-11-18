import { useMemo, useState } from 'react'
import {
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
  BarChart,
  Bar,
} from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CircleDollarSign,
  Calendar,
  TrendingUp,
  Award,
  Users,
  BarChart3,
  Sparkles,
  ArrowUpRight,
  ShoppingBag,
  Store,
  Layers,
  Percent,
} from 'lucide-react'
import { useApi } from '../api'
import { useAppearance } from '../AppearanceContext'
import { Status, pct, rial } from '../ui'
import { fa, dayLabel, monthLabel, billions1 } from '../format'

const PIE_OPTIONS = [
  ['branch', 'شعبه'],
  ['region', 'منطقه'],
  ['brand', 'برند'],
  ['main_group', 'گروه کالا'],
  ['grade', 'گرید مشتری'],
  ['month', 'ماه'],
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
 * Custom Glassmorphic Dark/Light Chart Tooltip
 */
function DailyChartTooltip({ active, payload, label, isDark }) {
  if (!active || !payload?.length) return null

  const row = payload[0]?.payload
  if (!row) return null

  return (
    <div
      dir="rtl"
      className={`rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl transition-all border text-right min-w-[210px] ${
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
          <span>{dayLabel(label)}</span>
        </span>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
          isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-600'
        }`}>
          {label}
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
            <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
            <span>مشتری فعال:</span>
          </span>
          <b className={`font-sans font-bold tabular-nums ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
            {fa(row.customers)} <span className="text-[10px] font-normal text-slate-400">نفر</span>
          </b>
        </div>

        {row.customers > 0 && (
          <div className={`flex items-center justify-between gap-3 pt-1.5 border-t text-[11px] ${
            isDark ? 'border-white/[0.06] text-slate-400' : 'border-slate-100 text-slate-500'
          }`}>
            <span>میانگین هر مشتری:</span>
            <span className="font-sans font-semibold tabular-nums">
              {fa(Math.round(row.sum_rial_vat / row.customers))} ریال
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Modern Executive Share of Sales Donut Card
 */
function DailyShareDonut({ p, defaultBy = 'branch' }) {
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
                    layoutId={`dailyPieFilter-${defaultBy}`}
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
          const label = (x) => (by === 'month' ? monthLabel(String(x.key)) : String(x.key))
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
 * TrendPage (روند روزانه فروش) - Redesigned Executive Dark Theme
 * ─────────────────────────────────────────────────────────────
 */
export default function TrendPage({ p }) {
  const { isDark } = useAppearance()
  const t = useApi('/trend', p)
  const [activeTab, setActiveTab] = useState('sales') // 'sales' | 'customers' | 'combined'
  const [showTable, setShowTable] = useState(false)

  return (
    <Status state={t}>{(rows) => {
      const d = rows.map((r) => ({
        ...r,
        gross: Number(((r.sum_rial_vat || 0) / 1e9).toFixed(2)),
        customers: Number(r.customers || 0),
        arpu: r.customers > 0 ? Math.round(r.sum_rial_vat / r.customers) : 0,
      }))

      const total = rows.reduce((s, r) => s + r.sum_rial_vat, 0)
      const totalCustomersSum = rows.reduce((s, r) => s + (r.customers || 0), 0)
      const avgDailySales = rows.length ? total / rows.length : 0
      const avgDailyCustomers = rows.length ? Math.round(totalCustomersSum / rows.length) : 0
      const best = rows.reduce((a, r) => (r.sum_rial_vat > (a?.sum_rial_vat ?? -Infinity) ? r : a), null)
      const bestCustomerDay = rows.reduce((a, r) => ((r.customers || 0) > (a?.customers ?? -Infinity) ? r : a), null)

      return (
        <div className="w-full max-w-[1600px] mx-auto space-y-5 sm:space-y-6">
          {/* ── 1. Top Unified 4-Card Executive KPI Strip ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
            {/* Card 1: Total Sales */}
            <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all border ${
              isDark
                ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
                : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
            }`}>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>جمع فروش دوره</span>
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
                  {billions1(total)} <span className={`text-xs font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>م. ریال</span>
                </div>
                <div className={`text-[11px] font-mono font-medium tabular-nums mt-0.5 truncate ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  {fa(total)} ریال
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold pt-2 border-t border-white/[0.06]">
                <ArrowUpRight size={13} />
                <span>فروش ناخالص (Rial+Vat)</span>
              </div>
            </div>

            {/* Card 2: Sales Days */}
            <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all border ${
              isDark
                ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
                : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
            }`}>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>روزهای دارای فروش</span>
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  isDark ? 'bg-cyan-500/15 text-cyan-400' : 'bg-cyan-50 text-cyan-700'
                }`}>
                  <Calendar size={17} />
                </span>
              </div>
              <div className="my-2">
                <div className={`text-xl sm:text-2xl font-black tabular-nums font-sans tracking-tight ${
                  isDark ? 'text-slate-100' : 'text-slate-900'
                }`}>
                  {fa(rows.length)} <span className="text-xs font-bold text-slate-400">روز کاری</span>
                </div>
                <div className={`text-[11px] font-medium mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  میانگین {fa(avgDailyCustomers)} خریدار در هر روز
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-cyan-400 font-semibold pt-2 border-t border-white/[0.06]">
                <Users size={13} />
                <span>پوشش فروش در دوره</span>
              </div>
            </div>

            {/* Card 3: Avg Daily Sales */}
            <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all border ${
              isDark
                ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
                : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
            }`}>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>میانگین فروش روزانه</span>
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
                  {billions1(avgDailySales)} <span className={`text-xs font-bold ${isDark ? 'text-teal-400' : 'text-teal-700'}`}>م. ریال</span>
                </div>
                <div className={`text-[11px] font-mono font-medium tabular-nums mt-0.5 truncate ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  {fa(Math.round(avgDailySales))} ریال / روز
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-teal-400 font-semibold pt-2 border-t border-white/[0.06]">
                <BarChart3 size={13} />
                <span>نرخ جریان نقدینگی</span>
              </div>
            </div>

            {/* Card 4: Best Sales Day */}
            <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all border ${
              isDark
                ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
                : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
            }`}>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>بهترین روز فروش (رکورد)</span>
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
                  {best ? dayLabel(best.date) : '—'}
                </div>
                <div className={`text-xs font-bold tabular-nums font-sans mt-0.5 truncate ${
                  isDark ? 'text-slate-200' : 'text-slate-800'
                }`}>
                  {best ? `${billions1(best.sum_rial_vat)} میلیارد ریال` : '—'}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-semibold pt-2 border-t border-white/[0.06]">
                <Sparkles size={13} />
                <span>{best ? `${fa(best.customers)} خریدار فعال` : '—'}</span>
              </div>
            </div>
          </div>

          {/* ── 2. Middle Grid: Daily Sales Glow Chart (8 Cols) + Share Donut (4 Cols) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch w-full">
            {/* Right Card: Daily Sales Trend */}
            <div className={`lg:col-span-8 rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 flex flex-col justify-between transition-colors border ${
              isDark
                ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
                : 'bg-white border-slate-200/90 text-slate-900 shadow-[0_4px_24px_rgba(15,23,42,0.05)]'
            }`}>
              {/* Card Header & Controls */}
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isDark ? 'bg-emerald-400 shadow-[0_0_10px_#10B981]' : 'bg-emerald-500'}`} />
                    <h2 className={`text-base sm:text-lg font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                      روند روزانه فروش
                    </h2>
                  </div>
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    نوسان فروش ناخالص روزانه (Rial+Vat) به میلیارد ریال
                  </p>
                </div>

                {/* View Mode Pills */}
                <div className={`flex items-center gap-1 p-1 rounded-xl border ${
                  isDark ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-slate-100 border-slate-200'
                }`}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('sales')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'sales'
                        ? 'bg-emerald-500 text-[#090C0B] shadow-sm'
                        : isDark
                        ? 'text-slate-400 hover:text-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    فروش روزانه
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('customers')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'customers'
                        ? 'bg-cyan-500 text-[#090C0B] shadow-sm'
                        : isDark
                        ? 'text-slate-400 hover:text-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    تعداد مشتری
                  </button>
                </div>
              </div>

              {/* Area Chart Container */}
              <div className="h-72 sm:h-80 w-full mt-2" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={d} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="emeraldDailySales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                        <stop offset="60%" stopColor="#10B981" stopOpacity={0.08} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0.00} />
                      </linearGradient>
                      <linearGradient id="cyanDailyCust" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.35} />
                        <stop offset="60%" stopColor="#06B6D4" stopOpacity={0.08} />
                        <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.00} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'}
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="date"
                      reversed
                      tickFormatter={dayLabel}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={24}
                      tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11, fontFamily: 'Vazirmatn' }}
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
                      content={<DailyChartTooltip isDark={isDark} />}
                      cursor={{
                        stroke: isDark ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.2)',
                        strokeWidth: 2,
                        strokeDasharray: '4 4',
                      }}
                    />
                    {activeTab === 'sales' ? (
                      <Area
                        type="monotone"
                        dataKey="gross"
                        name="فروش ناخالص"
                        stroke="#10B981"
                        strokeWidth={2.8}
                        fill="url(#emeraldDailySales)"
                        activeDot={{
                          r: 6,
                          fill: '#10B981',
                          stroke: isDark ? '#0F1412' : '#FFFFFF',
                          strokeWidth: 3,
                        }}
                      />
                    ) : (
                      <Area
                        type="monotone"
                        dataKey="customers"
                        name="مشتری فعال"
                        stroke="#06B6D4"
                        strokeWidth={2.8}
                        fill="url(#cyanDailyCust)"
                        activeDot={{
                          r: 6,
                          fill: '#06B6D4',
                          stroke: isDark ? '#0F1412' : '#FFFFFF',
                          strokeWidth: 3,
                        }}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Chart Footer Indicator */}
              <div className={`flex items-center justify-between pt-4 mt-3 border-t text-xs ${
                isDark ? 'border-white/[0.06] text-slate-400' : 'border-slate-100 text-slate-500'
              }`}>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span>مجموع دوره: {billions1(total)} م. ریال</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                    <span>کل خریداران یکتا: {fa(totalCustomersSum)} نفر-روز</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTable((v) => !v)}
                  className={`text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                    isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-700 hover:text-emerald-800'
                  }`}
                >
                  <span>{showTable ? 'بستن جدول روزانه' : 'مشاهده جدول تفصیلی روزانه ←'}</span>
                </button>
              </div>
            </div>

            {/* Left Card: Share of Sales Donut */}
            <div className="lg:col-span-4">
              <DailyShareDonut p={p} defaultBy="branch" />
            </div>
          </div>

          {/* ── 3. Bottom Row: Active Customers Daily Flow ── */}
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
                    نوسان مشتریان فعال در هر روز
                  </h2>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    تعداد مشتریان یکتایی که در هر تاریخ فاکتور خرید ثبت کرده‌اند
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  isDark
                    ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                    : 'bg-cyan-50 border-cyan-200 text-cyan-800'
                }`}>
                  رکورد روز: {bestCustomerDay ? `${fa(bestCustomerDay.customers)} مشتری (${dayLabel(bestCustomerDay.date)})` : '—'}
                </span>
              </div>
            </div>

            <div className="h-56 sm:h-64 w-full mt-2" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid
                    vertical={false}
                    stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="date"
                    reversed
                    tickFormatter={dayLabel}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                    tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11, fontFamily: 'Vazirmatn' }}
                  />
                  <YAxis
                    orientation="right"
                    tickFormatter={(v) => fa(v)}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11, fontFamily: 'Vazirmatn' }}
                  />
                  <Tooltip
                    content={<DailyChartTooltip isDark={isDark} />}
                    cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                  />
                  <Bar
                    dataKey="customers"
                    name="تعداد مشتری"
                    fill="#06B6D4"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── 4. Detailed Tabular Breakdown (Collapsible) ── */}
          <AnimatePresence>
            {showTable && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className={`rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 overflow-hidden transition-colors border ${
                  isDark
                    ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
                    : 'bg-white border-slate-200/90 text-slate-900 shadow-[0_4px_24px_rgba(15,23,42,0.05)]'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-sm sm:text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    ریز عملکرد روزهای دوره
                  </h3>
                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {fa(rows.length)} روز ثبت‌شده
                  </span>
                </div>

                <div className="w-full overflow-x-auto exec-hover-scrollbar">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className={`border-b ${isDark ? 'border-white/[0.08] text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                        <th className="py-2.5 px-3 font-bold">تاریخ</th>
                        <th className="py-2.5 px-3 font-bold">عنوان روز</th>
                        <th className="py-2.5 px-3 font-bold">فروش ناخالص (ریال)</th>
                        <th className="py-2.5 px-3 font-bold">مشتری فعال</th>
                        <th className="py-2.5 px-3 font-bold">میانگین خرید مشتری</th>
                        <th className="py-2.5 px-3 font-bold">سهم از کل دوره</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {d.map((row) => {
                        const isBestDay = best && row.date === best.date
                        const share = total > 0 ? (row.sum_rial_vat / total) : 0
                        return (
                          <tr
                            key={row.date}
                            className={`transition-colors ${
                              isBestDay
                                ? isDark
                                  ? 'bg-amber-500/10 hover:bg-amber-500/15'
                                  : 'bg-amber-50 hover:bg-amber-100'
                                : isDark
                                ? 'hover:bg-white/[0.03]'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-3 px-3 font-mono font-medium">{row.date}</td>
                            <td className="py-3 px-3 font-bold">
                              <span className="flex items-center gap-1.5">
                                {isBestDay && <Award size={14} className="text-amber-400" />}
                                <span>{dayLabel(row.date)}</span>
                              </span>
                            </td>
                            <td className="py-3 px-3 font-sans font-bold tabular-nums text-emerald-400">
                              {fa(row.sum_rial_vat)}
                            </td>
                            <td className="py-3 px-3 font-sans font-bold tabular-nums text-cyan-400">
                              {fa(row.customers)}
                            </td>
                            <td className="py-3 px-3 font-sans font-medium tabular-nums">
                              {fa(row.arpu)} ریال
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )
    }}</Status>
  )
}

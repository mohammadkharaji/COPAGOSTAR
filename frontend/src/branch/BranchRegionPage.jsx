import { useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin,
  Building2,
  Users,
  CircleDollarSign,
  TrendingUp,
  Award,
  ArrowUpRight,
  Search,
  RotateCcw,
  FileText,
  ChevronLeft,
  Filter,
  Sparkles,
  Layers,
  Undo2,
  Percent,
} from 'lucide-react'
import { useApi } from '../api'
import { useAppearance } from '../AppearanceContext'
import { Status, pct, rial } from '../ui'
import { fa, billions1 } from '../format'

const cleanDistrictLabel = (label) => (typeof label === 'string' ? label.replace(/\s*[-_]\s*[\d۰-۹]+$/, '').trim() : label)

const DIM_OPTIONS = [
  ['branch', 'شعبه'],
  ['region', 'منطقه'],
  ['state', 'منطقه شهرداری'],
  ['city', 'شهر'],
  ['visitor', 'ویزیتور'],
  ['grade', 'گرید مشتری'],
]

const DRILL_CHILDREN = {
  branch: ['visitor', 'city', 'grade'],
  region: ['city', 'branch'],
}

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
 * Custom Glassmorphic Dark/Light Territory Tooltip
 */
function BranchChartTooltip({ active, payload, label, isDark }) {
  if (!active || !payload?.length) return null

  const row = payload[0]?.payload
  if (!row) return null

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
          <MapPin size={13} className="text-emerald-400" />
          <span>{row.name}</span>
        </span>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
          isDark ? 'bg-white/[0.06] text-slate-400' : 'bg-slate-100 text-slate-600'
        }`}>
          رتبه #{fa(row.rank)}
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

        <div className="flex items-center justify-between gap-3 pt-1.5 border-t text-[11px]">
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>مشتریان فعال:</span>
          <span className="font-sans font-semibold tabular-nums text-cyan-400">
            {fa(row.active_customers)} خریدار یکتا
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 text-[11px]">
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>تعداد فاکتورها:</span>
          <span className="font-sans font-semibold tabular-nums text-amber-400">
            {fa(row.invoice_count)} فاکتور
          </span>
        </div>

        {row.return_percent > 0 && (
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>درصد برگشتی:</span>
            <span className="font-sans font-semibold tabular-nums text-rose-400">
              {pct(row.return_percent, 1)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * ─────────────────────────────────────────────────────────────
 * BranchRegionPage (شعب، مناطق و توزیع جغرافیایی)
 * Executive Dark Bento Redesign
 * ─────────────────────────────────────────────────────────────
 */
export default function BranchRegionPage({ p, openProfile }) {
  const { isDark } = useAppearance()
  const [by, setBy] = useState('branch')
  const [sel, setSel] = useState(null) // { by: 'branch', key: 'تهران مرکز' }
  const [childBy, setChildBy] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [metricView, setMetricView] = useState('gross') // 'gross' | 'net' | 'customers'

  const children = sel ? DRILL_CHILDREN[sel.by] : null
  const activeChild = sel ? (children && children.includes(childBy) ? childBy : children?.[0] || 'visitor') : null

  // Fetch breakdown rows
  const query = useMemo(() => {
    if (sel) {
      return { ...p, [sel.by]: sel.key, by: activeChild, limit: 200 }
    }
    return { ...p, by, limit: 60 }
  }, [p, sel, by, activeChild])

  const r = useApi('/breakdown', query)

  const activeLabel = sel ? `${sel.key} به تفکیک ${DIM_OPTIONS.find(([k]) => k === activeChild)?.[1]}` : (DIM_OPTIONS.find(([k]) => k === by)?.[1] ?? 'واحد')

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5 sm:space-y-6">
      {/* ── 1. Top Geographical Dimension Selector ── */}
      <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex items-center justify-between gap-4 flex-wrap transition-colors border ${
        isDark
          ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
          : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
      }`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isDark ? 'bg-emerald-400 shadow-[0_0_8px_#10B981]' : 'bg-emerald-500'}`} />
            <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              بعد تحلیل جغرافیایی:
            </span>
          </div>

          <div className={`flex items-center gap-1 p-1 rounded-2xl overflow-x-auto no-scrollbar border ${
            isDark ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-slate-100 border-slate-200'
          }`} role="tablist">
            {DIM_OPTIONS.map(([k, label]) => {
              const active = !sel && by === k
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setBy(k)
                    setSel(null)
                  }}
                  className={`relative shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all select-none cursor-pointer ${
                    active
                      ? 'text-[#090C0B]'
                      : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="branchDimTab"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">{label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Search in current view */}
        <div className={`relative flex items-center rounded-xl border ${
          isDark ? 'bg-white/[0.04] border-white/[0.08]' : 'bg-slate-50 border-slate-200'
        }`}>
          <Search size={14} className="mr-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`جستجو در ${activeLabel}…`}
            className="bg-transparent px-2.5 py-1.5 text-xs outline-none w-36 sm:w-48 text-right font-medium"
          />
        </div>
      </div>

      {/* ── 2. Drill-down Breadcrumb Banner (if item is clicked) ── */}
      <AnimatePresence>
        {sel && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={`rounded-2xl p-3.5 sm:px-5 sm:py-3 flex items-center justify-between gap-3 flex-wrap border ${
              isDark
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setSel(null)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                  isDark
                    ? 'bg-[#0F1412] text-slate-200 border border-white/10 hover:bg-white/10'
                    : 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>← بازگشت به همه {DIM_OPTIONS.find(([k]) => k === sel.by)?.[1]}‌ها</span>
              </button>

              <span className="text-xs font-extrabold flex items-center gap-1">
                <span>{DIM_OPTIONS.find(([k]) => k === sel.by)?.[1]}:</span>
                <span className="underline decoration-emerald-400 decoration-2">{sel.key}</span>
              </span>

              {children && (
                <div className={`flex items-center gap-1 p-1 rounded-xl border ${
                  isDark ? 'bg-white/[0.04] border-white/10' : 'bg-white/80 border-slate-200'
                }`}>
                  {children.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setChildBy(k)}
                      className={`px-3 py-0.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        activeChild === k
                          ? 'bg-emerald-500 text-[#090C0B] font-bold shadow-xs'
                          : isDark
                          ? 'text-slate-400 hover:text-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      به تفکیک {DIM_OPTIONS.find(([x]) => x === k)?.[1]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {openProfile && sel.by === 'branch' && (
              <button
                type="button"
                onClick={() => openProfile('branch', sel.key)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#090C0B] text-xs font-black transition-all shadow-sm cursor-pointer"
              >
                <Building2 size={13} />
                <span>مشاهده پروفایل تحلیلی {sel.key}</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Status state={r}>{(rawRows) => {
        const rows = rawRows.filter((x) => x.sum_rial_vat > 0)
        const totalGross = rows.reduce((s, x) => s + (x.sum_rial_vat || 0), 0)
        const totalNet = rows.reduce((s, x) => s + (x.net_rial || 0), 0)
        const totalInvoices = rows.reduce((s, x) => s + (x.invoice_count || 0), 0)
        const totalCustomers = rows.reduce((s, x) => s + (x.active_customers || 0), 0)
        const topPerformer = rows[0] || null
        const avgGrossPerUnit = rows.length ? Math.round(totalGross / rows.length) : 0

        // Search filter
        const filteredRows = rows.filter((x) => {
          if (!searchQuery.trim()) return true
          return String(x.key).toLowerCase().includes(searchQuery.toLowerCase())
        })

        // Chart data (top 15)
        const chartData = filteredRows.slice(0, 15).map((x, idx) => ({
          rank: idx + 1,
          key: x.key,
          name: by === 'state' ? cleanDistrictLabel(x.key) : String(x.key),
          gross: Number(((x.sum_rial_vat || 0) / 1e9).toFixed(2)),
          net: Number(((x.net_rial || 0) / 1e9).toFixed(2)),
          customers: Number(x.active_customers || 0),
          sum_rial_vat: x.sum_rial_vat,
          net_rial: x.net_rial,
          active_customers: x.active_customers,
          invoice_count: x.invoice_count,
          return_percent: x.return_percent,
        }))

        // Donut Data: top 7 + others
        const donutTop = rows.slice(0, 7).map((x) => ({
          name: by === 'state' ? cleanDistrictLabel(x.key) : String(x.key),
          value: x.sum_rial_vat,
        }))
        const donutRest = rows.slice(7).reduce((s, x) => s + (x.sum_rial_vat || 0), 0)
        if (donutRest > 0) {
          donutTop.push({ name: 'سایر واحدها', value: donutRest })
        }

        return (
          <>
            {/* ── 3. Top 4-Card Executive KPI Strip ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
              {/* Card 1: Total Sales */}
              <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all border ${
                isDark
                  ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
                  : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
              }`}>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>فروش کل این بعد</span>
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
                    خالص: {billions1(totalNet)} میلیارد ریال
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold pt-2 border-t border-white/[0.06]">
                  <ArrowUpRight size={13} />
                  <span>توزیع روی {fa(rows.length)} {activeLabel}</span>
                </div>
              </div>

              {/* Card 2: Top Champion Unit */}
              <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all border ${
                isDark
                  ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
                  : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
              }`}>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>واحد پیشتاز (#1)</span>
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
                    {topPerformer ? (by === 'state' ? cleanDistrictLabel(topPerformer.key) : topPerformer.key) : '—'}
                  </div>
                  <div className={`text-xs font-bold tabular-nums font-sans mt-0.5 truncate ${
                    isDark ? 'text-slate-200' : 'text-slate-800'
                  }`}>
                    {topPerformer ? `${billions1(topPerformer.sum_rial_vat)} میلیارد ریال` : '—'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-semibold pt-2 border-t border-white/[0.06]">
                  <Sparkles size={13} />
                  <span>سهم: {topPerformer && totalGross > 0 ? pct(topPerformer.sum_rial_vat / totalGross) : '—'}</span>
                </div>
              </div>

              {/* Card 3: Total Invoices and Coverage */}
              <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all border ${
                isDark
                  ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
                  : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
              }`}>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>کل فاکتورها و خریداران</span>
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    isDark ? 'bg-cyan-500/15 text-cyan-400' : 'bg-cyan-50 text-cyan-700'
                  }`}>
                    <Users size={17} />
                  </span>
                </div>
                <div className="my-2">
                  <div className={`text-xl sm:text-2xl font-black tabular-nums font-sans tracking-tight truncate ${
                    isDark ? 'text-slate-100' : 'text-slate-900'
                  }`}>
                    {fa(totalInvoices)} <span className="text-xs font-bold text-slate-400">فاکتور</span>
                  </div>
                  <div className={`text-[11px] font-medium mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    پوشش {fa(totalCustomers)} خریدار فعال یکتا
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-cyan-400 font-semibold pt-2 border-t border-white/[0.06]">
                  <FileText size={13} />
                  <span>سرانه: {totalCustomers > 0 ? fa(Math.round(totalInvoices / totalCustomers * 10) / 10) : '—'} فاکتور/مشتری</span>
                </div>
              </div>

              {/* Card 4: Average Revenue per Unit */}
              <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all border ${
                isDark
                  ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
                  : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
              }`}>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>میانگین فروش هر واحد</span>
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
                    {billions1(avgGrossPerUnit)} <span className={`text-xs font-bold ${isDark ? 'text-teal-400' : 'text-teal-700'}`}>م. ریال</span>
                  </div>
                  <div className={`text-[11px] font-mono font-medium tabular-nums mt-0.5 truncate ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    میانگین عملکرد واحدها
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-teal-400 font-semibold pt-2 border-t border-white/[0.06]">
                  <Building2 size={13} />
                  <span>شاخص تمرکز جغرافیایی</span>
                </div>
              </div>
            </div>

            {/* ── 4. Main Territorial Performance Section (12 Cols) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch w-full">
              {/* 8 Cols: Ranked Bar Chart */}
              <div className={`lg:col-span-8 rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 flex flex-col justify-between transition-colors border ${
                isDark
                  ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
                : 'bg-white border-slate-200/90 text-slate-900 shadow-[0_4px_24px_rgba(15,23,42,0.05)]'
              }`}>
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${isDark ? 'bg-emerald-400 shadow-[0_0_10px_#10B981]' : 'bg-emerald-500'}`} />
                      <h2 className={`text-base sm:text-lg font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        رتبه‌بندی عملکرد ۱۵ واحد برتر ({activeLabel})
                      </h2>
                    </div>
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      برای مشاهده جزئیات عمیق‌تر و دریل‌داون روی میله‌ها کلیک کنید
                    </p>
                  </div>

                  <div className={`flex items-center gap-1 p-1 rounded-xl border ${
                    isDark ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-slate-100 border-slate-200'
                  }`}>
                    <button
                      type="button"
                      onClick={() => setMetricView('gross')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        metricView === 'gross'
                          ? 'bg-emerald-500 text-[#090C0B] shadow-sm'
                          : isDark
                          ? 'text-slate-400 hover:text-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      فروش ناخالص
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetricView('net')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        metricView === 'net'
                          ? 'bg-teal-500 text-[#090C0B] shadow-sm'
                          : isDark
                          ? 'text-slate-400 hover:text-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ریال خالص
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetricView('customers')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        metricView === 'customers'
                          ? 'bg-cyan-500 text-[#090C0B] shadow-sm'
                          : isDark
                          ? 'text-slate-400 hover:text-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      مشتریان فعال
                    </button>
                  </div>
                </div>

                <div className="h-72 sm:h-80 w-full mt-2" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: chartData.length > 8 ? 20 : 0 }}>
                      <defs>
                        <linearGradient id="emeraldTerritoryBar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" />
                          <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                        <linearGradient id="tealTerritoryBar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#14B8A6" />
                          <stop offset="100%" stopColor="#0D9488" />
                        </linearGradient>
                        <linearGradient id="cyanTerritoryBar" x1="0" y1="0" x2="0" y2="1">
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
                        dataKey="name"
                        reversed
                        tickFormatter={(v) => String(v).slice(0, 12)}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        angle={chartData.length > 7 ? -25 : 0}
                        textAnchor={chartData.length > 7 ? 'end' : 'middle'}
                        height={chartData.length > 7 ? 45 : 30}
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
                        content={<BranchChartTooltip isDark={isDark} />}
                        cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', radius: 8 }}
                      />
                      <Bar
                        dataKey={metricView === 'gross' ? 'gross' : metricView === 'net' ? 'net' : 'customers'}
                        name={metricView === 'gross' ? 'فروش ناخالص' : metricView === 'net' ? 'ریال خالص' : 'مشتریان فعال'}
                        fill={
                          metricView === 'gross'
                            ? 'url(#emeraldTerritoryBar)'
                            : metricView === 'net'
                            ? 'url(#tealTerritoryBar)'
                            : 'url(#cyanTerritoryBar)'
                        }
                        radius={[8, 8, 2, 2]}
                        maxBarSize={36}
                        onClick={(b) => {
                          const k = b?.payload?.key
                          if (k) {
                            if (!sel && (by === 'branch' || by === 'region')) {
                              setSel({ by, key: String(k) })
                            } else if (openProfile && by === 'branch') {
                              openProfile('branch', String(k))
                            }
                          }
                        }}
                        cursor="pointer"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className={`flex items-center justify-between pt-4 mt-3 border-t text-xs ${
                  isDark ? 'border-white/[0.06] text-slate-400' : 'border-slate-100 text-slate-500'
                }`}>
                  <span>کل فروش ۱۵ واحد برتر: {billions1(chartData.reduce((s, x) => s + (x.sum_rial_vat || 0), 0))} م. ریال</span>
                  <span className="text-emerald-400 font-bold">
                    💡 برای دریل‌داون روی میله‌ها یا ردیف‌های جدول کلیک کنید
                  </span>
                </div>
              </div>

              {/* 4 Cols: Share & Concentration Donut */}
              <div className={`lg:col-span-4 rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 flex flex-col justify-between transition-colors border ${
                isDark
                  ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
                  : 'bg-white border-slate-200/90 text-slate-900 shadow-[0_4px_24px_rgba(15,23,42,0.05)]'
              }`}>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isDark ? 'bg-cyan-400 shadow-[0_0_8px_#06B6D4]' : 'bg-cyan-500'}`} />
                      <h3 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        سهم و تمرکز فروش
                      </h3>
                    </div>
                    <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      ۷ واحد برتر + سایر
                    </span>
                  </div>

                  {/* Donut Chart */}
                  <div className="relative w-full h-44 my-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutTop}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius="64%"
                          outerRadius="88%"
                          paddingAngle={3}
                          stroke="none"
                        >
                          {donutTop.map((s, i) => (
                            <Cell key={s.name} fill={PALETTE[i % PALETTE.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v, n) => [`${fa(v)} ریال (${pct(v / totalGross)})`, n]}
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
                      <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>مجموع کل</span>
                      <span className={`text-base font-extrabold tabular-nums font-sans mt-0.5 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        {fa(Math.round(totalGross / 1e9))}
                      </span>
                      <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>میلیارد ریال</span>
                    </div>
                  </div>

                  {/* Breakdown List with Hover Scrollbar */}
                  <ul className={`space-y-2 mt-3 pt-3 border-t max-h-48 overflow-y-auto exec-hover-scrollbar w-full px-1 pl-2 ${
                    isDark ? 'border-white/[0.06]' : 'border-slate-100'
                  }`}>
                    {donutTop.map((s, i) => (
                      <li key={s.name} className="flex items-center justify-between gap-2 text-xs w-full px-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                          <span className={`text-xs font-medium truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            {s.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs font-semibold tabular-nums font-sans ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            {pct(s.value / totalGross)}
                          </span>
                          <span aria-hidden="true" className={`w-12 h-1.5 rounded-full overflow-hidden shrink-0 ${isDark ? 'bg-white/[0.06]' : 'bg-slate-200'}`}>
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${(s.value / totalGross) * 100}%`,
                                background: PALETTE[i % PALETTE.length],
                              }}
                            />
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* ── 5. Detailed Territorial Ledger Table ── */}
            <div className={`rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 overflow-hidden transition-colors border ${
              isDark
                ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
                : 'bg-white border-slate-200/90 text-slate-900 shadow-[0_4px_24px_rgba(15,23,42,0.05)]'
            }`}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h3 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    جدول تفصیلی تحلیل جغرافیایی ({activeLabel})
                  </h3>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    جزئیات فروش، ریال خالص، سهم، فاکتورها، خریداران، تخفیف و مرجوعی
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  isDark
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}>
                  {fa(filteredRows.length)} سطر اطلاعاتی
                </span>
              </div>

              <div className="w-full overflow-x-auto exec-hover-scrollbar">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className={`border-b ${isDark ? 'border-white/[0.08] text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                      <th className="py-3 px-3 font-bold">#</th>
                      <th className="py-3 px-3 font-bold">{activeLabel}</th>
                      <th className="py-3 px-3 font-bold">فروش ناخالص (ریال)</th>
                      <th className="py-3 px-3 font-bold">ریال خالص (ریال)</th>
                      <th className="py-3 px-3 font-bold">سهم از کل</th>
                      <th className="py-3 px-3 font-bold">تعداد فاکتور</th>
                      <th className="py-3 px-3 font-bold">مشتری فعال</th>
                      <th className="py-3 px-3 font-bold">درصد پروموشن</th>
                      <th className="py-3 px-3 font-bold">درصد مرجوعی</th>
                      <th className="py-3 px-3 font-bold text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filteredRows.map((x, idx) => {
                      const share = totalGross > 0 ? (x.sum_rial_vat / totalGross) : 0
                      const isBranch = by === 'branch' || sel?.by === 'branch'

                      return (
                        <tr
                          key={x.key || idx}
                          className={`transition-colors ${
                            isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3 px-3 font-sans text-slate-400">
                            {fa(idx + 1)}
                          </td>
                          <td className="py-3 px-3 font-bold">
                            <button
                              type="button"
                              onClick={() => {
                                if (!sel && (by === 'branch' || by === 'region')) {
                                  setSel({ by, key: String(x.key) })
                                } else if (openProfile && isBranch) {
                                  openProfile('branch', String(x.key))
                                }
                              }}
                              className={`text-right hover:underline cursor-pointer flex items-center gap-1.5 ${
                                isDark ? 'text-slate-100 hover:text-emerald-400' : 'text-slate-900 hover:text-emerald-700'
                              }`}
                            >
                              <MapPin size={13} className="text-emerald-400 shrink-0" />
                              <span>{by === 'state' ? cleanDistrictLabel(x.key) : x.key}</span>
                            </button>
                          </td>
                          <td className="py-3 px-3 font-sans font-bold tabular-nums text-emerald-400">
                            {fa(x.sum_rial_vat)}
                          </td>
                          <td className="py-3 px-3 font-sans font-bold tabular-nums text-teal-400">
                            {fa(x.net_rial)}
                          </td>
                          <td className="py-3 px-3 font-sans tabular-nums">
                            <div className="flex items-center gap-2">
                              <span className="w-10 text-left font-bold">{pct(share)}</span>
                              <div className={`flex-1 h-1.5 max-w-[70px] rounded-full overflow-hidden ${
                                isDark ? 'bg-white/10' : 'bg-slate-200'
                              }`}>
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${share * 100}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-sans font-bold tabular-nums text-amber-400">
                            {fa(x.invoice_count)}
                          </td>
                          <td className="py-3 px-3 font-sans font-bold tabular-nums text-cyan-400">
                            {fa(x.active_customers)}
                          </td>
                          <td className="py-3 px-3 font-sans tabular-nums text-slate-400">
                            {pct(x.promo_percent, 1)}
                          </td>
                          <td className="py-3 px-3 font-sans tabular-nums">
                            {x.return_percent > 0 ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-50 text-rose-800'
                              }`}>
                                {pct(x.return_percent, 1)}
                              </span>
                            ) : (
                              <span className="text-slate-500">۰٪</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {openProfile && (
                              <button
                                type="button"
                                onClick={() => openProfile(by === 'branch' ? 'branch' : 'brand', String(x.key))}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                  isDark
                                    ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                }`}
                              >
                                <span>پروفایل</span>
                                <ChevronLeft size={11} />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      }}</Status>
    </div>
  )
}

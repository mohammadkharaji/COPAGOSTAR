import { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target,
  TrendingUp,
  TrendingDown,
  Calendar,
  CheckCircle2,
  Award,
  CircleDollarSign,
  Filter,
  Layers,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  Search,
  RotateCcw,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react'
import { useApi } from './api'
import { useAppearance } from './AppearanceContext'
import { billions1, dayLabel, fa, monthLabel } from './format'
import { pct, rial } from './ui'

const BY = [
  ['branch', 'شعبه'],
  ['manager', 'مدیر'],
  ['supervisor', 'سرپرست'],
  ['visitor', 'ویزیتور'],
  ['line', 'لاین'],
  ['group', 'گروه کالا'],
  ['category', 'دسته کالا'],
]

const FILTERS = [
  ['branch', 'شعبه'],
  ['line', 'لاین'],
  ['manager', 'مدیر'],
  ['supervisor', 'سرپرست'],
  ['group', 'گروه کالا'],
  ['category', 'دسته کالا'],
  ['visitor', 'ویزیتور'],
]

const STATUS = {
  ahead: ['در مسیر یا جلوتر', 'ahead'],
  near: ['کمی عقب‌تر', 'near'],
  behind: ['عقب‌تر از مسیر', 'behind'],
}

const bn = (v) => (v == null ? '—' : billions1(v))
const optLabel = (o) => (typeof o === 'string' ? o : o.label)
const optValue = (o) => (typeof o === 'string' ? o : o.value)

/**
 * Custom Glassmorphic Dark/Light Chart Tooltip
 */
function TrajectoryTooltip({ active, payload, label, isDark }) {
  if (!active || !payload?.length) return null

  const row = payload[0]?.payload
  if (!row) return null

  const actual = row.actual != null ? row.actual : null
  const expected = row.expected != null ? row.expected : null
  const delta = (actual != null && expected != null) ? (actual - expected) : null

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
            <span>تحقق تجمعی:</span>
          </span>
          <b className={`font-sans font-bold tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
            {actual != null ? `${fa(actual)} میلیارد ریال` : '—'}
          </b>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
            <span>مسیر مورد انتظار:</span>
          </span>
          <b className={`font-sans font-bold tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            {expected != null ? `${fa(expected)} میلیارد ریال` : '—'}
          </b>
        </div>

        {delta != null && (
          <div className={`flex items-center justify-between gap-3 pt-1.5 border-t text-[11px] ${
            isDark ? 'border-white/[0.06]' : 'border-slate-100'
          }`}>
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>اختلاف تجمعی:</span>
            <span className={`font-sans font-bold tabular-nums ${
              delta >= 0
                ? isDark ? 'text-emerald-400' : 'text-emerald-700'
                : isDark ? 'text-rose-400' : 'text-rose-700'
            }`}>
              {delta >= 0 ? '+' : ''}{fa(Number(delta.toFixed(2)))} میلیارد ریال
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Status Badge Component with Neon Glow
 */
function StatusBadge({ status, isDark }) {
  if (!status) return <span className="text-xs text-slate-500">—</span>

  const isAhead = status === 'ahead'
  const isNear = status === 'near'
  const [text] = STATUS[status] ?? ['—', '']

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
      isAhead
        ? isDark
          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
          : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
        : isNear
        ? isDark
          ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
          : 'bg-amber-50 border border-amber-200 text-amber-800'
        : isDark
        ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
        : 'bg-rose-50 border border-rose-200 text-rose-800'
    }`}>
      {text}
    </span>
  )
}

/**
 * Target Progress Mini-Bar with Expected Pace Marker
 */
function TargetProgressBar({ value, expected, isDark }) {
  const w = Math.min((value ?? 0) / 1.2, 1) * 100
  const expW = Math.min((expected ?? 0) / 1.2, 1) * 100

  const isAhead = (value ?? 0) >= (expected ?? 0)
  const isNear = (value ?? 0) >= (expected ?? 0) * 0.9

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-bold tabular-nums font-sans min-w-[42px] ${
        isAhead
          ? isDark ? 'text-emerald-400' : 'text-emerald-700'
          : isNear
          ? isDark ? 'text-amber-400' : 'text-amber-700'
          : isDark ? 'text-rose-400' : 'text-rose-700'
      }`}>
        {pct(value)}
      </span>
      <div
        className={`relative w-24 h-2 rounded-full overflow-hidden shrink-0 ${
          isDark ? 'bg-white/10' : 'bg-slate-200'
        }`}
        title={`تحقق: ${pct(value)} · انتظار: ${pct(expected)}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isAhead
              ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_#10B981]'
              : isNear
              ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
              : 'bg-gradient-to-r from-rose-500 to-red-400'
          }`}
          style={{ width: `${w}%` }}
        />
        {/* Expected vertical marker */}
        <div
          className={`absolute top-0 bottom-0 w-0.5 z-10 ${
            isDark ? 'bg-white shadow-[0_0_4px_#FFF]' : 'bg-slate-900'
          }`}
          style={{ right: `${expW}%` }}
        />
      </div>
    </div>
  )
}

/**
 * ─────────────────────────────────────────────────────────────
 * TargetPage (تحقق تارگت و بودجه) - Executive Dark Bento Redesign
 * ─────────────────────────────────────────────────────────────
 */
export default function TargetPage({ core, onUnavailable }) {
  const { isDark } = useAppearance()
  const [month, setMonth] = useState('')
  const [by, setBy] = useState('branch')
  const [sel, setSel] = useState({})
  const [statusFilter, setStatusFilter] = useState(null) // null | 'ahead' | 'near' | 'behind'
  const [searchQuery, setSearchQuery] = useState('')

  const params = { core, by, ...(month && { month }), ...sel }
  const r = useApi('/target', params)

  const setFilter = (k, v) =>
    setSel((s) => {
      const n = { ...s }
      if (v) n[k] = v
      else delete n[k]
      return n
    })

  if (r.error) {
    return (
      <div className={`p-6 rounded-2xl border text-xs font-bold text-center ${
        isDark ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-800'
      }`} role="alert">
        دریافت داده‌های تارگت با خطا مواجه شد. لطفاً دوباره تلاش فرمایید.
      </div>
    )
  }

  if (r.loading && !r.data) {
    return (
      <div className="flex items-center justify-center p-16 text-xs text-slate-400 gap-2">
        <Sparkles size={16} className="animate-spin text-emerald-400" />
        <span>در حال بارگذاری اطلاعات تارگت و تحلیل تحقق…</span>
      </div>
    )
  }

  if (!r.data) return null

  const d = r.data
  if (!d.available) {
    return (
      <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6">
        <div className={`rounded-[28px] p-8 text-center space-y-3 border ${
          isDark
            ? 'bg-[#0F1412] border-white/[0.06] text-slate-400 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
            : 'bg-white border-slate-200 text-slate-600 shadow-sm'
        }`}>
          <AlertTriangle className="mx-auto text-amber-500" size={36} />
          <h3 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            داده تارگت برای این دوره در دسترس نیست
          </h3>
          <p className="text-sm max-w-md mx-auto">{d.reason}</p>
        </div>
      </div>
    )
  }

  const s = d.summary
  const exp = d.expected_pct
  const counts = d.status_counts ?? {}
  const q = d.quality ?? {}

  // Filter rows based on search and status filter
  const filteredRows = (d.rows ?? []).filter((row) => {
    if (statusFilter && row.status !== statusFilter) return false
    if (searchQuery.trim() && !row.label?.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const lineChartData = (d.daily ?? []).map((x) => ({
    ...x,
    actual: x.actual_cum_rial == null ? null : Number((x.actual_cum_rial / 1e9).toFixed(2)),
    expected: Number((x.expected_cum_rial / 1e9).toFixed(2)),
  }))

  const isTargetAhead = s.status === 'ahead'
  const isTargetNear = s.status === 'near'

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5 sm:space-y-6">
      {/* ── 1. Floating Filter Strip ── */}
      <div className={`rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 flex flex-col gap-3 transition-colors border ${
        isDark
          ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
          : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
      }`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Month & Dimension Selectors */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                ماه تارگت:
              </span>
              <select
                value={d.month}
                onChange={(e) => {
                  setMonth(e.target.value)
                  setSel({})
                }}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold outline-none border transition-all cursor-pointer ${
                  isDark
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                }`}
              >
                {d.months.map((m) => (
                  <option key={m.month} value={m.month} className={isDark ? 'bg-[#0F1412] text-slate-100' : 'bg-white text-slate-900'}>
                    {monthLabel(m.month)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                تفکیک گزارش:
              </span>
              <select
                value={by}
                onChange={(e) => setBy(e.target.value)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold outline-none border transition-all cursor-pointer ${
                  isDark
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                }`}
              >
                {BY.map(([k, label]) => (
                  <option key={k} value={k} className={isDark ? 'bg-[#0F1412] text-slate-100' : 'bg-white text-slate-900'}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Dimension Secondary Selects */}
        <div className={`pt-2.5 border-t grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 w-full items-center ${
          isDark ? 'border-white/[0.06]' : 'border-slate-100'
        }`}>
          {FILTERS.map(([k, label]) => {
            const val = d.filters[k]?.[0] ?? ''
            const hasVal = Boolean(val)
            return (
              <select
                key={k}
                value={val}
                onChange={(e) => setFilter(k, e.target.value)}
                className={`w-full truncate rounded-xl px-2.5 py-1.5 text-xs transition-all outline-none border cursor-pointer ${
                  hasVal
                    ? isDark
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                    : isDark
                    ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:border-white/20'
                    : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300'
                }`}
              >
                <option value="" className={isDark ? 'bg-[#0F1412] text-slate-200' : 'bg-white text-slate-800'}>
                  همه {label}‌ها
                </option>
                {d.options[k].map((o) => (
                  <option
                    key={optValue(o)}
                    value={optValue(o)}
                    className={isDark ? 'bg-[#0F1412] text-slate-200' : 'bg-white text-slate-800'}
                  >
                    {optLabel(o)}
                  </option>
                ))}
              </select>
            )
          })}

          {Object.keys(sel).length > 0 && (
            <button
              type="button"
              onClick={() => setSel({})}
              className="text-xs font-bold text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>پاک‌سازی</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 2. Top 5-Card Unified Executive KPI Strip (Strictly Single Row) ── */}
      <div className="grid grid-cols-5 gap-2 sm:gap-2.5 w-full">
        {/* Card 1: Target Month */}
        <div className={`rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between transition-all border ${
          isDark
            ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.25)]'
            : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
        }`}>
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>هدف کل ماه</span>
            <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
              isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
            }`}>
              <Target size={13} />
            </span>
          </div>
          <div className="my-1">
            <div className={`text-base sm:text-lg font-black tabular-nums font-sans tracking-tight truncate ${
              isDark ? 'text-slate-100' : 'text-slate-900'
            }`}>
              {bn(s.target_rial)} <span className={`text-[10px] font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>م. ریال</span>
            </div>
            <div className={`text-[10px] font-mono tabular-nums truncate ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              {fa(s.target_rial)} ریال
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium pt-1.5 border-t border-white/[0.06] truncate">
            <CheckCircle2 size={11} className="shrink-0" />
            <span className="truncate">بودجه مصوب دوره</span>
          </div>
        </div>

        {/* Card 2: Actual Realized */}
        <div className={`rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between transition-all border ${
          isDark
            ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.25)]'
            : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
        }`}>
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>تحقق تا امروز</span>
            <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
              isDark ? 'bg-teal-500/15 text-teal-400' : 'bg-teal-50 text-teal-700'
            }`}>
              <TrendingUp size={13} />
            </span>
          </div>
          <div className="my-1">
            <div className={`text-base sm:text-lg font-black tabular-nums font-sans tracking-tight truncate ${
              isDark ? 'text-slate-100' : 'text-slate-900'
            }`}>
              {bn(s.actual_rial)} <span className={`text-[10px] font-bold ${isDark ? 'text-teal-400' : 'text-teal-700'}`}>م. ریال</span>
            </div>
            <div className={`text-[10px] font-medium truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {d.as_of ? `تا ${dayLabel(d.as_of)}` : 'در جریان'}
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-teal-400 font-medium pt-1.5 border-t border-white/[0.06] truncate">
            <Sparkles size={11} className="shrink-0" />
            <span className="truncate">فروش واقعی ثبت‌شده</span>
          </div>
        </div>

        {/* Card 3: Achieved vs. Expected Pace */}
        <div className={`rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between transition-all border ${
          isDark
            ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.25)]'
            : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
        }`}>
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>درصد تحقق هدف</span>
            <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
              isTargetAhead
                ? isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                : isTargetNear
                ? isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700'
                : isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-50 text-rose-700'
            }`}>
              {isTargetAhead ? <ArrowUpRight size={13} /> : <Clock size={13} />}
            </span>
          </div>
          <div className="my-1">
            <div className={`text-base sm:text-lg font-black tabular-nums font-sans tracking-tight ${
              isTargetAhead
                ? isDark ? 'text-emerald-400' : 'text-emerald-700'
                : isTargetNear
                ? isDark ? 'text-amber-400' : 'text-amber-700'
                : isDark ? 'text-rose-400' : 'text-rose-700'
            }`}>
              {pct(s.achieved_pct)}
            </div>
            <div className={`text-[10px] font-medium truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              انتظار: <b>{pct(exp)}</b> ({fa(d.elapsed_working_days)}/{fa(d.working_days)} روز)
            </div>
          </div>
          <div className={`flex items-center gap-1 text-[10px] font-medium pt-1.5 border-t border-white/[0.06] truncate ${
            isTargetAhead ? 'text-emerald-400' : isTargetNear ? 'text-amber-400' : 'text-rose-400'
          }`}>
            <span className="truncate">{isTargetAhead ? 'جلوتر از خط هدف' : isTargetNear ? 'نزدیک خط هدف' : 'عقب‌تر از خط هدف'}</span>
          </div>
        </div>

        {/* Card 4: Required Run-Rate */}
        <div className={`rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between transition-all border ${
          isDark
            ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.25)]'
            : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
        }`}>
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>لازم در هر روز کاری</span>
            <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
              isDark ? 'bg-cyan-500/15 text-cyan-400' : 'bg-cyan-50 text-cyan-700'
            }`}>
              <Calendar size={13} />
            </span>
          </div>
          <div className="my-1">
            <div className={`text-base sm:text-lg font-black tabular-nums font-sans tracking-tight truncate ${
              isDark ? 'text-slate-100' : 'text-slate-900'
            }`}>
              {bn(s.needed_per_day_rial)} <span className={`text-[10px] font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>م. ریال</span>
            </div>
            <div className={`text-[10px] font-medium truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {fa(d.remaining_working_days)} روز کاری مانده
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-cyan-400 font-medium pt-1.5 border-t border-white/[0.06] truncate">
            <Clock size={11} className="shrink-0" />
            <span className="truncate">نرخ وصول روزانه</span>
          </div>
        </div>

        {/* Card 5: Month-End Projection */}
        <div className={`rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between transition-all border ${
          isDark
            ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.25)]'
            : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
        }`}>
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>پیش‌بینی پایان ماه</span>
            <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
              isDark ? 'bg-purple-500/15 text-purple-400' : 'bg-purple-50 text-purple-700'
            }`}>
              <Award size={13} />
            </span>
          </div>
          <div className="my-1">
            <div className={`text-base sm:text-lg font-black tabular-nums font-sans tracking-tight ${
              isDark ? 'text-purple-400' : 'text-purple-700'
            }`}>
              {pct(s.projected_pct)}
            </div>
            <div className={`text-[10px] font-bold tabular-nums font-sans truncate ${
              isDark ? 'text-slate-200' : 'text-slate-800'
            }`}>
              تخمین: {bn(s.projected_rial)} م. ریال
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-purple-400 font-medium pt-1.5 border-t border-white/[0.06] truncate">
            <Sparkles size={11} className="shrink-0" />
            <span className="truncate">برآورد روند ماه</span>
          </div>
        </div>
      </div>

      {/* ── 3. Middle Grid: Trajectory Glow Chart (8 Cols) + Status Distribution (4 Cols) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch w-full">
        {/* Left/Main Chart: Cumulative Trajectory Line Chart */}
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
                  مسیر تجمعی تحقق در برابر خط انتظار
                </h2>
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                فروش تجمعی واقعی در برابر مسیر خطی مورد انتظار بر پایه روزهای کاری ماه (میلیارد ریال)
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>تحقق تجمعی</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-3 h-0.5 bg-slate-400" />
                <span>مسیر مورد انتظار</span>
              </span>
            </div>
          </div>

          <div className="h-72 sm:h-80 w-full mt-2" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
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
                  content={<TrajectoryTooltip isDark={isDark} />}
                  cursor={{ stroke: isDark ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.2)', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="expected"
                  name="مسیر مورد انتظار"
                  stroke={isDark ? '#64748B' : '#94A3B8'}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="تحقق تجمعی"
                  stroke="#10B981"
                  strokeWidth={3}
                  dot={false}
                  connectNulls={false}
                  activeDot={{
                    r: 6,
                    fill: '#10B981',
                    stroke: isDark ? '#0F1412' : '#FFFFFF',
                    strokeWidth: 3,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right/Distribution Card: Status Breakdown */}
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
                  وضعیت واحدهای تحت پوشش
                </h3>
              </div>
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                بر اساس {BY.find(([k]) => k === by)?.[1]}
              </span>
            </div>

            <div className="space-y-3">
              {/* Ahead Capsule */}
              <button
                type="button"
                onClick={() => setStatusFilter((cur) => (cur === 'ahead' ? null : 'ahead'))}
                className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all cursor-pointer text-right border ${
                  statusFilter === 'ahead'
                    ? isDark
                      ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_16px_rgba(16,185,129,0.2)]'
                      : 'bg-emerald-100 border-emerald-400 shadow-sm'
                    : isDark
                    ? 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15'
                    : 'bg-emerald-50/80 border-emerald-200 hover:bg-emerald-100/60'
                }`}
              >
                <div>
                  <span className={`text-xs font-bold block ${isDark ? 'text-emerald-300' : 'text-emerald-900'}`}>
                    در مسیر یا جلوتر
                  </span>
                  <span className={`text-[11px] ${isDark ? 'text-emerald-400/80' : 'text-emerald-700'}`}>
                    تحقق بیش از ۱۰۰٪ برنامه
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <b className={`text-2xl font-black font-sans tabular-nums ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>
                    {fa(counts.ahead ?? 0)}
                  </b>
                  <span className={`text-xs ${isDark ? 'text-emerald-400/70' : 'text-emerald-700'}`}>واحد</span>
                </div>
              </button>

              {/* Near Capsule */}
              <button
                type="button"
                onClick={() => setStatusFilter((cur) => (cur === 'near' ? null : 'near'))}
                className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all cursor-pointer text-right border ${
                  statusFilter === 'near'
                    ? isDark
                      ? 'bg-amber-500/20 border-amber-500/50 shadow-[0_0_16px_rgba(245,158,11,0.2)]'
                      : 'bg-amber-100 border-amber-400 shadow-sm'
                    : isDark
                    ? 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15'
                    : 'bg-amber-50/80 border-amber-200 hover:bg-amber-100/60'
                }`}
              >
                <div>
                  <span className={`text-xs font-bold block ${isDark ? 'text-amber-300' : 'text-amber-900'}`}>
                    کمی عقب‌تر
                  </span>
                  <span className={`text-[11px] ${isDark ? 'text-amber-400/80' : 'text-amber-700'}`}>
                    تحقق بین ۹۰٪ تا ۱۰۰٪
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <b className={`text-2xl font-black font-sans tabular-nums ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                    {fa(counts.near ?? 0)}
                  </b>
                  <span className={`text-xs ${isDark ? 'text-amber-400/70' : 'text-amber-700'}`}>واحد</span>
                </div>
              </button>

              {/* Behind Capsule */}
              <button
                type="button"
                onClick={() => setStatusFilter((cur) => (cur === 'behind' ? null : 'behind'))}
                className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all cursor-pointer text-right border ${
                  statusFilter === 'behind'
                    ? isDark
                      ? 'bg-rose-500/20 border-rose-500/50 shadow-[0_0_16px_rgba(244,63,94,0.2)]'
                      : 'bg-rose-100 border-rose-400 shadow-sm'
                    : isDark
                    ? 'bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/15'
                    : 'bg-rose-50/80 border-rose-200 hover:bg-rose-100/60'
                }`}
              >
                <div>
                  <span className={`text-xs font-bold block ${isDark ? 'text-rose-300' : 'text-rose-900'}`}>
                    عقب‌تر از مسیر
                  </span>
                  <span className={`text-[11px] ${isDark ? 'text-rose-400/80' : 'text-rose-700'}`}>
                    تحقق کمتر از ۹۰٪ برنامه
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <b className={`text-2xl font-black font-sans tabular-nums ${isDark ? 'text-rose-300' : 'text-rose-800'}`}>
                    {fa(counts.behind ?? 0)}
                  </b>
                  <span className={`text-xs ${isDark ? 'text-rose-400/70' : 'text-rose-700'}`}>واحد</span>
                </div>
              </button>
            </div>
          </div>

          {statusFilter && (
            <div className="pt-3 mt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
              <span className="text-slate-400">فیلتر جدول فعال است</span>
              <button
                type="button"
                onClick={() => setStatusFilter(null)}
                className="text-xs font-bold text-rose-400 hover:text-rose-300 cursor-pointer"
              >
                نمایش همه واحدها
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Main Target Ledger Table ── */}
      <div className={`rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 overflow-hidden transition-colors border ${
        isDark
          ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
          : 'bg-white border-slate-200/90 text-slate-900 shadow-[0_4px_24px_rgba(15,23,42,0.05)]'
      }`}>
        {/* Table Header & Search */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              جدول تحقق تارگت به تفکیک {BY.find(([k]) => k === by)?.[1]}
            </h3>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              خط عمودی سفید داخل نوار پیشرفت، سهم مورد انتظار تا امروز را نشان می‌دهد
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className={`relative flex items-center rounded-xl border ${
              isDark ? 'bg-white/[0.04] border-white/[0.08]' : 'bg-slate-50 border-slate-200'
            }`}>
              <Search size={14} className="mr-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`جستجو در ${BY.find(([k]) => k === by)?.[1]}‌ها…`}
                className="bg-transparent px-2.5 py-1.5 text-xs outline-none w-36 sm:w-48 text-right font-medium"
              />
            </div>

            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
              isDark
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              {fa(filteredRows.length)} مورد
            </span>
          </div>
        </div>

        {/* Table Content */}
        <div className="w-full overflow-x-auto exec-hover-scrollbar">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className={`border-b ${isDark ? 'border-white/[0.08] text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                <th className="py-3 px-3 font-bold">{BY.find(([k]) => k === by)?.[1]}</th>
                <th className="py-3 px-3 font-bold">هدف ماه (م. ریال)</th>
                <th className="py-3 px-3 font-bold">تحقق تا امروز (م. ریال)</th>
                <th className="py-3 px-3 font-bold">درصد تحقق</th>
                <th className="py-3 px-3 font-bold">اختلاف تا امروز</th>
                <th className="py-3 px-3 font-bold">لازم در هر روز باقی‌مانده</th>
                <th className="py-3 px-3 font-bold">پیش‌بینی پایان ماه</th>
                <th className="py-3 px-3 font-bold">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredRows.map((x, idx) => {
                const gap = x.gap_rial
                const isPositiveGap = gap >= 0

                return (
                  <tr
                    key={x.label || idx}
                    className={`transition-colors ${
                      isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-3 font-bold">
                      {x.label}
                    </td>
                    <td className="py-3 px-3 font-sans font-medium tabular-nums text-slate-300">
                      {bn(x.target_rial)}
                    </td>
                    <td className="py-3 px-3 font-sans font-bold tabular-nums text-emerald-400">
                      {bn(x.actual_rial)}
                    </td>
                    <td className="py-3 px-3 font-sans tabular-nums">
                      <TargetProgressBar value={x.achieved_pct} expected={exp} isDark={isDark} />
                    </td>
                    <td className="py-3 px-3 font-sans tabular-nums" dir="ltr">
                      {x.synthetic && !x.target_rial ? (
                        <span className="text-slate-500">—</span>
                      ) : (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          isPositiveGap
                            ? isDark
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-emerald-50 text-emerald-800'
                            : isDark
                            ? 'bg-rose-500/15 text-rose-400'
                            : 'bg-rose-50 text-rose-800'
                        }`}>
                          {isPositiveGap ? '+' : ''}{bn(gap)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-sans font-medium tabular-nums text-slate-400">
                      {bn(x.needed_per_day_rial)}
                    </td>
                    <td className="py-3 px-3 font-sans font-bold tabular-nums">
                      <span className={x.projected_pct >= 1 ? 'text-emerald-400' : 'text-slate-300'}>
                        {pct(x.projected_pct)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={x.status} isDark={isDark} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 5. Data Governance & Quality Control ── */}
      <div className={`rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 transition-colors border ${
        isDark
          ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
          : 'bg-white border-slate-200/90 text-slate-900 shadow-[0_4px_24px_rgba(15,23,42,0.05)]'
      }`}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-teal-400" />
            <div>
              <h3 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                کنترل کیفیت و حاکمیت داده تارگت
              </h3>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {d.method || 'روش تطبیق هوشمند کدهای پرسنلی و دسته‌بندی‌های مصوب فایل بودجه'}
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            isDark ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-teal-50 text-teal-800'
          }`}>
            سلامت فایل داده
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className={`p-4 rounded-2xl border ${
            isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50 border-slate-200'
          }`}>
            <span className={`text-xs block mb-1 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              ویزیتورهای فایل تارگت
            </span>
            <b className={`text-base font-bold block ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              {fa(q.visitors_in_target)} نفر
            </b>
            <span className={`text-[11px] mt-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              بدون کد سیستمی: {fa(q.visitors_without_code)} نفر ({billions1(q.target_rial_without_code)} م. ریال)
            </span>
          </div>

          <div className={`p-4 rounded-2xl border ${
            isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50 border-slate-200'
          }`}>
            <span className={`text-xs block mb-1 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              فروش خارج از دسته‌های تارگتی
            </span>
            <b className={`text-base font-bold block ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              {billions1(q.sales_outside_target_categories_rial)} میلیارد ریال
            </b>
            <span className={`text-[11px] mt-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              در ردیف «سایر» به طور شفاف تفکیک و لحاظ می‌گردد
            </span>
          </div>

          <div className={`p-4 rounded-2xl border ${
            isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-slate-50 border-slate-200'
          }`}>
            <span className={`text-xs block mb-1 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              دسته‌های کالایی تحت بودجه
            </span>
            <b className={`text-base font-bold block ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              {fa(q.target_categories)} دسته کالا
            </b>
            <span className={`text-[11px] mt-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              مطابق با ساختار استاندارد فایل مرجع
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Filter,
  Calendar,
  ChevronDown,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  FileText,
  Receipt,
  PackageCheck,
  CreditCard,
  ArrowLeft,
  AlertCircle,
  Building,
  Building2,
  Users,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  Layers,
  ShoppingBag,
  ExternalLink,
  Check,
  UserCheck,
  PackageSearch,
  ListOrdered,
  Target,
  Undo2,
  PackageX,
  MapPin,
  Percent,
  BarChart3,
  Activity,
  RotateCcw,
  X,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { useApi } from '../api'
import { fa, fa2, faDigits, billions, billions1, monthLabel, monthName, dayLabel } from '../format'
import { useAppearance } from '../AppearanceContext'
import { motion, AnimatePresence } from 'motion/react'
import { Table } from '../ui'

const pct = (v) => (v == null ? '—' : `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(v * 100)}٪`)
const PIE_COLORS = ['#10B981', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#14B8A6', '#6366F1', '#64748B']
const PIE_BY = [['branch', 'شعبه'], ['region', 'منطقه'], ['brand', 'برند'], ['main_group', 'گروه کالا'], ['grade', 'گرید مشتری']]

/**
 * ─────────────────────────────────────────────────────────────
 * 1. Top Header with Branch Filter & Month/Timeframe Controls
 * ─────────────────────────────────────────────────────────────
 */
const ADVANCED_FILTER_KEYS = [
  { key: 'brand', label: 'برند' },
  { key: 'main_group', label: 'گروه کالای اصلی' },
  { key: 'product', label: 'کالا' },
  { key: 'region', label: 'شهر' },
  { key: 'state', label: 'منطقه شهرداری' },
  { key: 'group', label: 'لاین فروشگاهی' },
  { key: 'grade', label: 'گرید مشتری' },
  { key: 'sales_type', label: 'کانال فروش' },
]

const cleanDistrictLabel = (label) => (typeof label === 'string' ? label.replace(/\s*[-_]\s*[\d۰-۹]+$/, '').trim() : label)

export function OverviewHeader({
  title = 'نمای کلی فروش',
  subtitle,
  branch,
  branches = [],
  onBranchChange,
  month,
  setMonth,
  months = [],
  dims = {},
  filters = {},
  onFilterChange,
  onReset,
}) {
  const { isDark } = useAppearance()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const dropdownRef = useRef(null)
  const filterPopoverRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activeFilterCount = useMemo(() => {
    return ADVANCED_FILTER_KEYS.filter(({ key }) => Boolean(dims[key])).length
  }, [dims])

  return (
    <header className={`flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-3 border-b mb-5 transition-colors ${
      isDark ? 'border-white/[0.06]' : 'border-slate-200'
    }`}>
      {/* Right side: Page title + contextual subtitle */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_#10B981] animate-pulse" />
          <h1 className={`text-2xl sm:text-3xl font-black tracking-tight font-sans transition-colors ${
            isDark ? 'text-slate-100' : 'text-slate-900'
          }`}>
            {title}
          </h1>
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-sm transition-colors ${
            isDark
              ? 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
              : 'text-emerald-800 bg-emerald-50 border-emerald-300 shadow-xs'
          }`}>
            زنده · سال ۱۴۰۵
          </span>
        </div>
        <p className={`text-xs sm:text-sm leading-relaxed max-w-2xl transition-colors ${
          isDark ? 'text-slate-400' : 'text-slate-600'
        }`}>
          {subtitle}
        </p>
      </div>

      {/* Left side: Branch filter + Month switcher + Floating Advanced Filter Popover */}
      <div className="flex items-center flex-wrap gap-2.5 sm:gap-3">
        {/* Branch / Supervisor Filter Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className={`flex items-center gap-2 text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl transition-all shadow-xs border cursor-pointer select-none outline-none ${
              isDark
                ? 'bg-[#0F1412] hover:bg-[#151D1A] border-white/[0.08] hover:border-emerald-500/40 text-slate-200'
                : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-800 shadow-sm'
            }`}
            aria-expanded={dropdownOpen}
          >
            <Building size={14} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
            <span>{branch || 'همه شعب و مناطق'}</span>
            <ChevronDown size={14} className={`transition-transform duration-200 ${isDark ? 'text-slate-400' : 'text-slate-500'} ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className={`absolute left-0 top-full mt-1.5 z-50 w-56 max-h-60 overflow-y-auto exec-hover-scrollbar rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl space-y-0.5 text-right border ${
                  isDark
                    ? 'bg-[#0F1412] border-white/10 text-slate-200 shadow-[0_16px_40px_rgba(0,0,0,0.7)]'
                    : 'bg-white border-slate-200 text-slate-800 shadow-xl'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onBranchChange?.('')
                    setDropdownOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-colors cursor-pointer ${
                    !branch
                      ? (isDark ? 'bg-emerald-500/15 text-emerald-400 font-bold' : 'bg-emerald-50 text-emerald-800 font-bold')
                      : (isDark ? 'text-slate-300 hover:bg-white/[0.05]' : 'text-slate-700 hover:bg-slate-100')
                  }`}
                >
                  <span>همه شعب</span>
                  {!branch && <Check size={13} className={isDark ? 'text-emerald-400' : 'text-emerald-700'} />}
                </button>
                {branches.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => {
                      onBranchChange?.(b)
                      setDropdownOpen(false)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-colors cursor-pointer ${
                      branch === b
                        ? (isDark ? 'bg-emerald-500/15 text-emerald-400 font-bold' : 'bg-emerald-50 text-emerald-800 font-bold')
                        : (isDark ? 'text-slate-300 hover:bg-white/[0.05]' : 'text-slate-700 hover:bg-slate-100')
                    }`}
                  >
                    <span className="truncate">{b}</span>
                    {branch === b && <Check size={13} className={isDark ? 'text-emerald-400' : 'text-emerald-700'} />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Month Selector Filter */}
        {months.length > 0 && (
          <div className="relative">
            <select
              value={month || ''}
              onChange={(e) => setMonth?.(e.target.value)}
              className={`text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl transition-all shadow-xs cursor-pointer outline-none border ${
                isDark
                  ? 'bg-[#0F1412] border-white/[0.08] hover:border-emerald-500/40 text-slate-200'
                  : 'bg-white border-slate-200/90 hover:border-emerald-500 text-slate-800 shadow-sm'
              }`}
            >
              <option value="" className={isDark ? 'bg-[#0F1412] text-slate-200' : 'bg-white text-slate-800'}>
                همه ماه‌ها
              </option>
              {months.map((m) => (
                <option key={m} value={m} className={isDark ? 'bg-[#0F1412] text-slate-200' : 'bg-white text-slate-800'}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ── Advanced Floating Filter Popover Button ── */}
        <div className="relative" ref={filterPopoverRef}>
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className={`flex items-center gap-2 text-xs sm:text-sm font-bold px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer select-none border outline-none ${
              activeFilterCount > 0
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#090C0B] font-extrabold shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_28px_rgba(16,185,129,0.45)]'
                : isDark
                ? 'bg-[#0F1412] hover:bg-[#151D1A] border-white/[0.08] hover:border-emerald-500/40 text-slate-200'
                : 'bg-white hover:bg-slate-50 border-slate-200/90 hover:border-emerald-500 text-slate-800 shadow-sm'
            }`}
            aria-expanded={filterOpen}
          >
            <SlidersHorizontal
              size={14}
              className={activeFilterCount > 0 ? 'text-[#090C0B]' : isDark ? 'text-emerald-400' : 'text-emerald-600'}
            />
            <span>فیلتر پیشرفته</span>
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#090C0B] text-emerald-400 text-[10px] font-black flex items-center justify-center shrink-0">
                {fa(activeFilterCount)}
              </span>
            )}
            <ChevronDown size={14} className={`transition-transform duration-200 ${filterOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Floating Dropdown Menu (منوی شناور فیلترها) */}
          <AnimatePresence>
            {filterOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className={`absolute left-0 top-full mt-2 z-50 w-[340px] sm:w-[560px] md:w-[680px] max-h-[85vh] overflow-y-auto exec-hover-scrollbar rounded-3xl p-5 backdrop-blur-2xl border text-right ${
                  isDark
                    ? 'bg-[#0F1412]/95 border-white/[0.1] text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.8)]'
                    : 'bg-white/95 border-slate-200/90 text-slate-900 shadow-[0_20px_50px_rgba(15,23,42,0.15)]'
                }`}
              >
                {/* Floating Menu Header */}
                <div className={`flex items-center justify-between pb-3.5 mb-4 border-b ${
                  isDark ? 'border-white/[0.08]' : 'border-slate-100'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      <SlidersHorizontal size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`text-sm font-extrabold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          فیلترهای تحلیلی پیشرفته
                        </h3>
                        {activeFilterCount > 0 && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isDark
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}>
                            {fa(activeFilterCount)} فیلتر فعال
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        روی همهٔ نمودارها، کارت‌ها و داده‌های داشبورد اعمال می‌شود
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFilterOpen(false)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                      isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    aria-label="بستن"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Filter Inputs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {ADVANCED_FILTER_KEYS.map(({ key, label }) => {
                    const rawOptions = filters[key] ?? []
                    const options = key === 'state'
                      ? (rawOptions.some((c) => typeof c === 'string' && c.includes('منطقه'))
                          ? rawOptions.filter((c) => typeof c === 'string' && !c.includes('استان'))
                          : (filters.region ?? []).filter((c) => typeof c === 'string' && c.includes('منطقه')))
                      : rawOptions

                    const value = dims[key] ?? ''
                    const hasValue = Boolean(value)

                    return (
                      <div key={key} className="space-y-1">
                        <label className={`text-[11px] font-bold block ${
                          hasValue
                            ? (isDark ? 'text-emerald-400' : 'text-emerald-700')
                            : (isDark ? 'text-slate-400' : 'text-slate-600')
                        }`}>
                          {label}
                        </label>
                        <div className="relative">
                          <select
                            value={value}
                            onChange={(e) => onFilterChange?.(key, e.target.value)}
                            className={`w-full text-xs font-semibold px-2.5 py-2 rounded-xl transition-all cursor-pointer outline-none appearance-none border ${
                              hasValue
                                ? (isDark
                                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-bold'
                                    : 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold')
                                : (isDark
                                    ? 'bg-[#090C0B] border-white/[0.08] hover:border-white/20 text-slate-200'
                                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-800')
                            }`}
                          >
                            <option value="" className={isDark ? 'bg-[#0F1412] text-slate-200' : 'bg-white text-slate-800'}>
                              همه
                            </option>
                            {options.map((opt) => (
                              <option key={opt} value={opt} className={isDark ? 'bg-[#0F1412] text-slate-200' : 'bg-white text-slate-800'}>
                                {key === 'state' ? cleanDistrictLabel(opt) : opt}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={13}
                            className={`absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                              hasValue
                                ? (isDark ? 'text-emerald-400' : 'text-emerald-700')
                                : (isDark ? 'text-slate-400' : 'text-slate-500')
                            }`}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Floating Menu Footer Actions */}
                <div className={`flex items-center justify-between pt-4 mt-5 border-t ${
                  isDark ? 'border-white/[0.08]' : 'border-slate-100'
                }`}>
                  {activeFilterCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => onReset?.()}
                      className="flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                    >
                      <RotateCcw size={13} />
                      <span>پاک کردن فیلترها</span>
                    </button>
                  ) : (
                    <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      هیچ فیلتری انتخاب نشده است
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setFilterOpen(false)}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#090C0B] font-extrabold text-xs px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                  >
                    <Check size={14} />
                    <span>اعمال و بستن</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}

/**
 * ─────────────────────────────────────────────────────────────
 * 2. Calendar Status Bar (Adaptive Light & Dark)
 * ─────────────────────────────────────────────────────────────
 */
export function CalendarStatusBar({ cal }) {
  const { isDark } = useAppearance()
  if (!cal) return null
  const share = cal ? Math.min(1, cal.days_passed / (cal.working_days || 1)) : 0

  return (
    <div className={`w-full flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3 sm:px-5 sm:py-3.5 mb-5 transition-colors border ${
      isDark
        ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.35)]'
        : 'bg-white border-slate-200/80 text-slate-900 shadow-[0_4px_20px_rgba(15,23,42,0.04)]'
    }`}>
      <div className={`flex items-center gap-2 text-xs sm:text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
        <Calendar size={17} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
        <span>{cal.today_label}</span>
      </div>

      <div className={`flex items-center gap-4 sm:gap-6 text-xs font-medium flex-wrap ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        <div>
          <span>روز کاری: </span>
          <b className={`font-bold tabular-nums font-sans ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{fa(cal.working_days)}</b>
        </div>
        <div>
          <span>سپری‌شده: </span>
          <b className={`font-bold tabular-nums font-sans ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{fa(cal.days_passed)}</b>
        </div>
        <div>
          <span>باقی‌مانده: </span>
          <b className={`font-bold tabular-nums font-sans ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{fa(cal.days_left)}</b>
        </div>

        <div className="flex items-center gap-2 min-w-[120px]">
          <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-slate-200/80'}`}>
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_#10B981]"
              initial={{ width: 0 }}
              animate={{ width: `${share * 100}%` }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            />
          </div>
          <span className={`text-[11px] font-bold tabular-nums font-sans ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{pct(share)}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * ─────────────────────────────────────────────────────────────
 * 3. Hero Net Sales Card (8 Cols) + Forecast Rings (4 Cols)
 * ─────────────────────────────────────────────────────────────
 */
export function HeroSalesCard({ rows = [], period, o, growth, growthLabel }) {
  const { isDark } = useAppearance()

  const sparklineData = useMemo(() => {
    const raw = (rows && rows.length >= 2)
      ? rows.map((r) => Number(r.net_rial ?? r.sum_rial_vat ?? 0))
      : [32, 45, 38, 58, 52, 68, 75, 92]
    const min = Math.min(...raw)
    const max = Math.max(...raw)
    const range = max - min || 1
    const width = 300
    const height = 70
    const padding = 6
    const step = (width - padding * 2) / (raw.length - 1)

    const coords = raw.map((val, idx) => {
      const x = padding + idx * step
      const y = height - padding - ((val - min) / range) * (height - padding * 2)
      return { x, y }
    })

    const linePath = coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`, '')
    const lastX = coords[coords.length - 1].x.toFixed(1)
    const firstX = coords[0].x.toFixed(1)
    const fillPath = `${linePath} L ${lastX},${height} L ${firstX},${height} Z`

    return { linePath, fillPath }
  }, [rows])

  return (
    <div className={`lg:col-span-8 flex flex-col justify-between relative overflow-hidden rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 min-h-[280px] transition-colors border ${
      isDark
        ? 'bg-[#0F1412] border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-slate-100'
        : 'bg-white border-slate-200/90 shadow-[0_4px_24px_rgba(15,23,42,0.05)] text-slate-900'
    }`}>
      {/* Background Ambient Glow */}
      <div className={`absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
        isDark ? 'bg-emerald-500/10' : 'bg-emerald-500/15'
      }`} />
      <div className={`absolute -bottom-12 -left-12 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
        isDark ? 'bg-teal-500/10' : 'bg-teal-500/15'
      }`} />

      {/* Sparkline in Background */}
      <div className={`absolute inset-x-0 bottom-0 h-24 sm:h-28 pointer-events-none z-0 ${isDark ? 'opacity-50' : 'opacity-35'}`}>
        <svg className="w-full h-full" viewBox="0 0 300 70" preserveAspectRatio="none">
          <defs>
            <linearGradient id="heroSparklineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={sparklineData.fillPath} fill="url(#heroSparklineGrad)" className="opacity-25" />
          <path d={sparklineData.linePath} fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Top Badges */}
      <div className="relative z-10 flex items-center justify-between flex-wrap gap-2">
        <span className={`font-bold px-3.5 py-1 rounded-full text-xs border ${
          isDark
            ? 'backdrop-blur-md bg-white/[0.06] border-white/[0.08] text-emerald-400'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          فروش خالص (پس از کسر پروموشن) · {period}
        </span>
        {growth != null && (
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold tabular-nums border ${
            growth >= 0
              ? (isDark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-800 border-emerald-300')
              : (isDark ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-rose-50 text-rose-800 border-rose-300')
          }`}>
            {growth >= 0 ? '▲' : '▼'} {pct(Math.abs(growth))} {growthLabel ?? ''}
          </span>
        )}
      </div>

      {/* Big Real Revenue Number */}
      <div className="relative z-10 my-4 sm:my-6">
        <div
          title={o ? `${fa(o.net_rial)} ریال خالص` : undefined}
          className={`text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight tabular-nums whitespace-nowrap overflow-hidden font-sans py-0.5 ${
            isDark ? 'text-slate-100' : 'text-slate-900'
          }`}
        >
          {o ? fa(o.net_rial) : '—'} <span className={`text-xs sm:text-base font-bold mr-1 sm:mr-2 ${
            isDark ? 'text-emerald-400' : 'text-emerald-600'
          }`}>ریال</span>
        </div>
      </div>

      {/* Bottom 3 Capsules */}
      <div className="relative z-10 grid grid-cols-3 gap-2 sm:gap-3 w-full">
        <div className={`rounded-2xl p-2.5 sm:px-4 sm:py-3 min-w-0 transition-all border ${
          isDark
            ? 'bg-white/[0.04] backdrop-blur-xl border-white/[0.06] hover:bg-white/[0.07]'
            : 'bg-slate-50/90 border-slate-200/90 hover:bg-slate-100 shadow-xs'
        }`}>
          <span className={`text-[10px] sm:text-xs font-medium block truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>فروش ناخالص</span>
          <div className={`text-xs sm:text-sm font-bold tabular-nums font-sans mt-0.5 truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            {o?.sum_rial_vat != null ? `${billions1(o.sum_rial_vat)} م. ریال` : '—'}
          </div>
        </div>

        <div className={`rounded-2xl p-2.5 sm:px-4 sm:py-3 min-w-0 transition-all border ${
          isDark
            ? 'bg-white/[0.04] backdrop-blur-xl border-white/[0.06] hover:bg-white/[0.07]'
            : 'bg-slate-50/90 border-slate-200/90 hover:bg-slate-100 shadow-xs'
        }`}>
          <span className={`text-[10px] sm:text-xs font-medium block truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>مجموع پروموشن</span>
          <div className={`text-xs sm:text-sm font-bold tabular-nums font-sans mt-0.5 truncate ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
            {o?.promo_total_rial != null ? `${billions1(o.promo_total_rial)} م. ریال` : '—'}
          </div>
        </div>

        <div className={`rounded-2xl p-2.5 sm:px-4 sm:py-3 min-w-0 transition-all border ${
          isDark
            ? 'bg-white/[0.04] backdrop-blur-xl border-white/[0.06] hover:bg-white/[0.07]'
            : 'bg-slate-50/90 border-slate-200/90 hover:bg-slate-100 shadow-xs'
        }`}>
          <span className={`text-[10px] sm:text-xs font-medium block truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>درصد پروموشن</span>
          <div className={`text-xs sm:text-sm font-bold tabular-nums font-sans mt-0.5 truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            {o?.promo_percent != null ? pct(o.promo_percent) : '—'}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ForecastCard({ pace }) {
  const { isDark } = useAppearance()
  const d = pace.data?.available ? pace.data : null

  if (!d) {
    return (
      <div className={`lg:col-span-4 flex flex-col items-center justify-center rounded-[24px] sm:rounded-[28px] p-6 min-h-[280px] border ${
        isDark ? 'bg-[#0F1412] border-white/[0.06] text-slate-400' : 'bg-white border-slate-200/90 text-slate-500'
      }`}>
        <p className="text-sm">{pace.loading ? 'در حال بارگذاری…' : 'داده‌ای برای برآورد وجود ندارد.'}</p>
      </div>
    )
  }

  const done = d.remaining_working_days === 0
  const projected = done ? d.net_rial : d.projected_net_rial
  const daysPassed = d.elapsed_working_days || 0
  const totalDays = d.working_days || 1
  const daysRatio = Math.min(Math.max(daysPassed / totalDays, 0), 1)

  return (
    <div className={`lg:col-span-4 flex flex-col justify-between rounded-[24px] sm:rounded-[28px] p-5 sm:p-6 min-h-[280px] transition-colors border ${
      isDark
        ? 'bg-[#0F1412] border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-slate-100'
        : 'bg-white border-slate-200/90 shadow-[0_4px_24px_rgba(15,23,42,0.05)] text-slate-900'
    }`}>
      <div>
        <h2 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>پیش‌بینی پایان {monthLabel(d.year_month)}</h2>
      </div>

      <div className="flex items-center gap-4 sm:gap-5 my-4">
        {/* Activity Ring with Emerald Glow */}
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" stroke={isDark ? '#1E293B' : '#E2E8F0'} strokeWidth="10" fill="none" />
            <motion.circle
              cx="50"
              cy="50"
              r="40"
              stroke="#10B981"
              strokeWidth="10"
              strokeLinecap="round"
              fill="none"
              strokeDasharray="251.2"
              initial={{ strokeDashoffset: 251.2 }}
              animate={{ strokeDashoffset: 251.2 * (1 - daysRatio) }}
              transition={{ duration: 1.2, ease: [0.23, 1, 0.32, 1] }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className={`text-xs sm:text-sm font-extrabold tabular-nums font-sans ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              {fa(daysPassed)} از {fa(totalDays)}
            </span>
            <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>روز کاری</span>
          </div>
        </div>

        {/* Real Persian Forecast Numbers */}
        <div className="space-y-1.5 flex-1 min-w-0">
          <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ریال خالص برآوردی پایان ماه</p>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className={`text-base sm:text-lg xl:text-xl font-extrabold tabular-nums whitespace-nowrap font-sans ${
              isDark ? 'text-emerald-400' : 'text-emerald-700'
            }`}>
              {projected != null ? billions1(projected) : '—'}
            </span>
            <span className={`text-[11px] sm:text-xs font-semibold whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              میلیارد ریال
            </span>
          </div>

          <div className={`pt-2 mt-2 space-y-1.5 border-t text-xs ${isDark ? 'border-white/[0.08]' : 'border-slate-100'}`}>
            <div className="flex justify-between items-center">
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>ناخالص واقعی:</span>
              <span className={`tabular-nums font-bold whitespace-nowrap text-xs sm:text-sm font-sans ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {billions1(d.sum_rial_vat)} <span className="text-[10px] font-normal text-slate-400">م.ر</span>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>روز باقی‌مانده:</span>
              <strong className={`tabular-nums whitespace-nowrap font-sans ${isDark ? 'text-amber-400' : 'text-amber-700 font-bold'}`}>{fa(d.remaining_working_days)} روز</strong>
            </div>
          </div>
        </div>
      </div>

      <p className={`text-[10px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {d.method}. این عدد پیش‌بینی است، نه فروش ثبت‌شده.
      </p>
    </div>
  )
}

/**
 * ─────────────────────────────────────────────────────────────
 * 4. Sleek 12-Card KPI Grid (Adaptive Dark & Light, 100% Real Live Metrics)
 * ─────────────────────────────────────────────────────────────
 */
const TONE_CLASSES = {
  indigo: {
    badge: 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400',
    border: 'hover:border-indigo-500/30',
  },
  violet: {
    badge: 'bg-violet-500/10 text-violet-500 dark:text-violet-400',
    border: 'hover:border-violet-500/30',
  },
  amber: {
    badge: 'bg-amber-500/10 text-amber-500 dark:text-amber-400',
    border: 'hover:border-amber-500/30',
  },
  teal: {
    badge: 'bg-teal-500/10 text-teal-500 dark:text-teal-400',
    border: 'hover:border-teal-500/30',
  },
  sky: {
    badge: 'bg-sky-500/10 text-sky-500 dark:text-sky-400',
    border: 'hover:border-sky-500/30',
  },
  pink: {
    badge: 'bg-pink-500/10 text-pink-500 dark:text-pink-400',
    border: 'hover:border-pink-500/30',
  },
  emerald: {
    badge: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400',
    border: 'hover:border-emerald-500/30',
  },
  red: {
    badge: 'bg-rose-500/10 text-rose-500 dark:text-rose-400',
    border: 'hover:border-rose-500/30',
  },
  blue: {
    badge: 'bg-blue-500/10 text-blue-500 dark:text-blue-400',
    border: 'hover:border-blue-500/30',
  },
}

export function KpiGrid12({ items = [] }) {
  const { isDark } = useAppearance()

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 my-5 w-full">
      {items.map((m, idx) => {
        const Icon = m.icon
        const toneStyle = TONE_CLASSES[m.tone] || TONE_CLASSES.emerald
        const isClickable = Boolean(m.onClick)
        const Tag = isClickable ? 'button' : 'div'

        return (
          <motion.div
            key={m.label || idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: idx * 0.02 }}
            whileHover={{ y: -3 }}
            className="h-full"
          >
            <Tag
              type={isClickable ? 'button' : undefined}
              onClick={m.onClick}
              title={m.tooltip || (typeof m.value === 'string' && m.value !== '—' ? `${m.label}: ${m.value}` : undefined)}
              className={`group w-full h-full text-right rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 border min-w-0 ${
                isClickable ? 'cursor-pointer' : ''
              } ${
                isDark
                  ? `bg-[#0F1412] hover:bg-[#131A17] border-white/[0.06] ${toneStyle.border} shadow-[0_4px_20px_rgba(0,0,0,0.35)] text-slate-100`
                  : `bg-white hover:bg-slate-50/80 border-slate-200/90 hover:border-emerald-400 shadow-[0_2px_12px_rgba(15,23,42,0.03)] text-slate-900`
              }`}
            >
              {/* Top row: Label right + Icon badge left */}
              <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                <span className={`text-xs sm:text-[13px] font-semibold leading-snug truncate ${
                  isDark ? 'text-slate-400 group-hover:text-slate-300' : 'text-slate-500 group-hover:text-slate-700'
                }`}>
                  {m.label}
                </span>
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${toneStyle.badge}`}>
                  {Icon && <Icon size={16} />}
                </div>
              </div>

              {/* Middle row: Big bold metric number */}
              <div className="my-1 min-w-0">
                <div className={`text-lg sm:text-xl xl:text-2xl font-black tracking-tight tabular-nums font-sans truncate ${
                  isDark ? 'text-slate-100' : 'text-slate-900'
                }`}>
                  {m.value}
                </div>
              </div>

              {/* Bottom row: Subtitle / unit */}
              <div className="mt-1 min-w-0">
                <span className={`text-[10.5px] sm:text-[11.5px] font-medium truncate block ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  {m.unit}
                </span>
              </div>
            </Tag>
          </motion.div>
        )
      })}
    </div>
  )
}

// Backward-compatible alias
export const RealKpiStrip = KpiGrid12

/**
 * ─────────────────────────────────────────────────────────────
 * 5. Monthly Trend Chart (7 Cols) & Sales Share Breakdown (5 Cols)
 * ─────────────────────────────────────────────────────────────
 */
export function MonthlySalesChart({ rows = [] }) {
  const { isDark } = useAppearance()
  const data = rows.map((r) => ({
    ...r,
    value: (r.sum_rial_vat || 0) / 1e9,
    net: (r.net_rial || 0) / 1e9,
  }))

  return (
    <div className={`rounded-[24px] p-5 sm:p-6 flex flex-col justify-between h-full border transition-colors ${
      isDark
        ? 'bg-[#0F1412] border-white/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.35)] text-slate-100'
        : 'bg-white border-slate-200/90 shadow-[0_4px_24px_rgba(15,23,42,0.05)] text-slate-900'
    }`}>
      <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
            <h2 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>روند فروش ماهانه</h2>
          </div>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ریال خالص و فروش ناخالص · میلیارد ریال</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
            <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>ریال خالص</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#06B6D4]" />
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>فروش ناخالص</span>
          </div>
        </div>
      </div>

      <div className="w-full h-[280px] mt-4" dir="ltr" style={{ direction: 'ltr' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 10, left: -10, bottom: 0 }} barGap={6}>
            <defs>
              <linearGradient id="barNetGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
              <linearGradient id="barGrossGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22D3EE" />
                <stop offset="100%" stopColor="#0891B2" />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)'} strokeDasharray="3 3" />
            <XAxis dataKey="year_month" reversed tickFormatter={monthName} axisLine={false} tickLine={false} tick={{ fill: isDark ? '#64748B' : '#475569', fontSize: 11, fontFamily: 'Vazirmatn' }} />
            <YAxis orientation="right" axisLine={false} tickLine={false} tickFormatter={(v) => fa(v)} width={50} tick={{ fill: isDark ? '#64748B' : '#475569', fontSize: 11, fontFamily: 'Vazirmatn' }} />
            <Tooltip
              formatter={(v, n) => [`${fa(v)} میلیارد ریال`, n]}
              labelFormatter={monthLabel}
              cursor={{ fill: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)', radius: 8 }}
              contentStyle={{
                backgroundColor: isDark ? 'rgba(15, 20, 18, 0.95)' : '#FFFFFF',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #E2E8F0',
                borderRadius: '12px',
                color: isDark ? '#F1F5F9' : '#0F172A',
                fontSize: '12px',
                direction: 'rtl',
                fontFamily: 'Vazirmatn',
                boxShadow: isDark ? 'none' : '0 10px 25px -5px rgba(0,0,0,0.1)',
              }}
            />
            <Bar dataKey="net" name="ریال خالص" fill="url(#barNetGrad)" radius={[6, 6, 2, 2]} maxBarSize={26} />
            <Bar dataKey="value" name="فروش ناخالص" fill="url(#barGrossGrad)" radius={[6, 6, 2, 2]} maxBarSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function SalesShareCard({ p }) {
  const { isDark } = useAppearance()
  const [by, setBy] = useState('branch')
  const r = useApi('/breakdown', { ...p, by, limit: 40 })

  const slices = useMemo(() => {
    const pos = (r.data ?? []).filter((x) => x.sum_rial_vat > 0).sort((a, b) => b.sum_rial_vat - a.sum_rial_vat)
    const top = pos.slice(0, 8).map((x) => ({ name: String(x.key), value: x.sum_rial_vat }))
    const rest = pos.slice(8).reduce((s, x) => s + x.sum_rial_vat, 0)
    if (rest > 0) top.push({ name: 'سایر', value: rest })
    return top
  }, [r.data, by])

  const total = slices.reduce((s, x) => s + x.value, 0)

  return (
    <div className={`rounded-[24px] p-5 sm:p-6 flex flex-col justify-between h-full border transition-colors ${
      isDark
        ? 'bg-[#0F1412] border-white/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.35)] text-slate-100'
        : 'bg-white border-slate-200/90 shadow-[0_4px_24px_rgba(15,23,42,0.05)] text-slate-900'
    }`}>
      <div>
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>سهم از فروش</h2>
          <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>۸ مورد برتر و بقیه در «سایر»</span>
        </div>

        {/* Tab Filters */}
        <div className={`flex items-center gap-1 p-1 rounded-xl overflow-x-auto no-scrollbar mb-3 border ${
          isDark ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-slate-100 border-slate-200/80'
        }`} role="tablist">
          {PIE_BY.map(([k, label]) => {
            const active = by === k
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setBy(k)}
                className={`relative px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                  active
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Donut Chart */}
        <div className="relative w-full h-44 my-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="62%"
                outerRadius="88%"
                paddingAngle={3}
                stroke="none"
              >
                {slices.map((s, i) => (
                  <Cell key={s.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, n) => [`${fa(v)} ریال (${pct(v / total)})`, n]}
                contentStyle={{
                  background: isDark ? 'rgba(15, 20, 18, 0.95)' : '#FFFFFF',
                  borderRadius: '12px',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #E2E8F0',
                  color: isDark ? '#FFFFFF' : '#0F172A',
                  fontSize: '12px',
                  direction: 'rtl',
                  fontFamily: 'Vazirmatn',
                  boxShadow: isDark ? 'none' : '0 10px 25px -5px rgba(0,0,0,0.1)',
                }}
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
      </div>

      {/* Breakdown list */}
      <ul className={`space-y-2 mt-3 pt-3 border-t max-h-44 overflow-y-auto exec-hover-scrollbar w-full px-1 pl-2 ${
        isDark ? 'border-white/[0.06]' : 'border-slate-100'
      }`}>
        {slices.map((s, i) => (
          <li key={s.name} className="flex items-center justify-between gap-2 text-xs w-full px-1">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
              <span className={`text-xs font-medium truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{s.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-semibold tabular-nums font-sans ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{pct(s.value / total)}</span>
              <span aria-hidden="true" className={`w-12 h-1.5 rounded-full overflow-hidden shrink-0 ${isDark ? 'bg-white/[0.06]' : 'bg-slate-200'}`}>
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${(s.value / total) * 100}%`,
                    background: PIE_COLORS[i % PIE_COLORS.length],
                  }}
                />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * ─────────────────────────────────────────────────────────────
 * 6. Compare with Previous Month (7 Cols) & Daily Trend (5 Cols)
 * ─────────────────────────────────────────────────────────────
 */
const prevMonthKey = (ym) => (Number(ym.slice(4)) > 1 ? `${ym.slice(0, 4)}${String(Number(ym.slice(4)) - 1).padStart(2, '0')}` : null)
const spanOf = (ym, lastDay) => ({ start: `${ym.slice(0, 4)}/${ym.slice(4)}/01`, end: `${ym.slice(0, 4)}/${ym.slice(4)}/${String(lastDay).padStart(2, '0')}` })

function DeltaBadge({ cur, prev }) {
  if (!(prev > 0)) return <span className="text-slate-400">—</span>
  const d = cur / prev - 1
  const up = d >= 0
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border tabular-nums font-sans ${
      up ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
    }`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {pct(Math.abs(d))}
    </span>
  )
}

export function MonthCompareCard({ dims, month, pace, months = [] }) {
  const { isDark } = useAppearance()
  const pc = pace.data?.available ? pace.data : null
  const ym = month || pc?.year_month || ''
  const pym = ym ? prevMonthKey(ym) : null
  const partial = Boolean(pc && ym === pc.year_month && pc.last_day < pc.month_days)
  const lastDay = partial ? pc.last_day : 31
  const ready = Boolean(ym && pym && months.includes(ym) && months.includes(pym))
  const cur = useApi('/overview', { ...dims, ...spanOf(ym || '000000', lastDay) }, ready)
  const prev = useApi('/overview', { ...dims, ...spanOf(pym || '000000', lastDay) }, ready)
  const c = ready ? cur.data : null
  const b = ready ? prev.data : null
  const span = partial ? ` (۱ تا ${fa(lastDay)})` : ''
  const items = [
    ['ریال خالص', 'net_rial'],
    ['فروش ناخالص', 'sum_rial_vat'],
    ['تعداد کالا', 'sum_qty'],
    ['تعداد فاکتور', 'invoice_count'],
    ['مشتری فعال', 'active_customers'],
  ]

  return (
    <div className={`rounded-[24px] p-5 sm:p-6 flex flex-col justify-between h-full border transition-colors ${
      isDark
        ? 'bg-[#0F1412] border-white/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.35)] text-slate-100'
        : 'bg-white border-slate-200/90 shadow-[0_4px_24px_rgba(15,23,42,0.05)] text-slate-900'
    }`}>
      <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <div>
          <h2 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>مقایسه با ماه قبل</h2>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {ready ? `${monthLabel(ym)}${span} در برابر ${monthLabel(pym)}${span}` : 'برای مقایسه به دو ماه متوالی داده نیاز است'}
          </p>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
          isDark ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-emerald-800 bg-emerald-50 border-emerald-200'
        }`}>
          {partial ? 'هم‌بازه' : 'ماه کامل'}
        </span>
      </div>

      <div className="flex-1 my-3">
        {!c || !b ? (
          <div className={`flex items-center justify-center h-40 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {ready ? 'در حال بارگذاری…' : 'ماه قبلِ این دوره در داده موجود نیست.'}
          </div>
        ) : (
          <div className={`divide-y ${isDark ? 'divide-white/[0.05]' : 'divide-slate-100'}`}>
            {items.map(([label, key]) => (
              <div key={key} className="py-2.5 flex items-center justify-between text-xs">
                <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{label}</span>
                <div className="flex items-center gap-4">
                  <span className={`font-bold tabular-nums font-sans ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{fa(c[key])}</span>
                  <span className={`tabular-nums font-sans text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fa(b[key])}</span>
                  <DeltaBadge cur={c[key]} prev={b[key]} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {partial && (
        <p className={`text-[10px] pt-2 border-t ${isDark ? 'text-slate-400 border-white/[0.06]' : 'text-slate-500 border-slate-100'}`}>
          ماه جاری کامل نیست؛ برای انصاف، همان روزهای ابتدای ماه قبل مقایسه می‌شود.
        </p>
      )}
    </div>
  )
}

export function DailyTrendCard({ days = [], month }) {
  const { isDark } = useAppearance()
  const data = days.map((r) => ({ ...r, value: (r.sum_rial_vat || 0) / 1e9 }))

  return (
    <div className={`rounded-[24px] p-5 sm:p-6 flex flex-col justify-between h-full border transition-colors ${
      isDark
        ? 'bg-[#0F1412] border-white/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.35)] text-slate-100'
        : 'bg-white border-slate-200/90 shadow-[0_4px_24px_rgba(15,23,42,0.05)] text-slate-900'
    }`}>
      <div className={`flex items-center justify-between pb-3 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-100'}`}>
        <div>
          <div className="flex items-center gap-2">
            <Activity size={16} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
            <h2 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>روند فروش روزانه</h2>
          </div>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {month ? `روزهای ${monthLabel(month)} · میلیارد ریال` : 'روزهای دورهٔ انتخاب‌شده · میلیارد ریال'}
          </p>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
          isDark ? 'text-slate-400 bg-white/[0.04] border-white/[0.06]' : 'text-slate-600 bg-slate-100 border-slate-200'
        }`}>
          Rial+Vat
        </span>
      </div>

      <div className="w-full h-[240px] mt-4" dir="ltr" style={{ direction: 'ltr' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="dailyAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)'} strokeDasharray="3 3" />
            <XAxis dataKey="date" reversed tickFormatter={dayLabel} axisLine={false} tickLine={false} minTickGap={30} tick={{ fill: isDark ? '#64748B' : '#475569', fontSize: 11, fontFamily: 'Vazirmatn' }} />
            <YAxis orientation="right" axisLine={false} tickLine={false} tickFormatter={(v) => fa(v)} width={50} tick={{ fill: isDark ? '#64748B' : '#475569', fontSize: 11, fontFamily: 'Vazirmatn' }} />
            <Tooltip
              formatter={(v) => [`${fa(v)} میلیارد ریال`, 'فروش']}
              labelFormatter={dayLabel}
              contentStyle={{
                backgroundColor: isDark ? 'rgba(15, 20, 18, 0.95)' : '#FFFFFF',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #E2E8F0',
                borderRadius: '12px',
                color: isDark ? '#F1F5F9' : '#0F172A',
                fontSize: '12px',
                direction: 'rtl',
                fontFamily: 'Vazirmatn',
                boxShadow: isDark ? 'none' : '0 10px 25px -5px rgba(0,0,0,0.1)',
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#10B981"
              fill="url(#dailyAreaGrad)"
              strokeWidth={2.5}
              strokeLinejoin="round"
              activeDot={{ r: 5, fill: '#10B981', stroke: isDark ? '#090C0B' : '#FFFFFF', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/**
 * ─────────────────────────────────────────────────────────────
 * 7. Master SalesOverview Component (100% Real Live Dashboard Data)
 * ─────────────────────────────────────────────────────────────
 */
export default function SalesOverview({
  p,
  cal,
  month,
  setMonth,
  dims = {},
  onFilterChange,
  filters = {},
  onReset,
  onOpenReturns,
  onOpenTickets,
  onNavigate,
}) {
  const { isDark } = useAppearance()
  const { month: _m, start: _s, end: _e, ...activeDims } = p

  // Real API hooks (identical queries to original dashboard)
  const ov = useApi('/overview', p)
  const invoiceLines = useApi('/invoice-lines', p)
  const growth = useApi('/growth', { ...activeDims, kind: 'month' })
  const monthly = useApi('/monthly', { ...activeDims })
  const trend = useApi('/trend', p)
  const pace = useApi('/pace', activeDims)
  const target = useApi('/target', { core: p.core, ...(month ? { month } : {}) })
  const ret = useApi('/returns/summary', p)

  const o = ov.data
  const rows = monthly.data ?? []
  const days = trend.data ?? []
  const retTotal = ret.data?.available ? ret.data.total : null

  // Growth calculations
  const lastPeriod = growth.data?.periods?.at(-1)
  const selectedPeriod = growth.data?.periods?.find((r) => r.key === month)
  const invoiceGrowth = (month ? selectedPeriod : lastPeriod)?.compare?.growth?.invoice_count
  const netGrowth = (month ? selectedPeriod : lastPeriod)?.compare?.growth?.net_rial
  const growthLabel = (month ? selectedPeriod : lastPeriod)?.label

  // Target achievement
  const targetAchieved = target.data?.summary?.achieved_pct ?? null
  const targetTotal = target.data?.summary?.target_rial ?? null

  // AOV & ARPU calculations
  const aov = (o && o.invoice_count) ? Math.round(o.net_rial / o.invoice_count) : null
  const arpu = (o && o.active_customers) ? Math.round(o.net_rial / o.active_customers) : null

  const toggle = (ym) => setMonth(ym === month ? '' : ym)

  // 12 Real KPI Cards (100% matched with original live dashboard)
  const kpiItems = [
    {
      icon: UserCheck,
      tone: 'indigo',
      label: 'میانگین خرید هر مشتری',
      value: arpu ? fa(arpu) : '—',
      unit: 'ریال · میانگین هر مشتری یکتا',
    },
    {
      icon: PackageSearch,
      tone: 'violet',
      label: 'تعداد کالا',
      value: o ? fa(o.sum_qty) : '—',
      unit: 'عدد',
    },
    {
      icon: PackageSearch,
      tone: 'violet',
      label: 'تعداد کالا خالص',
      value: o ? fa(o.sum_qty_net) : '—',
      unit: 'عدد · منهای مرجوعی',
    },
    {
      icon: FileText,
      tone: 'amber',
      label: 'تعداد فاکتور',
      value: o ? fa(o.invoice_count) : '—',
      unit: 'فقره',
    },
    {
      icon: TrendingUp,
      tone: 'teal',
      label: 'درصد رشد فاکتور',
      value: pct(invoiceGrowth),
      unit: growthLabel ? `${growthLabel} نسبت به ماه قبل` : 'نسبت به ماه قبل',
    },
    {
      icon: ListOrdered,
      tone: 'sky',
      label: 'میانگین سطر فاکتور',
      value: invoiceLines.data ? fa2(invoiceLines.data.avg_lines_per_invoice) : '—',
      unit: 'سطر در هر فاکتور',
    },
    {
      icon: Users,
      tone: 'pink',
      label: 'مشتری فعال',
      value: o ? fa(o.active_customers) : '—',
      unit: 'مشتری یکتا',
    },
    {
      icon: Receipt,
      tone: 'emerald',
      label: 'میانگین مبلغ فاکتور',
      value: aov ? fa(aov) : '—',
      unit: 'ریال · ارزش سفارش',
    },
    {
      icon: Target,
      tone: 'red',
      label: 'درصد تحقق تارگت',
      value: targetAchieved != null ? pct(targetAchieved) : (target.loading ? '…' : '—'),
      unit: targetTotal ? `از تارگت ${billions1(targetTotal)} م.ر` : 'از هدف فروش دوره',
    },
    {
      icon: Undo2,
      tone: 'amber',
      label: 'حواله‌های برگشتی',
      value: retTotal ? fa(retTotal.returned_orders) : '—',
      unit: retTotal ? `${pct(retTotal.returned_order_percent)} از ${fa(retTotal.orders)} حواله` : '—',
      onClick: onOpenReturns,
    },
    {
      icon: PackageX,
      tone: 'red',
      label: 'درصد برگشتی حواله',
      value: retTotal ? pct(retTotal.return_percent) : '—',
      unit: retTotal ? `${billions1(retTotal.return_rial)} م.ر برگشتی` : '—',
      onClick: onOpenReturns,
    },
    {
      icon: PackageCheck,
      tone: 'blue',
      label: 'تعداد فاکتور تحویلی',
      value: retTotal ? fa(retTotal.invoiced_orders) : '—',
      unit: retTotal ? `${pct(retTotal.invoiced_order_percent)} درصد تحویل` : '—',
      onClick: onOpenReturns,
    },
  ]

  const contextualSubtitle = useMemo(() => {
    return `دوره: ${month ? monthLabel(month) : 'همه ماه‌ها'} · مبالغ به ریال و شامل مالیات و عوارض`
  }, [month])

  return (
    <div className="w-full max-w-[1600px] mx-auto px-1 sm:px-4 py-2 transition-colors">
      {/* ── 0. Modern Executive Header with Branch, Month & Floating Advanced Filter Popover ── */}
      <OverviewHeader
        title="نمای کلی فروش"
        subtitle={contextualSubtitle}
        branch={dims.branch}
        branches={filters.branch ?? []}
        onBranchChange={(b) => onFilterChange?.('branch', b)}
        month={month}
        setMonth={setMonth}
        months={filters.month ?? []}
        dims={dims}
        filters={filters}
        onFilterChange={onFilterChange}
        onReset={onReset}
      />

      {/* ── 1. Calendar Status Bar ── */}
      <CalendarStatusBar cal={cal} />

      {/* ── 2. Hero Bento Grid (8 Cols Net Sales + 4 Cols Forecast) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch mb-5">
        <HeroSalesCard
          rows={rows}
          period={month ? monthLabel(month) : 'همه ماه‌ها'}
          o={o}
          growth={netGrowth}
          growthLabel={growthLabel}
        />
        <ForecastCard pace={pace} />
      </div>

      {/* ── 3. 12 Sleek KPI Cards ── */}
      <KpiGrid12 items={kpiItems} />

      {/* ── 5. Middle Grid: Monthly Sales Chart (8 Cols) + Sales Share (4 Cols) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch mb-5">
        <div className="lg:col-span-8">
          <MonthlySalesChart rows={rows} />
        </div>
        <div className="lg:col-span-4">
          <SalesShareCard p={p} />
        </div>
      </div>

      {/* ── 6. Bottom Grid: Month Compare (7 Cols) + Daily Trend (5 Cols) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch mb-5">
        <div className="lg:col-span-7">
          <MonthCompareCard
            dims={dims}
            month={month}
            pace={pace}
            months={rows.map((r) => r.year_month)}
          />
        </div>
        <div className="lg:col-span-5">
          <DailyTrendCard days={days} month={month} />
        </div>
      </div>

      {/* ── 7. Monthly Summary Table (Power Pivot Model) ── */}
      <div className={`rounded-[24px] p-5 sm:p-6 overflow-hidden w-full transition-colors border ${
        isDark
          ? 'bg-[#0F1412] border-white/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.35)] text-slate-100'
          : 'bg-white border-slate-200/90 shadow-[0_4px_24px_rgba(15,23,42,0.05)] text-slate-900'
      }`}>
        <div className={`flex items-center justify-between pb-3 mb-3 border-b ${
          isDark ? 'border-white/[0.06]' : 'border-slate-100'
        }`}>
          <div>
            <h2 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>خلاصهٔ ماهانه</h2>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>برای تمرکز روی یک ماه، ردیف آن را انتخاب کنید</p>
          </div>
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
            isDark ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-emerald-800 bg-emerald-50 border-emerald-200'
          }`}>
            مدل Power Pivot
          </span>
        </div>

        <div className="w-full overflow-x-auto -mx-2 px-2">
          <Table
            name="خلاصه-ماهانه"
            rows={rows}
            onRow={(r) => toggle(r.year_month)}
            highlight={(r) => month === r.year_month}
            columns={[
              { label: 'ماه', render: (r) => monthName(r.year_month), value: (r) => r.year_month },
              { label: 'فروش ناخالص', render: (r) => fa(r.sum_rial_vat), value: (r) => r.sum_rial_vat },
              { label: 'ریال خالص', render: (r) => fa(r.net_rial), value: (r) => r.net_rial },
              { label: 'فاکتور', render: (r) => fa(r.invoice_count), value: (r) => r.invoice_count },
              { label: 'پروموشن', render: (r) => pct(r.promo_percent), value: (r) => r.promo_percent * 100, unit: '٪' },
            ]}
          />
        </div>
      </div>
    </div>
  )
}

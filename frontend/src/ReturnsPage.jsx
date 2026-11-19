import { useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  CircleAlert,
  CircleMinus,
  ExternalLink,
  Info,
  Undo2,
  CircleDollarSign,
  Calendar,
  Users,
  FileText,
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  TrendingDown,
  Store,
  Layers,
  Sparkles,
  ArrowUpRight,
  Filter,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useApi } from './api'
import { useAppearance } from './AppearanceContext'
import { fa, monthName, monthLabel, billions1 } from './format'
import { Table, pct, rial } from './ui'

/* برگشتی حواله پخش: داده از فایل حواله می‌آید و با ردیف‌های مرجوعی داخل فروش (SR) جمع نمی‌شود. */

const PAGE_SIZE = 50
const VIEWS = [
  ['month', 'تحلیل ماهانه و روند', Calendar],
  ['branch', 'تفکیک شعب', Store],
  ['reason', 'علت‌های برگشت', CircleAlert],
]

const STATUS = {
  full: { label: 'برگشتی کامل', Icon: CircleAlert, color: '#dc2626' },
  partial: { label: 'برگشتی جزئی', Icon: CircleMinus, color: '#d97706' },
}

const IGNORED_LABELS = {
  sales_type: 'کانال فروش',
  region: 'منطقه',
  state: 'منطقه شهرداری',
  city: 'شهر',
  brand: 'برند',
  group: 'لاین',
  grade: 'گرید مشتری',
  main_group: 'گروه کالای اصلی',
  sub_group: 'زیرگروه کالای اصلی',
}

const SCOPE_LABELS = { customer: 'مشتری', visitor: 'ویزیتور' }

export const returnsArg = (by, keys) => `${by}~${[].concat(keys).join('|')}`
function parseScope(arg) {
  const i = (arg ?? '').indexOf('~')
  if (i < 1) return null
  const by = arg.slice(0, i)
  const keys = arg.slice(i + 1).split('|').filter(Boolean)
  return SCOPE_LABELS[by] && keys.length ? { by, keys } : null
}

const DONUT_COLORS = [
  '#10B981', // Emerald
  '#F43F5E', // Rose
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#D97706', // Warm Amber
  '#64748B', // Slate
  '#84CC16', // Lime
  '#E11D48', // Deep Rose
  '#3B82F6', // Sky Blue
  '#A855F7', // Violet
  '#059669', // Dark Emerald
  '#475569', // Charcoal Slate
]

function StatusBadge({ s }) {
  const m = STATUS[s]
  if (!m) return <span className="text-xs text-[#86868B]">بدون برگشتی</span>
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
      s === 'full' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
    }`}>
      <m.Icon size={12} aria-hidden="true" />
      <span>{m.label}</span>
    </span>
  )
}

function Note({ children, tone }) {
  const isErr = tone === 'err'
  return (
    <div className={`rounded-2xl p-3.5 text-xs font-medium flex items-center gap-2.5 flex-wrap ${
      isErr ? 'bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
    }`} role={isErr ? 'alert' : 'status'}>
      <Info size={16} aria-hidden="true" className="shrink-0" />
      <div className="flex-1 flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  )
}

const orderCols = (extra = []) => [
  { label: 'تاریخ', render: (r) => r.order_date ?? '—', value: (r) => String(r.order_date ?? '') },
  { label: 'شعبه', render: (r) => r.branch ?? '—', value: (r) => String(r.branch ?? '') },
  { label: 'شماره حواله', render: (r) => <span dir="ltr">{r.dispatch_no ?? '—'}</span>, value: (r) => String(r.dispatch_no ?? '') },
  ...extra,
  { label: 'مبلغ حواله (ریال)', render: (r) => <span className="tabular-nums">{rial(r.order_rial)}</span>, value: (r) => r.order_rial },
  { label: 'مبلغ برگشتی (ریال)', render: (r) => <span className="tabular-nums font-bold text-rose-600 dark:text-rose-400">{rial(r.return_rial)}</span>, value: (r) => r.return_rial },
  { label: 'وضعیت', render: (r) => <StatusBadge s={r.status} />, value: (r) => STATUS[r.status]?.label ?? 'بدون برگشتی' },
  { label: 'علت برگشت', render: (r) => r.reason ?? 'نامشخص', value: (r) => String(r.reason ?? 'نامشخص') },
]
const customerCol = { label: 'مشتری', render: (r) => (r.customer_code ? `${r.customer_code} · ${r.customer_name ?? ''}` : '—'), value: (r) => `${r.customer_code ?? ''} ${r.customer_name ?? ''}` }

const aggCols = (first) => [
  first,
  { label: 'تعداد حواله', render: (r) => fa(r.orders), value: (r) => r.orders },
  { label: 'حواله برگشتی', render: (r) => fa(r.returned_orders), value: (r) => r.returned_orders },
  { label: 'مبلغ حواله (ریال)', render: (r) => rial(r.order_rial), value: (r) => r.order_rial },
  { label: 'مبلغ برگشتی (ریال)', render: (r) => <span className="font-bold text-rose-600 dark:text-rose-400">{rial(r.return_rial)}</span>, value: (r) => r.return_rial },
  { label: 'درصد برگشتی', render: (r) => <span className="font-bold text-amber-600 dark:text-amber-400">{pct(r.return_percent, 2)}</span>, value: (r) => r.return_percent * 100, unit: '٪' },
]

/* Glass Card Container */
function AppleCard({ title, subtitle, badge, action, children, className = '' }) {
  const { isDark, isSolid } = useAppearance()
  return (
    <div
      className={`rounded-3xl border transition-all p-5 sm:p-6 w-full max-w-full ${
        isDark
          ? 'bg-[#0B100E]/85 backdrop-blur-2xl border-emerald-500/15 text-[#F5F5F7] shadow-[0_8px_30px_rgba(0,0,0,0.45)]'
          : isSolid
          ? 'bg-white border-slate-200 text-[#1D1D1F] shadow-xs'
          : 'bg-white/95 backdrop-blur-xl border-slate-200/90 text-[#1D1D1F] shadow-[0_8px_30px_rgb(0,0,0,0.04)]'
      } ${className}`}
    >
      {(title || subtitle || badge || action) && (
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3 pb-3 border-b border-black/[0.04] dark:border-white/[0.06]">
          <div>
            {title && <h2 className={`text-sm sm:text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{title}</h2>}
            {subtitle && <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {badge && (
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
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

/* Dedicated Pixel-Perfect Tooltip for Donut Chart */
function DonutChartTip({ active, payload, total }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  const val = d.value ?? 0
  const sharePct = total > 0 ? pct(val / total, 1) : '—'
  const fill = d.payload?.fill || d.fill || '#10B981'
  return (
    <div className="backdrop-blur-xl border border-white/10 dark:bg-[#141A18]/95 bg-slate-900/95 text-white rounded-2xl p-3 shadow-2xl min-w-[210px] text-right pointer-events-none select-none z-50">
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: fill }} />
          <span className="font-bold text-xs text-white truncate max-w-[130px]">{d.name}</span>
        </div>
        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/10 text-emerald-300 tabular-nums shrink-0">
          {sharePct} از کل
        </span>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between text-slate-300 gap-2">
          <span className="text-[11px]">مبلغ برگشتی:</span>
          <span className="font-bold text-white tabular-nums whitespace-nowrap">{rial(val)} <span className="text-[10px] font-normal text-slate-400">ریال</span></span>
        </div>
        <div className="flex items-center justify-between text-slate-300 text-[11px] gap-2">
          <span>معادل همگن:</span>
          <span className="font-extrabold text-amber-300 tabular-nums whitespace-nowrap">{billions1(val)} میلیارد ریال</span>
        </div>
        {d.payload?.orders > 0 && (
          <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-white/5">
            <span>تعداد حواله‌ها:</span>
            <span className="font-medium text-slate-200 tabular-nums">{fa(d.payload.orders)} حواله</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* Dedicated Tooltip for Monthly Return Trend */
function MonthlyTrendTip({ active, payload, total }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const val = d.returnRial ?? 0
  const share = total > 0 ? (val / total) * 100 : 0
  return (
    <div className="backdrop-blur-xl border border-white/10 dark:bg-[#141A18]/95 bg-slate-900/95 text-white rounded-2xl p-3 shadow-2xl min-w-[210px] text-right pointer-events-none select-none z-50">
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/10">
        <span className="font-bold text-xs text-white">{d.fullMonth}</span>
        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 tabular-nums">
          {pct(share / 100, 1)} از کل دوره
        </span>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between text-slate-300 gap-2">
          <span className="text-[11px]">مبلغ برگشتی:</span>
          <span className="font-bold text-white tabular-nums whitespace-nowrap">{rial(val)} <span className="text-[10px] text-slate-400 font-normal">ریال</span></span>
        </div>
        <div className="flex items-center justify-between text-slate-300 text-[11px] gap-2">
          <span>معادل همگن:</span>
          <span className="font-extrabold text-amber-300 tabular-nums whitespace-nowrap">{billions1(val)} میلیارد ریال</span>
        </div>
        {d.returnedOrders > 0 && (
          <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-white/5">
            <span>تعداد برگشتی:</span>
            <span className="font-medium text-slate-200 tabular-nums">{fa(d.returnedOrders)} از {fa(d.orders)} حواله</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* Redesigned Donut Breakdown with Podium Ranks */
function AppleDonutBreakdown({
  rows = [],
  nameKey,
  labelFn = (v) => String(v ?? '—'),
  selected = '',
  onPick,
  title = 'تفکیک و سهم برگشتی',
}) {
  const [hovered, setHovered] = useState(null)
  const { isDark } = useAppearance()

  const data = useMemo(() => {
    return rows
      .map((r) => ({
        name: labelFn(r[nameKey]),
        rawName: r[nameKey],
        value: r.return_rial ?? 0,
        orders: r.orders ?? 0,
        returnedOrders: r.returned_orders ?? 0,
        returnPercent: r.return_percent ?? 0,
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [rows, nameKey, labelFn])

  const total = useMemo(() => data.reduce((sum, r) => sum + r.value, 0), [data])
  const maxVal = useMemo(() => (data.length ? data[0].value : 1), [data])

  const activeItem = hovered || (selected ? data.find((d) => d.rawName === selected) : null)
  const activeValue = activeItem ? activeItem.value : total
  const activePercent = total > 0 ? (activeValue / total) * 100 : 0

  if (!data.length) {
    return <div className="text-center py-8 text-xs text-[#86868B]">داده‌ای برای نمایش نمودار وجود ندارد.</div>
  }

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 items-center border rounded-3xl p-5 md:p-6 transition-all ${
      isDark
        ? 'bg-[#0E1512]/90 border-emerald-500/15 shadow-[0_4px_25px_rgba(0,0,0,0.35)]'
        : 'bg-[#F9FAFB] border-slate-200/90 shadow-xs'
    }`}>
      {/* Signature Apple Donut with Central Metrics */}
      <div className="lg:col-span-5 flex flex-col items-center justify-center relative min-h-[300px]">
        <div className="w-full h-[280px] relative flex items-center justify-center" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={78}
                outerRadius={118}
                paddingAngle={data.length > 1 ? 3 : 0}
                cornerRadius={6}
                stroke="none"
                onMouseEnter={(_, idx) => setHovered(data[idx])}
                onMouseLeave={() => setHovered(null)}
                onClick={(d) => {
                  const v = d?.payload?.rawName ?? d?.rawName
                  if (onPick && v != null) {
                    onPick(selected === v ? '' : v)
                  }
                }}
                style={{ cursor: onPick ? 'pointer' : 'default' }}
              >
                {data.map((d, i) => {
                  const isSelected = selected && d.rawName === selected
                  const isHovered = hovered && hovered.rawName === d.rawName
                  const isMuted = (selected && !isSelected) || (hovered && !isHovered)
                  return (
                    <Cell
                      key={d.rawName ?? i}
                      fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                      opacity={isMuted ? 0.35 : 1}
                      style={{
                        transition: 'all 0.25s ease',
                        filter: (isSelected || isHovered) ? 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' : 'none',
                      }}
                    />
                  )
                })}
              </Pie>
              <Tooltip content={<DonutChartTip total={total} />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Central Metric Hole */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
            <div className="w-28 h-28 rounded-full flex flex-col items-center justify-center backdrop-blur-xs bg-white/[0.04] dark:bg-black/40 border border-white/5 shadow-inner">
              <span className="text-[11px] font-semibold text-[#86868B] dark:text-[#98989D] max-w-[100px] truncate mb-0.5">
                {activeItem ? activeItem.name : 'مجموع برگشتی'}
              </span>
              <span className="text-xl md:text-2xl font-black text-[#1D1D1F] dark:text-white tabular-nums tracking-tight">
                {billions1(activeValue)}
              </span>
              <span className="text-[10px] font-bold mt-0.5">
                {activeItem ? (
                  <span className="text-rose-500 dark:text-rose-400 font-extrabold px-1.5 py-0.2 rounded-md bg-rose-500/10">
                    {pct(activePercent / 100, 1)} از کل
                  </span>
                ) : (
                  <span className="text-[#86868B] dark:text-[#98989D]">میلیارد ریال</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {selected && onPick && (
          <button
            type="button"
            onClick={() => onPick('')}
            className="mt-2 text-xs font-bold text-emerald-500 hover:text-emerald-400 underline cursor-pointer transition-colors"
          >
            پاک کردن فیلتر انتخاب ({data.find((d) => d.rawName === selected)?.name})
          </button>
        )}
      </div>

      {/* Left: Ranked Breakdown List with Podium Medals */}
      <div className="lg:col-span-7 flex flex-col h-full justify-center">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs sm:text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
            {title}
          </span>
          <span className="text-[11px] text-[#86868B] dark:text-[#98989D] tabular-nums font-semibold bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-0.5 rounded-full">
            {fa(data.length)} مورد
          </span>
        </div>

        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 exec-hover-scrollbar">
          {data.map((d, i) => {
            const color = DONUT_COLORS[i % DONUT_COLORS.length]
            const isSelected = selected === d.rawName
            const isHovered = hovered?.rawName === d.rawName
            const share = total > 0 ? (d.value / total) * 100 : 0
            const barWidth = maxVal > 0 ? (d.value / maxVal) * 100 : 0

            return (
              <div
                key={d.rawName ?? i}
                onMouseEnter={() => setHovered(d)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onPick && onPick(isSelected ? '' : d.rawName)}
                className={`group relative overflow-hidden rounded-2xl px-3.5 py-2.5 text-xs transition-all border ${
                  onPick ? 'cursor-pointer' : 'cursor-default'
                } ${
                  isSelected
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-bold shadow-sm'
                    : isHovered
                    ? 'bg-black/[0.05] dark:bg-white/[0.08] border-black/[0.08] dark:border-white/10 text-[#1D1D1F] dark:text-white'
                    : 'bg-white/80 dark:bg-black/30 border-black/[0.04] dark:border-white/[0.05] text-[#1D1D1F] dark:text-[#E5E5EA]'
                }`}
              >
                {/* Glowing Translucent Gradient Track */}
                <div
                  className="absolute inset-y-0 right-0 pointer-events-none transition-all duration-300 rounded-2xl"
                  style={{
                    width: `${barWidth}%`,
                    background: `linear-gradient(to left, ${color}30, ${color}08)`,
                  }}
                />

                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Rank badge with podium highlight */}
                    {i === 0 ? (
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-400/40 shrink-0 tabular-nums shadow-xs shadow-amber-500/20">
                        #{fa(1)}
                      </span>
                    ) : i === 1 ? (
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-400/40 shrink-0 tabular-nums shadow-xs shadow-sky-500/20">
                        #{fa(2)}
                      </span>
                    ) : i === 2 ? (
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-400/40 shrink-0 tabular-nums shadow-xs shadow-emerald-500/20">
                        #{fa(3)}
                      </span>
                    ) : (
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-black/[0.05] dark:bg-white/10 text-[#86868B] shrink-0 tabular-nums">
                        {fa(i + 1)}
                      </span>
                    )}

                    {/* Color dot */}
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: color }}
                    />
                    {/* Name */}
                    <span className="font-semibold truncate max-w-[150px] sm:max-w-[210px]" title={d.name}>
                      {d.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 tabular-nums">
                    {/* Value in Rial */}
                    <span className="font-bold text-[#1D1D1F] dark:text-white whitespace-nowrap">
                      {rial(d.value)}
                      <span className="text-[10px] font-normal text-[#86868B] mr-1">ریال</span>
                    </span>
                    {/* Share badge */}
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-black min-w-[46px] text-center border"
                      style={{
                        backgroundColor: `${color}18`,
                        color: color,
                        borderColor: `${color}35`,
                      }}
                    >
                      {pct(share / 100, 1)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* Monthly Trend Bar Chart Component with 3 Bento Cards */
function MonthlyReturnTrend({ rows = [] }) {
  const { isDark } = useAppearance()

  const chartData = useMemo(() => {
    return rows.map((r) => ({
      ym: r.year_month,
      month: monthName(r.year_month),
      fullMonth: monthLabel(r.year_month),
      returnRial: r.return_rial ?? 0,
      orderRial: r.order_rial ?? 0,
      orders: r.orders ?? 0,
      returnedOrders: r.returned_orders ?? 0,
      returnPercent: (r.return_percent ?? 0) * 100,
    }))
  }, [rows])

  const stats = useMemo(() => {
    if (!chartData.length) return null
    const total = chartData.reduce((s, r) => s + r.returnRial, 0)
    const avg = total / chartData.length
    const peak = [...chartData].sort((a, b) => b.returnRial - a.returnRial)[0]
    const latest = chartData[chartData.length - 1]
    return { total, avg, peak, latest }
  }, [chartData])

  if (!chartData.length) return null

  return (
    <div className="space-y-4">
      {/* 3 Executive Highlight KPI Bento Cards - Always 3 Columns on md+ */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Card 1: Peak Month */}
          <div className={`p-4 rounded-3xl border transition-all flex items-center justify-between ${
            isDark
              ? 'bg-rose-500/[0.08] border-rose-500/25 shadow-xs'
              : 'bg-rose-50/80 border-rose-200 shadow-xs'
          }`}>
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                <TrendingUp size={13} />
                <span>ماه اوج برگشتی</span>
              </div>
              <div className="text-base sm:text-lg font-black text-rose-950 dark:text-rose-100 mt-1 tabular-nums">
                {stats.peak.fullMonth}
              </div>
              <div className="text-[11px] text-rose-700/80 dark:text-rose-300/80 mt-0.5 tabular-nums">
                {pct(stats.peak.returnRial / (stats.total || 1), 1)} از کل دوره ۱۸ ماهه
              </div>
            </div>
            <div className="text-left">
              <span className="text-xs sm:text-sm font-black text-rose-700 dark:text-rose-300 tabular-nums px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/25 inline-block shadow-2xs whitespace-nowrap">
                {billions1(stats.peak.returnRial)} م.ر
              </span>
            </div>
          </div>

          {/* Card 2: Average Monthly */}
          <div className={`p-4 rounded-3xl border transition-all flex items-center justify-between ${
            isDark
              ? 'bg-amber-500/[0.08] border-amber-500/25 shadow-xs'
              : 'bg-amber-50/80 border-amber-200 shadow-xs'
          }`}>
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                <BarChart3 size={13} />
                <span>میانگین ماهانه برگشتی</span>
              </div>
              <div className="text-base sm:text-lg font-black text-amber-950 dark:text-amber-100 mt-1 tabular-nums">
                {billions1(stats.avg)} میلیارد ریال
              </div>
              <div className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5 tabular-nums">
                بر اساس {fa(chartData.length)} ماه ثبت‌شده
              </div>
            </div>
            <div className="text-left">
              <span className="text-xs sm:text-sm font-black text-amber-700 dark:text-amber-300 tabular-nums px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/25 inline-block shadow-2xs whitespace-nowrap">
                {fa(chartData.length)} ماه
              </span>
            </div>
          </div>

          {/* Card 3: Latest Month */}
          <div className={`p-4 rounded-3xl border transition-all flex items-center justify-between ${
            isDark
              ? 'bg-sky-500/[0.08] border-sky-500/25 shadow-xs'
              : 'bg-sky-50/80 border-sky-200 shadow-xs'
          }`}>
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-600 dark:text-sky-400">
                <Calendar size={13} />
                <span>آخرین ماه ثبت‌شده</span>
              </div>
              <div className="text-base sm:text-lg font-black text-sky-950 dark:text-sky-100 mt-1 tabular-nums">
                {stats.latest.fullMonth}
              </div>
              <div className="text-[11px] text-sky-700/80 dark:text-sky-300/80 mt-0.5 tabular-nums">
                {stats.avg > 0 ? (
                  stats.latest.returnRial < stats.avg
                    ? `${pct((stats.avg - stats.latest.returnRial) / stats.avg, 0)} پایین‌تر از میانگین (بهبود)`
                    : `${pct((stats.latest.returnRial - stats.avg) / stats.avg, 0)} بالاتر از میانگین`
                ) : 'آخرین داده ثبت‌شده'}
              </div>
            </div>
            <div className="text-left">
              <span className="text-xs sm:text-sm font-black text-sky-700 dark:text-sky-300 tabular-nums px-3 py-1.5 rounded-xl bg-sky-500/15 border border-sky-500/25 inline-block shadow-2xs whitespace-nowrap">
                {billions1(stats.latest.returnRial)} م.ر
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Monthly Trend Bar Chart */}
      <div className={`rounded-3xl border p-5 transition-all ${
        isDark
          ? 'bg-[#0E1512]/90 border-emerald-500/15 shadow-[0_4px_25px_rgba(0,0,0,0.35)]'
          : 'bg-[#F9FAFB] border-slate-200/90 shadow-xs'
      }`}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs shadow-rose-500/50" />
            <span className="text-xs sm:text-sm font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
              روند زمانی مبلغ برگشتی به تفکیک ماه (ریال)
            </span>
          </div>
          <span className="text-xs text-[#86868B] dark:text-[#98989D] tabular-nums font-medium bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-1 rounded-xl">
            از {chartData[0]?.fullMonth} تا {chartData[chartData.length - 1]?.fullMonth}
          </span>
        </div>

        <div className="h-72 w-full" dir="ltr" role="img" aria-label="روند ماهانه برگشتی">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 15, right: 10, left: 10, bottom: 25 }}>
              <defs>
                <linearGradient id="roseBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FB7185" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#E11D48" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="peakBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FDA4AF" stopOpacity={1} />
                  <stop offset="100%" stopColor="#E11D48" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: isDark ? '#98989D' : '#64748B' }}
                interval={0}
                angle={-30}
                textAnchor="end"
              />
              <YAxis
                tick={{ fontSize: 10, fill: isDark ? '#98989D' : '#64748B' }}
                tickFormatter={(v) => `${(v / 1e9).toFixed(0)} م.ر`}
                axisLine={false}
                tickLine={false}
                width={55}
              />
              <Tooltip content={<MonthlyTrendTip total={stats?.total || 0} />} cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }} />
              <Bar
                dataKey="returnRial"
                name="مبلغ برگشتی"
                radius={[8, 8, 2, 2]}
              >
                {chartData.map((d) => {
                  const isPeak = stats && d.ym === stats.peak.ym
                  return (
                    <Cell
                      key={d.ym}
                      fill={isPeak ? 'url(#peakBarGrad)' : 'url(#roseBarGrad)'}
                      style={{
                        filter: isPeak ? 'drop-shadow(0 0 10px rgba(244,63,94,0.5))' : 'none',
                        transition: 'all 0.3s ease',
                      }}
                    />
                  )
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function ViewPanel({ view, s, reason, setReason }) {
  const [monthMode, setMonthMode] = useState('trend')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [showTable, setShowTable] = useState(false)
  const { isDark } = useAppearance()

  if (view === 'month') {
    return (
      <div className="space-y-5">
        {/* Sub-toolbar: Switcher + Toggle Table */}
        <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
          <div className={`inline-flex items-center gap-1 p-1 rounded-2xl border ${
            isDark ? 'bg-black/40 border-white/10' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              type="button"
              onClick={() => setMonthMode('trend')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                monthMode === 'trend'
                  ? (isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-xs' : 'bg-white text-emerald-700 border border-slate-200 shadow-xs')
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 size={13} />
              <span>روند زمانی (میله‌ای)</span>
            </button>
            <button
              type="button"
              onClick={() => setMonthMode('donut')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                monthMode === 'donut'
                  ? (isDark ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-xs' : 'bg-white text-emerald-700 border border-slate-200 shadow-xs')
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PieIcon size={13} />
              <span>سهم ماهانه (دونات)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              showTable
                ? (isDark ? 'bg-white/15 text-white border-white/20' : 'bg-slate-200 text-slate-800 border-slate-300')
                : (isDark ? 'bg-white/5 text-slate-400 hover:text-white border-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200')
            }`}
          >
            <span>{showTable ? 'بستن جدول جزئیات' : 'نمایش جدول داده‌های ماهانه'}</span>
            {showTable ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {monthMode === 'trend' ? (
          <MonthlyReturnTrend rows={s.months} />
        ) : (
          <AppleDonutBreakdown rows={s.months} nameKey="year_month" labelFn={monthName} title="سهم مبلغ برگشتی به تفکیک ماه" />
        )}

        {showTable && (
          <div className="pt-2">
            <Table name="برگشتی-ماهانه" rows={s.months} columns={aggCols({ label: 'ماه', render: (r) => monthName(r.year_month), value: (r) => r.year_month })} />
          </div>
        )}
      </div>
    )
  }

  if (view === 'branch') {
    return (
      <div className="space-y-5">
        <AppleDonutBreakdown
          rows={s.branches}
          nameKey="branch"
          labelFn={(v) => v || 'سایر شعب'}
          selected={selectedBranch}
          onPick={setSelectedBranch}
          title="سهم و رتبه‌بندی برگشتی شعب"
        />
        <Table
          name="برگشتی-شعبه"
          rows={s.branches}
          highlight={(r) => r.branch === selectedBranch}
          onRow={(r) => setSelectedBranch(selectedBranch === r.branch ? '' : r.branch)}
          columns={aggCols({ label: 'شعبه', render: (r) => r.branch ?? '—', value: (r) => String(r.branch ?? '') })}
        />
      </div>
    )
  }

  const total = s.total.return_rial
  return (
    <div className="space-y-5">
      <AppleDonutBreakdown
        rows={s.reasons}
        nameKey="reason"
        labelFn={(v) => v || 'نامشخص'}
        selected={reason}
        onPick={setReason}
        title="سهم و رتبه‌بندی علت‌های برگشت"
      />
      <Table
        name="برگشتی-علت"
        rows={s.reasons}
        highlight={(r) => r.reason === reason}
        onRow={(r) => setReason(reason === r.reason ? '' : r.reason)}
        columns={[
          { label: 'علت برگشت', render: (r) => r.reason || 'نامشخص', value: (r) => String(r.reason || 'نامشخص') },
          { label: 'تعداد حواله', render: (r) => fa(r.orders), value: (r) => r.orders },
          { label: 'مبلغ برگشتی (ریال)', render: (r) => <span className="font-bold text-rose-600 dark:text-rose-400">{rial(r.return_rial)}</span>, value: (r) => r.return_rial },
          { label: 'سهم از کل برگشتی', render: (r) => (total ? pct(r.return_rial / total, 1) : '—'), value: (r) => (total ? (r.return_rial / total) * 100 : 0), unit: '٪' },
        ]}
      />
    </div>
  )
}

function ReturnsTable({ q, openCustomer }) {
  const [page, setPage] = useState(0)
  const r = useApi('/returns/list', { ...q, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
  const { isDark } = useAppearance()

  return (
    <div className="space-y-4">
      {r.error && <div className="banner err" role="alert">دریافت داده ناموفق بود.</div>}
      {r.loading && !r.data && <div className="text-center py-8 text-xs text-[#86868B]">در حال بارگذاری…</div>}
      {r.data && (() => {
        const j = r.data
        if (j.available === false) return <div className="text-center py-8 text-xs text-[#86868B]" role="status">{j.reason}</div>
        const pages = Math.max(1, Math.ceil(j.count / PAGE_SIZE))
        return (
          <>
            <Table name="برگشتی-حواله" rows={j.rows} onRow={openCustomer ? (x) => x.customer_code && openCustomer(x.customer_code) : undefined}
              columns={orderCols([customerCol, { label: 'ویزیتور', render: (x) => x.visitor ?? '—', value: (x) => String(x.visitor ?? '') }])} />
            {j.count > 0 && (
              <div className="flex items-center justify-between pt-3 border-t border-black/[0.04] dark:border-white/[0.06] flex-wrap gap-2">
                <button
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 cursor-pointer ${
                    isDark ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-black/[0.05] hover:bg-black/[0.08] text-[#1D1D1F]'
                  }`}
                  type="button"
                  disabled={page === 0 || r.loading}
                  onClick={() => setPage((n) => n - 1)}
                >
                  صفحهٔ قبل
                </button>
                <span className="text-xs text-[#86868B] dark:text-[#98989D] tabular-nums" role="status" aria-live="polite">
                  صفحهٔ {fa(page + 1)} از {fa(pages)} · {fa(j.count)} حواله
                </span>
                <button
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 cursor-pointer ${
                    isDark ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-black/[0.05] hover:bg-black/[0.08] text-[#1D1D1F]'
                  }`}
                  type="button"
                  disabled={page + 1 >= pages || r.loading}
                  onClick={() => setPage((n) => n + 1)}
                >
                  صفحهٔ بعد
                </button>
              </div>
            )}
          </>
        )
      })()}
    </div>
  )
}

/* Master Executive Returns Page */
export function ReturnsPage({ p, arg, setArg, openCustomer, onReason }) {
  const [view, setView] = useState('month')
  const reason = p.reason ?? ''
  const setReason = (v) => onReason?.(v || null)
  const [status, setStatus] = useState('')
  const scope = useMemo(() => parseScope(arg), [arg])
  const q = { ...p, ...(scope && { [scope.by]: scope.keys }), ...(status && { status }) }
  const sum = useApi('/returns/summary', q)
  const lastOptions = useRef({})
  if (sum.data?.options) lastOptions.current = sum.data.options
  const reasons = lastOptions.current.reason ?? []

  const { isDark } = useAppearance()

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 space-y-6">
      
      {/* 1. Master Executive Hero Card */}
      {sum.data?.total && (
        <div className={`relative overflow-hidden rounded-3xl border p-6 sm:p-8 transition-all ${
          isDark
            ? 'bg-gradient-to-br from-[#121916] via-[#0B100E] to-[#0A0D0C] border-emerald-500/20 shadow-[0_12px_40px_rgba(0,0,0,0.55)]'
            : 'bg-gradient-to-br from-white via-rose-50/20 to-emerald-50/30 border-slate-200/90 shadow-md'
        }`}>
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            {/* Right: Giant Hero Metric */}
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-xs font-bold text-rose-500 dark:text-rose-400">
                  وضعیت جامع برگشتی حواله‌های پخش
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/10 text-[#86868B] dark:text-[#98989D]">
                  مستقل از ردیف‌های مرجوعی فروش (SR)
                </span>
              </div>

              <div>
                <div className="text-xs text-[#86868B] dark:text-[#98989D] font-medium mb-1">
                  مبلغ کل حواله‌های برگشتی ثبت‌شده
                </div>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-3xl sm:text-4xl lg:text-5xl font-black tabular-nums tracking-tight text-[#1D1D1F] dark:text-white">
                    {rial(sum.data.total.return_rial)}
                  </span>
                  <span className="text-sm sm:text-base font-bold text-[#86868B] dark:text-[#98989D]">
                    ریال
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold px-3 py-1 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/25 tabular-nums">
                    {billions1(sum.data.total.return_rial)} میلیارد ریال
                  </span>
                </div>
              </div>

              {/* 3 Frosted Sub-Pills */}
              <div className="flex items-center gap-2.5 flex-wrap pt-1">
                <div className="px-3.5 py-1.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-xs flex items-center gap-2">
                  <span className="text-[#86868B] dark:text-[#98989D]">کل حواله‌ها:</span>
                  <span className="font-bold text-[#1D1D1F] dark:text-white tabular-nums">{fa(sum.data.total.orders)}</span>
                </div>
                <div className="px-3.5 py-1.5 rounded-xl bg-rose-500/[0.08] border border-rose-500/20 text-xs flex items-center gap-2">
                  <span className="text-rose-600 dark:text-rose-400">حواله برگشتی:</span>
                  <span className="font-black text-rose-700 dark:text-rose-300 tabular-nums">
                    {fa(sum.data.total.returned_orders)} ({pct(sum.data.total.returned_order_percent, 2)})
                  </span>
                </div>
                <div className="px-3.5 py-1.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-xs flex items-center gap-2">
                  <span className="text-[#86868B] dark:text-[#98989D]">مشتریان برگشتی:</span>
                  <span className="font-bold text-[#1D1D1F] dark:text-white tabular-nums">{fa(sum.data.total.returned_customers)} مشتری</span>
                </div>
              </div>
            </div>

            {/* Left: Return Rate Badge / Quality Status */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 shrink-0">
              <div className="p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] text-right min-w-[200px]">
                <div className="text-[11px] font-bold text-[#86868B] dark:text-[#98989D] mb-1">
                  نرخ ریالی برگشتی
                </div>
                <div className="text-2xl sm:text-3xl font-black text-amber-500 dark:text-amber-400 tabular-nums">
                  {pct(sum.data.total.return_percent, 2)}
                </div>
                <div className="text-[10px] text-[#86868B] dark:text-[#98989D] mt-0.5">
                  از کل ارزش ریالی حواله‌ها
                </div>
              </div>

              {sum.data?.quality?.negative_return_orders > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-semibold">
                  <ShieldAlert size={14} className="shrink-0" />
                  <span>{fa(sum.data.quality.negative_return_orders)} حواله با ثبت منفی (محاسبه شد)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Unified Glass Floating Toolbar (Dimension Switcher + Filters) */}
      <div className={`rounded-2xl backdrop-blur-xl border p-3.5 sm:p-4 flex items-center justify-between gap-4 flex-wrap transition-all ${
        isDark
          ? 'bg-[#0B100E]/85 border-emerald-500/15 shadow-[0_4px_20px_rgba(0,0,0,0.35)]'
          : 'bg-white/95 border-slate-200/90 shadow-xs'
      }`}>
        {/* Right: Dimension Segmented Control */}
        <div className={`inline-flex items-center gap-1 p-1 rounded-2xl border transition-all ${
          isDark ? 'bg-black/40 border-emerald-500/20' : 'bg-slate-100/90 border-slate-200'
        }`}>
          {VIEWS.map(([k, label, Icon]) => {
            const active = view === k
            return (
              <button
                key={k}
                type="button"
                onClick={() => setView(k)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-500/20'
                    : isDark ? 'text-slate-400 hover:text-slate-100 hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            )
          })}
        </div>

        {/* Left: Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={14} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
            <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>علت برگشت:</span>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={`border rounded-xl px-3 py-1.5 text-xs focus:outline-none transition-all cursor-pointer ${
                isDark
                  ? 'bg-black/40 border-emerald-500/25 text-slate-100 focus:border-emerald-500/60'
                  : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-600'
              }`}
            >
              <option value="">همه علت‌ها</option>
              {reasons.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>وضعیت:</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={`border rounded-xl px-3 py-1.5 text-xs focus:outline-none transition-all cursor-pointer ${
                isDark
                  ? 'bg-black/40 border-emerald-500/25 text-slate-100 focus:border-emerald-500/60'
                  : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-600'
              }`}
            >
              <option value="">همه وضعیت‌ها</option>
              <option value="full">برگشتی کامل</option>
              <option value="partial">برگشتی جزئی</option>
            </select>
          </div>

          {(reason || status) && (
            <button
              className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                isDark
                  ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
              type="button"
              onClick={() => { setReason(''); setStatus('') }}
            >
              پاک کردن فیلترها
            </button>
          )}
        </div>
      </div>

      {scope && (
        <Note>
          <span>فقط حواله‌های {SCOPE_LABELS[scope.by]}: <b dir="auto">{scope.keys.join('، ')}</b></span>
          <button className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/70 hover:bg-white text-[#1D1D1F] mr-auto transition-colors cursor-pointer" type="button" onClick={() => setArg('')}>حذف محدودیت</button>
        </Note>
      )}

      {sum.error && <div className="banner err" role="alert">دریافت خلاصه برگشتی ناموفق بود.</div>}
      {sum.loading && !sum.data && <div className="banner">در حال بارگذاری…</div>}
      {sum.data && (() => {
        const s = sum.data
        if (s.available === false) return <Note>{s.reason}</Note>
        const ignored = (s.ignored_filters ?? []).map((k) => IGNORED_LABELS[k] ?? k)
        return (
          <>
            {ignored.length > 0 && <Note>فیلتر {ignored.join('، ')} روی حواله پخش قابل اعمال نیست و نادیده گرفته شد.</Note>}
            
            {/* 3. Main Dimensional Analysis Section */}
            <AppleCard
              title={
                view === 'month' ? 'تحلیل روند زمانی و سهم ماهانه برگشتی' :
                view === 'branch' ? 'تحلیل و رتبه‌بندی برگشتی بر تفکیک شعب' :
                'تحلیل سهم و رتبه‌بندی علت‌های برگشت حواله'
              }
              subtitle="مبالغ به ریال · مبالغ بدون پروموشن و مرجوعی داخلی"
            >
              <ViewPanel view={view} s={s} reason={reason} setReason={setReason} />
            </AppleCard>

            {/* 4. Top Return Customers and Visitors */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full items-start">
              {scope?.by !== 'customer' && s.customers.length > 0 && (
                <AppleCard title="مشتریان با بیشترین برگشتی" subtitle="۱۵ مشتری برتر بر پایه مبلغ برگشتی">
                  <Table name="برگشتی-مشتریان" rows={s.customers} onRow={openCustomer ? (x) => x.code && openCustomer(x.code) : undefined}
                    columns={aggCols({ label: 'مشتری', render: (x) => `${x.code} · ${x.name ?? ''}`, value: (x) => `${x.code} ${x.name ?? ''}` })} />
                </AppleCard>
              )}
              {scope?.by !== 'visitor' && s.visitors.length > 0 && (
                <AppleCard title="ویزیتورهای دارای برگشتی" subtitle="۱۵ ویزیتور برتر بر پایه مبلغ برگشتی">
                  <Table name="برگشتی-ویزیتورها" rows={s.visitors} columns={aggCols({ label: 'ویزیتور', render: (x) => x.visitor, value: (x) => String(x.visitor) })} />
                </AppleCard>
              )}
            </div>
          </>
        )
      })()}

      {/* 5. Detailed Orders Table */}
      <AppleCard title="فهرست حواله‌های برگشتی" subtitle="جدیدترین حواله‌ها اول">
        <ReturnsTable key={JSON.stringify(q)} q={q} openCustomer={openCustomer} />
      </AppleCard>
    </div>
  )
}

/* کارت برگشتی در پروفایل مشتری و ویزیتور؛ data همان فیلد dispatch_returns پاسخ API است. */
export function ReturnsProfileCard({ data, onOpen, entity }) {
  const title = 'برگشتی حواله پخش'
  const activeReason = new URLSearchParams(location.hash.split('?')[1] || '').get('reason') || ''
  if (!data?.available) {
    return (
      <AppleCard title={title}>
        <div className="text-center py-8 text-xs text-[#86868B]" role="status">داده برگشتی حواله هنوز بارگذاری نشده است.</div>
      </AppleCard>
    )
  }
  const t = data.total
  const ambiguous = data.ambiguous_names ?? []
  return (
    <AppleCard
      title={title}
      subtitle={activeReason ? `فیلتر علت: ${activeReason} · مستقل از ردیف‌های مرجوعی فروش (SR)` : `مستقل از ردیف‌های مرجوعی فروش (SR)`}
      action={
        onOpen && (
          <button
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-sm shadow-emerald-500/25 transition-all cursor-pointer"
            type="button"
            onClick={onOpen}
          >
            <ExternalLink size={13} />
            <span>مشاهده در گزارش برگشتی</span>
          </button>
        )
      }
    >
      {data.note && <Note>{data.note}</Note>}
      {ambiguous.length > 0 && <Note tone="err">نام‌های مشترک بین چند کد ویزیتور در مجموع نیامده‌اند: {ambiguous.join('، ')}</Note>}
      {!t.orders ? <div className="text-center py-8 text-xs text-[#86868B]" role="status">برای این {entity} حواله‌ای ثبت نشده است.</div> : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            <div className="p-3.5 rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] border-black/[0.05] dark:border-white/[0.06]">
              <div className="text-[11px] text-[#86868B]">تعداد حواله</div>
              <div className="text-lg font-bold tabular-nums text-[#1D1D1F] dark:text-white mt-1">{fa(t.orders)}</div>
            </div>
            <div className="p-3.5 rounded-2xl border bg-rose-500/10 border-rose-500/20">
              <div className="text-[11px] text-rose-600 dark:text-rose-400">حواله برگشتی</div>
              <div className="text-lg font-bold tabular-nums text-rose-700 dark:text-rose-300 mt-1">{fa(t.returned_orders)}</div>
            </div>
            <div className="p-3.5 rounded-2xl border bg-amber-500/10 border-amber-500/20">
              <div className="text-[11px] text-amber-600 dark:text-amber-400">مبلغ برگشتی</div>
              <div className="text-lg font-bold tabular-nums text-amber-700 dark:text-amber-300 mt-1">{rial(t.return_rial)}</div>
            </div>
            <div className="p-3.5 rounded-2xl border bg-emerald-500/10 border-emerald-500/20">
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400">درصد برگشتی</div>
              <div className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300 mt-1">{pct(t.return_percent, 2)}</div>
            </div>
          </div>
          {data.reasons?.length > 0 && (
            <Table name="برگشتی-علت‌ها" rows={data.reasons} columns={[
              { label: 'علت برگشت', render: (r) => r.reason, value: (r) => String(r.reason) },
              { label: 'تعداد حواله', render: (r) => fa(r.orders), value: (r) => r.orders },
              { label: 'مبلغ برگشتی (ریال)', render: (r) => <span className="font-bold text-rose-600 dark:text-rose-400">{rial(r.return_rial)}</span>, value: (r) => r.return_rial },
            ]} />
          )}
          {data.recent?.length > 0 && (
            <div className="pt-2">
              <h3 className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7] mb-2">آخرین حواله‌های برگشتی</h3>
              <Table name="برگشتی-اخیر" rows={data.recent} columns={orderCols()} />
            </div>
          )}
        </div>
      )}
    </AppleCard>
  )
}

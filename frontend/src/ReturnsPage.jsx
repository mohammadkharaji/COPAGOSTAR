import { useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CircleAlert, CircleMinus, ExternalLink, Info, Undo2, CircleDollarSign, Calendar, Users, FileText, BarChart3, PieChart as PieIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useApi } from './api'
import { useAppearance } from './AppearanceContext'
import { fa, monthName, monthLabel, billions1 } from './format'
import { ChartTip, Table, pct, rial } from './ui'

/* برگشتی حواله پخش: داده از فایل حواله می‌آید و با ردیف‌های مرجوعی داخل فروش (SR) جمع نمی‌شود. */

const PAGE_SIZE = 50
const VIEWS = [['month', 'ماه'], ['branch', 'شعبه'], ['reason', 'علت برگشت']]
const STATUS = {
  full: { label: 'برگشتی کامل', Icon: CircleAlert, color: '#dc2626' },
  partial: { label: 'برگشتی جزئی', Icon: CircleMinus, color: '#d97706' },
}
const IGNORED_LABELS = { sales_type: 'کانال فروش', region: 'منطقه', state: 'منطقه شهرداری', city: 'شهر', brand: 'برند', group: 'لاین', grade: 'گرید مشتری', main_group: 'گروه کالای اصلی', sub_group: 'زیرگروه کالای اصلی' }
const SCOPE_LABELS = { customer: 'مشتری', visitor: 'ویزیتور' }

export const returnsArg = (by, keys) => `${by}~${[].concat(keys).join('|')}`
function parseScope(arg) {
  const i = (arg ?? '').indexOf('~')
  if (i < 1) return null
  const by = arg.slice(0, i)
  const keys = arg.slice(i + 1).split('|').filter(Boolean)
  return SCOPE_LABELS[by] && keys.length ? { by, keys } : null
}

function AppleCard({ title, subtitle, badge, action, children, className = '' }) {
  const { isDark, isSolid } = useAppearance()
  return (
    <div
      className={`apple-card rounded-2xl sm:rounded-3xl border transition-all p-4 sm:p-6 overflow-hidden w-full max-w-full ${
        isDark
          ? 'bg-[#0B100E]/75 backdrop-blur-2xl border-emerald-500/15 text-[#F5F5F7] shadow-[0_8px_30px_rgba(0,0,0,0.45)]'
          : isSolid
          ? 'bg-white border-slate-200 text-[#1D1D1F] shadow-xs'
          : 'bg-white/90 backdrop-blur-xl border-slate-200/80 text-[#1D1D1F] shadow-[0_8px_30px_rgb(0,0,0,0.04)]'
      } ${className}`}
    >
      {(title || subtitle || badge || action) && (
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            {title && <h2 className={`text-sm sm:text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{title}</h2>}
            {subtitle && <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {badge && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
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

function AppleKpiCard({ label, value, unit, icon: Icon, tone = 'teal' }) {
  const { isDark, isSolid } = useAppearance()
  const tones = {
    blue: isDark ? 'bg-sky-500/15 text-sky-400 border border-sky-500/25' : 'bg-sky-50 text-sky-700',
    teal: isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-emerald-50 text-emerald-700',
    amber: isDark ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' : 'bg-amber-50 text-amber-700',
    violet: isDark ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25' : 'bg-purple-50 text-purple-700',
    pink: isDark ? 'bg-pink-500/15 text-pink-400 border border-pink-500/25' : 'bg-pink-50 text-pink-700',
    green: isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-emerald-50 text-emerald-700',
    red: isDark ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25' : 'bg-rose-50 text-rose-700',
  }
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`apple-kpi-card rounded-2xl border transition-all p-3 sm:p-4 flex flex-col justify-between text-right ${
        isDark
          ? 'bg-[#0B100E]/80 backdrop-blur-xl border-emerald-500/15 text-[#F5F5F7] shadow-[0_4px_20px_rgba(0,0,0,0.35)] hover:border-emerald-500/30'
          : isSolid
          ? 'bg-white border-slate-200 text-[#1D1D1F] shadow-xs hover:shadow-md'
          : 'bg-white/90 backdrop-blur-xl border-slate-200/80 text-[#1D1D1F] shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_25px_rgb(0,0,0,0.06)]'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[11px] sm:text-xs font-medium truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 ${tones[tone] || tones.teal}`}>
          {Icon ? <Icon size={14} className="sm:w-4 sm:h-4" /> : null}
        </div>
      </div>
      <div>
        <div className={`text-base sm:text-xl font-sans font-bold tracking-tight tabular-nums truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{value}</div>
        <div className={`text-[10px] sm:text-[11px] mt-0.5 truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{unit}</div>
      </div>
    </motion.div>
  )
}

function StatusBadge({ s }) {
  const m = STATUS[s]
  if (!m) return <span className="text-xs text-[#86868B]">بدون برگشتی</span>
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
      s === 'full' ? 'bg-rose-500/15 text-rose-700' : 'bg-amber-500/15 text-amber-700'
    }`}>
      <m.Icon size={12} aria-hidden="true" />
      <span>{m.label}</span>
    </span>
  )
}

function Note({ children, tone }) {
  const isErr = tone === 'err'
  return (
    <div className={`rounded-2xl p-4 text-xs font-medium flex items-center gap-2.5 flex-wrap ${
      isErr ? 'bg-rose-500/10 border border-rose-500/20 text-rose-800' : 'bg-[#0071E3]/10 border border-[#0071E3]/20 text-[#0071E3]'
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
  { label: 'مبلغ برگشتی (ریال)', render: (r) => <span className="tabular-nums font-bold text-rose-700">{rial(r.return_rial)}</span>, value: (r) => r.return_rial },
  { label: 'وضعیت', render: (r) => <StatusBadge s={r.status} />, value: (r) => STATUS[r.status]?.label ?? 'بدون برگشتی' },
  { label: 'علت برگشت', render: (r) => r.reason ?? 'نامشخص', value: (r) => String(r.reason ?? 'نامشخص') },
]
const customerCol = { label: 'مشتری', render: (r) => (r.customer_code ? `${r.customer_code} · ${r.customer_name ?? ''}` : '—'), value: (r) => `${r.customer_code ?? ''} ${r.customer_name ?? ''}` }

const DONUT_COLORS = [
  '#0071E3', // Apple Blue
  '#F43F5E', // Rose
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
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

function AppleDonutBreakdown({
  rows = [],
  nameKey,
  labelFn = (v) => String(v ?? '—'),
  selected = '',
  onPick,
  title = 'تفکیک و سهم برگشتی',
}) {
  const [hovered, setHovered] = useState(null)

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
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center bg-[#F9F9FB] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06] rounded-3xl p-5 md:p-6 shadow-xs">
        
        {/* Right / Center: Signature Apple Donut with Central Metrics */}
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
                  innerRadius={76}
                  outerRadius={114}
                  paddingAngle={data.length > 1 ? 3 : 0}
                  cornerRadius={5}
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
                          filter: (isSelected || isHovered) ? 'drop-shadow(0 4px 10px rgba(0,0,0,0.15))' : 'none',
                        }}
                      />
                    )
                  })}
                </Pie>
                <Tooltip
                  content={
                    <ChartTip
                      labelFn={(v) => {
                        const item = data.find((d) => d.name === v)
                        const pctStr = total > 0 ? pct((item?.value ?? 0) / total, 1) : '—'
                        return `${v} (${pctStr})`
                      }}
                      valueFn={(val) => `${rial(val)} ریال (${billions1(val)} میلیارد ریال)`}
                    />
                  }
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Central Metric Typography (Inside Donut Hole) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
              <span className="text-[11px] font-semibold text-[#86868B] dark:text-[#98989D] max-w-[130px] truncate mb-0.5">
                {activeItem ? activeItem.name : 'مبلغ کل برگشتی'}
              </span>
              <span className="text-xl md:text-2xl font-black text-[#1D1D1F] dark:text-white tabular-nums tracking-tight">
                {billions1(activeValue)}
              </span>
              <span className="text-[11px] font-bold text-[#86868B] dark:text-[#98989D] mt-0.5">
                {activeItem ? (
                  <span className="text-rose-600 font-extrabold">{pct(activePercent / 100, 1)} از کل</span>
                ) : (
                  'میلیارد ریال'
                )}
              </span>
            </div>
          </div>

          {selected && onPick && (
            <button
              type="button"
              onClick={() => onPick('')}
              className="mt-1 text-xs font-semibold text-[#0071E3] hover:underline"
            >
              پاک کردن فیلتر ({data.find((d) => d.rawName === selected)?.name})
            </button>
          )}
        </div>

        {/* Left: Ranked Interactive Breakdown List */}
        <div className="lg:col-span-7 flex flex-col h-full justify-center">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
              {title}
            </span>
            <span className="text-[11px] text-[#86868B] tabular-nums font-semibold">
              {fa(data.length)} مورد
            </span>
          </div>

          <div className="max-h-[290px] overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
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
                  className={`group relative overflow-hidden rounded-2xl px-3 py-2 text-xs transition-all border ${
                    onPick ? 'cursor-pointer' : 'cursor-default'
                  } ${
                    isSelected
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400 font-semibold shadow-xs'
                      : isHovered
                      ? 'bg-black/[0.04] dark:bg-white/[0.06] border-black/[0.06] text-[#1D1D1F] dark:text-white'
                      : 'bg-white/80 dark:bg-black/20 border-black/[0.03] dark:border-white/[0.04] text-[#1D1D1F] dark:text-[#E5E5EA]'
                  }`}
                >
                  {/* Subtle Background Progress Bar */}
                  <div
                    className="absolute inset-y-0 right-0 pointer-events-none transition-all duration-300 opacity-15"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: color,
                    }}
                  />

                  <div className="relative flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Rank badge */}
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-black/[0.05] dark:bg-white/10 text-[#86868B] shrink-0 tabular-nums">
                        {fa(i + 1)}
                      </span>
                      {/* Color dot */}
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: color }}
                      />
                      {/* Name */}
                      <span className="font-medium truncate max-w-[160px] sm:max-w-[220px]" title={d.name}>
                        {d.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 tabular-nums">
                      {/* Value in Rial */}
                      <span className="font-bold text-[#1D1D1F] dark:text-white">
                        {rial(d.value)}
                        <span className="text-[10px] font-normal text-[#86868B] mr-1">ریال</span>
                      </span>
                      {/* Share badge */}
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-extrabold min-w-[42px] text-center"
                        style={{
                          backgroundColor: `${color}18`,
                          color: color,
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
    </div>
  )
}

function MonthlyReturnTrend({ rows = [] }) {
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
      {/* 3 Quick Highlight Pills */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-rose-500/[0.07] border border-rose-500/20 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-rose-700">ماه اوج برگشتی</div>
              <div className="text-sm font-black text-rose-900 mt-0.5 tabular-nums">
                {stats.peak.fullMonth}
              </div>
            </div>
            <span className="text-xs font-bold text-rose-700 tabular-nums px-2.5 py-1 rounded-xl bg-rose-500/15">
              {billions1(stats.peak.returnRial)} م.ر
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-500/[0.07] border border-amber-500/20 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-amber-700">میانگین ماهانه برگشتی</div>
              <div className="text-sm font-black text-amber-900 mt-0.5 tabular-nums">
                {billions1(stats.avg)} میلیارد ریال
              </div>
            </div>
            <span className="text-xs font-bold text-amber-700 tabular-nums px-2.5 py-1 rounded-xl bg-amber-500/15">
              {fa(chartData.length)} ماه
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-blue-500/[0.07] border border-blue-500/20 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-blue-700">آخرین ماه ثبت‌شده</div>
              <div className="text-sm font-black text-blue-900 mt-0.5 tabular-nums">
                {stats.latest.fullMonth}
              </div>
            </div>
            <span className="text-xs font-bold text-blue-700 tabular-nums px-2.5 py-1 rounded-xl bg-blue-500/15">
              {billions1(stats.latest.returnRial)} م.ر
            </span>
          </div>
        </div>
      )}

      {/* Main Monthly Trend Bar Chart */}
      <div className="bg-[#F9F9FB] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06] rounded-3xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
            روند مبلغ برگشتی به تفکیک ماه (ریال)
          </span>
          <span className="text-[11px] text-[#86868B] tabular-nums font-semibold">
            از {chartData[0]?.fullMonth} تا {chartData[chartData.length - 1]?.fullMonth}
          </span>
        </div>

        <div className="h-72 w-full" dir="ltr" role="img" aria-label="روند ماهانه برگشتی">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#00000010" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#86868B' }}
                interval={0}
                angle={-30}
                textAnchor="end"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#86868B' }}
                tickFormatter={(v) => `${(v / 1e9).toFixed(0)} م.ر`}
                axisLine={false}
                tickLine={false}
                width={55}
              />
              <Tooltip
                content={
                  <ChartTip
                    labelFn={(label) => {
                      const item = chartData.find((d) => d.month === label)
                      return item ? item.fullMonth : label
                    }}
                    valueFn={(val) => `${rial(val)} ریال (${billions1(val)} میلیارد ریال)`}
                  />
                }
              />
              <Bar
                dataKey="returnRial"
                name="مبلغ برگشتی"
                radius={[6, 6, 0, 0]}
              >
                {chartData.map((d) => {
                  const isPeak = stats && d.ym === stats.peak.ym
                  return (
                    <Cell
                      key={d.ym}
                      fill={isPeak ? '#E11D48' : '#F43F5E'}
                      opacity={isPeak ? 1 : 0.85}
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

const aggCols = (first) => [
  first,
  { label: 'تعداد حواله', render: (r) => fa(r.orders), value: (r) => r.orders },
  { label: 'حواله برگشتی', render: (r) => fa(r.returned_orders), value: (r) => r.returned_orders },
  { label: 'مبلغ حواله (ریال)', render: (r) => rial(r.order_rial), value: (r) => r.order_rial },
  { label: 'مبلغ برگشتی (ریال)', render: (r) => <span className="font-bold text-rose-700">{rial(r.return_rial)}</span>, value: (r) => r.return_rial },
  { label: 'درصد برگشتی', render: (r) => <span className="font-bold text-amber-700">{pct(r.return_percent, 2)}</span>, value: (r) => r.return_percent * 100, unit: '٪' },
]

function ViewPanel({ view, s, reason, setReason }) {
  const [monthMode, setMonthMode] = useState('trend')
  const [selectedBranch, setSelectedBranch] = useState('')

  if (view === 'month') {
    return (
      <div className="space-y-4">
        {/* Toggle between Trend Bar Chart and Donut Share */}
        <div className="flex items-center justify-end">
          <div className="inline-flex items-center gap-1 p-1 bg-[#E8E8ED]/80 dark:bg-white/10 rounded-2xl">
            <button
              type="button"
              onClick={() => setMonthMode('trend')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                monthMode === 'trend'
                  ? 'bg-white dark:bg-black text-[#1D1D1F] dark:text-white shadow-xs'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
            >
              <BarChart3 size={13} />
              <span>روند زمانی (میله‌ای)</span>
            </button>
            <button
              type="button"
              onClick={() => setMonthMode('donut')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                monthMode === 'donut'
                  ? 'bg-white dark:bg-black text-[#1D1D1F] dark:text-white shadow-xs'
                  : 'text-[#86868B] hover:text-[#1D1D1F]'
              }`}
            >
              <PieIcon size={13} />
              <span>سهم ماهانه (دونات)</span>
            </button>
          </div>
        </div>

        {monthMode === 'trend' ? (
          <MonthlyReturnTrend rows={s.months} />
        ) : (
          <AppleDonutBreakdown rows={s.months} nameKey="year_month" labelFn={monthName} title="سهم مبلغ برگشتی به تفکیک ماه" />
        )}

        <Table name="برگشتی-ماهانه" rows={s.months} columns={aggCols({ label: 'ماه', render: (r) => monthName(r.year_month), value: (r) => r.year_month })} />
      </div>
    )
  }

  if (view === 'branch') {
    return (
      <div className="space-y-4">
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
    <div className="space-y-4">
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
          { label: 'مبلغ برگشتی (ریال)', render: (r) => <span className="font-bold text-rose-700">{rial(r.return_rial)}</span>, value: (r) => r.return_rial },
          { label: 'سهم از کل برگشتی', render: (r) => (total ? pct(r.return_rial / total, 1) : '—'), value: (r) => (total ? (r.return_rial / total) * 100 : 0), unit: '٪' },
        ]}
      />
    </div>
  )
}

function ReturnsTable({ q, openCustomer }) {
  const [page, setPage] = useState(0)
  const r = useApi('/returns/list', { ...q, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
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
              <div className="flex items-center justify-between pt-3 border-t border-black/[0.04]">
                <button className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-black/[0.05] hover:bg-black/[0.08] text-[#1D1D1F] disabled:opacity-40" type="button" disabled={page === 0 || r.loading} onClick={() => setPage((n) => n - 1)}>صفحهٔ قبل</button>
                <span className="text-xs text-[#86868B]" role="status" aria-live="polite">صفحهٔ {fa(page + 1)} از {fa(pages)} · {fa(j.count)} حواله</span>
                <button className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-black/[0.05] hover:bg-black/[0.08] text-[#1D1D1F] disabled:opacity-40" type="button" disabled={page + 1 >= pages || r.loading} onClick={() => setPage((n) => n + 1)}>صفحهٔ بعد</button>
              </div>
            )}
          </>
        )
      })()}
    </div>
  )
}

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
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 space-y-5">
      {/* Dark Emerald Floating Glass Filter Bar */}
      <div className={`rounded-2xl backdrop-blur-xl border p-3 sm:p-4 flex items-center justify-between gap-4 flex-wrap ${
        isDark
          ? 'bg-[#0B100E]/75 border-emerald-500/15 shadow-[0_4px_20px_rgba(0,0,0,0.35)]'
          : 'bg-white/90 border-slate-200/80 shadow-xs'
      }`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>علت برگشت:</span>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={`border rounded-xl px-3 py-1.5 text-xs focus:outline-none transition-all ${
                isDark
                  ? 'bg-black/30 border-emerald-500/20 text-slate-100 focus:border-emerald-500/50'
                  : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-600'
              }`}
            >
              <option value="">همه علت‌ها</option>
              {reasons.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>وضعیت برگشت:</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={`border rounded-xl px-3 py-1.5 text-xs focus:outline-none transition-all ${
                isDark
                  ? 'bg-black/30 border-emerald-500/20 text-slate-100 focus:border-emerald-500/50'
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
              className={`text-xs font-semibold px-3 py-1 rounded-xl transition-colors ${
                isDark
                  ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/20'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
              type="button"
              onClick={() => { setReason(''); setStatus('') }}
            >
              پاک کردن فیلترها
            </button>
          )}
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
          isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          حواله‌های پخش
        </span>
      </div>

      {scope && (
        <Note>
          <span>فقط حواله‌های {SCOPE_LABELS[scope.by]}: <b dir="auto">{scope.keys.join('، ')}</b></span>
          <button className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/70 hover:bg-white text-[#1D1D1F] mr-auto transition-colors" type="button" onClick={() => setArg('')}>حذف محدودیت</button>
        </Note>
      )}

      {sum.error && <div className="banner err" role="alert">دریافت خلاصه برگشتی ناموفق بود.</div>}
      {sum.loading && !sum.data && <div className="banner">در حال بارگذاری…</div>}
      {sum.data && (() => {
        const s = sum.data
        if (s.available === false) return <Note>{s.reason}</Note>
        const t = s.total
        const ignored = (s.ignored_filters ?? []).map((k) => IGNORED_LABELS[k] ?? k)
        return (
          <>
            {ignored.length > 0 && <Note>فیلتر {ignored.join('، ')} روی حواله پخش قابل اعمال نیست و نادیده گرفته شد.</Note>}
            {s.quality?.negative_return_orders > 0 && <Note tone="err">{fa(s.quality.negative_return_orders)} حواله مبلغ برگشتی منفی دارد؛ جمع‌ها را با احتیاط بخوانید.</Note>}
            {!t.orders ? <AppleCard><div className="text-center py-10 text-xs text-[#86868B]" role="status">برای این فیلترها حواله‌ای وجود ندارد.</div></AppleCard> : (
              <>
                {/* 4 Compact Dark Emerald KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 w-full">
                  <AppleKpiCard label="تعداد حواله کل" value={fa(t.orders)} unit="حواله صادرشده" icon={FileText} tone="blue" />
                  <AppleKpiCard label="حواله‌های برگشتی" value={fa(t.returned_orders)} unit={`${pct(t.returned_order_percent, 2)} از کل حواله‌ها`} icon={Undo2} tone="red" />
                  <AppleKpiCard label="مبلغ کل برگشتی" value={rial(t.return_rial)} unit="ریال" icon={CircleDollarSign} tone="amber" />
                  <AppleKpiCard label="درصد مبلغ برگشتی" value={pct(t.return_percent, 2)} unit={`مشتریان دارای برگشت: ${fa(t.returned_customers)}`} icon={Users} tone="teal" />
                </div>

                {/* Analysis Bento Card */}
                <AppleCard
                  title="تحلیل ابعادی برگشتی حواله"
                  subtitle="مبلغ برگشتی بر اساس بعد انتخابی · ریال"
                  badge={VIEWS.find(([k]) => k === view)?.[1]}
                  action={
                    <div className={`flex items-center gap-1 p-1 rounded-xl flex-wrap ${isDark ? 'bg-black/30' : 'bg-slate-100'}`}>
                      {VIEWS.map(([k, label]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setView(k)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            view === k
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
                              : isDark ? 'text-slate-300 hover:text-white hover:bg-white/5' : 'text-slate-700 hover:bg-white'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  }
                >
                  <ViewPanel view={view} s={s} reason={reason} setReason={setReason} />
                </AppleCard>

                {/* Top Return Customers and Visitors */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full items-start">
                  {scope?.by !== 'customer' && s.customers.length > 0 && (
                    <AppleCard title="مشتریان با بیشترین برگشتی" subtitle="۱۵ مشتری برتر بر اساس مبلغ برگشتی">
                      <Table name="برگشتی-مشتریان" rows={s.customers} onRow={openCustomer ? (x) => x.code && openCustomer(x.code) : undefined}
                        columns={aggCols({ label: 'مشتری', render: (x) => `${x.code} · ${x.name ?? ''}`, value: (x) => `${x.code} ${x.name ?? ''}` })} />
                    </AppleCard>
                  )}
                  {scope?.by !== 'visitor' && s.visitors.length > 0 && (
                    <AppleCard title="ویزیتورها" subtitle="۱۵ ویزیتور برتر بر پایهٔ نام ویزیتور">
                      <Table name="برگشتی-ویزیتورها" rows={s.visitors} columns={aggCols({ label: 'ویزیتور', render: (x) => x.visitor, value: (x) => String(x.visitor) })} />
                    </AppleCard>
                  )}
                </div>
              </>
            )}
          </>
        )
      })()}

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
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-sm shadow-blue-500/25 transition-all"
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
            <AppleKpiCard label="تعداد حواله" value={fa(t.orders)} unit="حواله" icon={FileText} tone="blue" />
            <AppleKpiCard label="حواله برگشتی" value={fa(t.returned_orders)} unit={`${pct(t.returned_order_percent, 2)} از حواله‌ها`} icon={Undo2} tone="red" />
            <AppleKpiCard label="مبلغ برگشتی" value={rial(t.return_rial)} unit="ریال" icon={CircleDollarSign} tone="amber" />
            <AppleKpiCard label="درصد برگشتی" value={pct(t.return_percent, 2)} unit="مبلغ برگشتی ÷ مبلغ حواله" icon={Users} tone="teal" />
          </div>
          {data.reasons?.length > 0 && (
            <Table name="برگشتی-علت‌ها" rows={data.reasons} columns={[
              { label: 'علت برگشت', render: (r) => r.reason, value: (r) => String(r.reason) },
              { label: 'تعداد حواله', render: (r) => fa(r.orders), value: (r) => r.orders },
              { label: 'مبلغ برگشتی (ریال)', render: (r) => <span className="font-bold text-rose-700">{rial(r.return_rial)}</span>, value: (r) => r.return_rial },
            ]} />
          )}
          {data.recent?.length > 0 && (
            <div className="pt-2">
              <h3 className="text-xs font-bold text-[#1D1D1F] mb-2">آخرین حواله‌های برگشتی</h3>
              <Table name="برگشتی-اخیر" rows={data.recent} columns={orderCols()} />
            </div>
          )}
        </div>
      )}
    </AppleCard>
  )
}

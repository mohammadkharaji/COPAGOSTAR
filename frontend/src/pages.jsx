import { useEffect, useMemo, useRef, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { motion } from 'motion/react'
import { CircleDollarSign, Calendar, TrendingUp, TrendingDown, Users, Award, BarChart3, PieChart as PieIcon, Activity, FileText, Send, UserRound, UserCheck, Layers, Store, ShoppingBag, Package, RotateCcw, CheckCircle2, RefreshCw, Server, Clock, Database, ChevronDown, ChevronUp, Search, MapPin, Percent } from 'lucide-react'
import { postJson, useApi } from './api'
import { useAppearance } from './AppearanceContext'
import { dayLabel, fa, fa2, monthLabel, monthName } from './format'
import { ChartTip, Kpi, Panel, Status, Table, Toggle, pct, rial } from './ui'
import { ReturnsProfileCard, returnsArg } from './ReturnsPage'

export { ReturnsPage } from './ReturnsPage'
export { TicketsPage } from './TicketsPage'
export { HealthPage } from './HealthPage'
export { ParetoPage, PARETO_NAMES } from './ParetoPage'
export { PotentialCustomersPage, InactiveCustomersPage, INACTIVE_PAGE_SIZE, INACTIVE_DAYS } from './InactiveCustomersPage'

const faDate = (k) => (/^\d{8}$/.test(String(k)) ? `${String(k).slice(0, 4)}/${String(k).slice(4, 6)}/${String(k).slice(6)}` : k)
const billions = (v) => v / 1e9

function Bars({ data, x, bars, tickFn, unit = 'میلیارد ریال', tall, onBar, active }) {
  return (
    <div className={`chart ${tall ? 'tall' : ''}`} role="img">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey={x} reversed tickFormatter={tickFn} tickLine={false} axisLine={false} interval={0} angle={data.length > 10 ? -35 : 0} textAnchor={data.length > 10 ? 'end' : 'middle'} height={data.length > 10 ? 70 : 30} />
          <YAxis orientation="right" tickFormatter={(v) => (v % 1 === 0 && Math.abs(v) >= 10 ? fa(v) : Number(v).toLocaleString('fa-IR', { maximumFractionDigits: 2 }))} tickLine={false} axisLine={false} width={64} />
          <Tooltip content={<ChartTip labelFn={tickFn} unit={unit} />} cursor={{ fill: 'rgba(16,37,63,.05)' }} />
          {bars.length > 1 && <Legend />}
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[4, 4, 0, 0]} onClick={onBar} cursor={onBar ? 'pointer' : undefined}>
              {active && data.map((d) => <Cell key={d[x]} fill={!active || d[x] === active ? b.color : 'var(--ink-dim)'} />)}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ---------- تحلیل تعداد کالا (خالص از مرجوعی - Dark Emerald Matte) ---------- */
const pctChange = (v) => (v == null ? '—' : `${v > 0 ? '▲' : '▼'} ${fa(Math.abs(v * 100).toFixed(1))}٪`)

/* Tooltip for Quantity Monthly Growth Trend */
function QuantityMonthTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="backdrop-blur-xl border border-white/10 dark:bg-[#141A18]/95 bg-slate-900/95 text-white rounded-2xl p-3.5 shadow-2xl min-w-[220px] text-right pointer-events-none select-none z-50">
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/10">
        <span className="font-bold text-xs text-white">{d.label}</span>
        {d.growth != null && (
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border tabular-nums ${
            d.growth >= 0
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
          }`}>
            {d.growth > 0 ? `+${fa(d.growth)}٪` : `${fa(d.growth)}٪`}
          </span>
        )}
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between text-slate-300 gap-2">
          <span className="text-[11px]">تعداد خالص کالا:</span>
          <span className="font-bold text-emerald-400 tabular-nums whitespace-nowrap">{fa(d.net_qty)} <span className="text-[10px] text-slate-400 font-normal">عدد</span></span>
        </div>
        {d.net_rial > 0 && (
          <div className="flex items-center justify-between text-slate-300 text-[11px] gap-2">
            <span>فروش خالص:</span>
            <span className="font-extrabold text-amber-300 tabular-nums whitespace-nowrap">{billions(d.net_rial).toFixed(1)} میلیارد ریال</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* Tooltip for Top Products Bar Chart */
function ProductBarTip({ active, payload, totalTopQty }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const share = totalTopQty > 0 ? pct(d.net_qty / totalTopQty, 1) : '—'
  return (
    <div className="backdrop-blur-xl border border-white/10 dark:bg-[#141A18]/95 bg-slate-900/95 text-white rounded-2xl p-3.5 shadow-2xl min-w-[240px] text-right pointer-events-none select-none z-50">
      <div className="font-bold text-xs text-white pb-2 mb-2 border-b border-white/10 truncate">
        {d.product}
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between text-slate-300 gap-2">
          <span className="text-[11px]">تعداد خالص:</span>
          <span className="font-bold text-emerald-400 tabular-nums whitespace-nowrap">{fa(d.net_qty)} <span className="text-[10px] text-slate-400 font-normal">عدد</span></span>
        </div>
        <div className="flex items-center justify-between text-slate-300 text-[11px] gap-2">
          <span>سهم از ۲۰ برتر:</span>
          <span className="font-bold text-sky-300 tabular-nums">{share}</span>
        </div>
        <div className="flex items-center justify-between text-slate-300 text-[11px] gap-2">
          <span>فروش خالص:</span>
          <span className="font-bold text-white tabular-nums">{rial(d.net_rial)} ریال</span>
        </div>
        {d.invoices > 0 && (
          <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-white/5">
            <span>تعداد فاکتورها:</span>
            <span className="font-medium text-slate-200 tabular-nums">{fa(d.invoices)} فاکتور</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* Executive Quantity Hero Card */
function QuantityHeroCard({ p }) {
  const { isDark } = useAppearance()
  const m = useApi('/quantity-monthly', p)
  const months = Array.isArray(m.data) ? m.data : []
  const last = months[months.length - 1]
  const prev = months[months.length - 2]
  const change = last?.change_percent
  const delta = last && prev ? last.net_qty - prev.net_qty : null
  const isPositive = delta != null && delta >= 0
  const avgUnitPrice = last && last.net_qty ? Math.round(last.net_rial / last.net_qty) : null

  if (!last) return null

  return (
    <div className={`relative overflow-hidden rounded-3xl border p-6 sm:p-7 transition-all ${
      isDark
        ? 'bg-gradient-to-br from-[#101714] via-[#0B100E] to-[#0A0D0C] border-emerald-500/20 shadow-[0_12px_40px_rgba(0,0,0,0.5)]'
        : 'bg-gradient-to-br from-white via-emerald-50/25 to-teal-50/20 border-slate-200/90 shadow-md'
    }`}>
      {/* Soft Ambient Radial Glow */}
      <div className="absolute top-0 right-1/4 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Right side: Giant Hero Metric */}
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-500 dark:text-emerald-400">
              تحلیل تیراژ و حجم فروش کالا · خالص از مرجوعی
            </span>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/10 text-[#86868B] dark:text-[#98989D]">
              بدون احتساب پروموشن
            </span>
          </div>

          <div>
            <div className="text-xs text-[#86868B] dark:text-[#98989D] font-medium mb-1">
              تعداد کل کالای فروخته‌شده ماه جاری ({monthLabel(last.month)})
            </div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-3xl sm:text-4xl lg:text-5xl font-black tabular-nums tracking-tight text-[#1D1D1F] dark:text-white">
                {fa(last.net_qty)}
              </span>
              <span className="text-sm sm:text-base font-bold text-[#86868B] dark:text-[#98989D]">
                عدد کالا
              </span>
              {last.net_rial > 0 && (
                <span className="text-xs sm:text-sm font-extrabold px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/25 tabular-nums">
                  ارزش معادل: {billions(last.net_rial).toFixed(1)} میلیارد ریال
                </span>
              )}
            </div>
          </div>

          {/* 3 Frosted Sub-Pills */}
          <div className="flex items-center gap-2.5 flex-wrap pt-1">
            <div className="px-3.5 py-1.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-xs flex items-center gap-2">
              <span className="text-[#86868B] dark:text-[#98989D]">ماه قبل ({prev ? monthLabel(prev.month) : '—'}):</span>
              <span className="font-bold text-[#1D1D1F] dark:text-white tabular-nums">{prev ? `${fa(prev.net_qty)} عدد` : '—'}</span>
            </div>

            <div className={`px-3.5 py-1.5 rounded-xl border text-xs flex items-center gap-2 ${
              isPositive
                ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-600 dark:text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/25 text-rose-600 dark:text-rose-300'
            }`}>
              <span>تغییر ماهانه:</span>
              <span className="font-black tabular-nums">
                {pctChange(change)} {delta != null && `(${delta > 0 ? '+' : ''}${fa(delta)} عدد)`}
              </span>
            </div>

            {avgUnitPrice != null && (
              <div className="px-3.5 py-1.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-xs flex items-center gap-2">
                <span className="text-[#86868B] dark:text-[#98989D]">میانگین قیمت هر واحد:</span>
                <span className="font-bold text-[#1D1D1F] dark:text-white tabular-nums">{rial(avgUnitPrice)} ریال</span>
              </div>
            )}
          </div>
        </div>

        {/* Left side: Trend Indicator Bento Card */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 shrink-0">
          <div className="p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] text-right min-w-[210px]">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[11px] font-bold text-[#86868B] dark:text-[#98989D]">
                تغییر نسبت به ماه قبل
              </span>
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}>
                {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              </div>
            </div>
            <div className={`text-2xl sm:text-3xl font-black tabular-nums ${
              isPositive ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
            }`}>
              {pctChange(change)}
            </div>
            <div className="text-[10px] text-[#86868B] dark:text-[#98989D] mt-0.5">
              {delta == null ? 'بدون داده پیشین' : `${delta > 0 ? 'افزایش' : 'کاهش'} ${fa(Math.abs(delta))} قلم کالا`}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function QuantityGrowth({ p }) {
  const { isDark } = useAppearance()
  const m = useApi('/quantity-monthly', p)
  const data = (Array.isArray(m.data) ? m.data : []).map((x) => ({
    ...x,
    label: monthLabel(x.month),
    growth: x.change_percent == null ? null : Number((x.change_percent * 100).toFixed(1)),
  }))

  const peak = useMemo(() => {
    if (!data.length) return null
    return [...data].sort((a, b) => (b.net_qty || 0) - (a.net_qty || 0))[0]
  }, [data])

  const avgQty = useMemo(() => {
    if (!data.length) return 0
    return data.reduce((s, x) => s + (x.net_qty || 0), 0) / data.length
  }, [data])

  return (
    <AppleCard
      title="روند رشد ماهانه تعداد و تیراژ فروش"
      subtitle="تعداد خالص هر ماه و درصد تغییر ماهانه نسبت به ماه قبل"
      action={
        <div className="flex items-center gap-2 flex-wrap">
          {peak && (
            <span className="text-xs px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20 font-semibold tabular-nums">
              اوج تیراژ: {peak.label} ({fa(peak.net_qty)})
            </span>
          )}
          {avgQty > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 font-semibold tabular-nums">
              میانگین: {fa(Math.round(avgQty))} عدد
            </span>
          )}
        </div>
      }
    >
      <div className="h-80 w-full mt-2" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 15, right: 24, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="emeraldQtyBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#047857" stopOpacity={0.75} />
              </linearGradient>
              <linearGradient id="peakQtyBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34D399" stopOpacity={1} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.9} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E5E5EA'} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: isDark ? '#94A3B8' : '#86868B', fontSize: 12, fontFamily: 'Vazirmatn' }} />
            <YAxis yAxisId="qty" orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={80} tick={{ fill: isDark ? '#94A3B8' : '#86868B', fontSize: 12, fontFamily: 'Vazirmatn' }} />
            <YAxis yAxisId="pct" orientation="left" tickFormatter={(v) => `${v}٪`} tickLine={false} axisLine={false} width={56} tick={{ fill: isDark ? '#94A3B8' : '#86868B', fontSize: 12, fontFamily: 'Vazirmatn' }} />
            <Tooltip content={<QuantityMonthTip />} cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
            <Legend wrapperStyle={{ fontFamily: 'Vazirmatn', paddingTop: '10px' }} />
            <Bar yAxisId="qty" dataKey="net_qty" name="تعداد خالص" fill="url(#emeraldQtyBar)" radius={[8, 8, 2, 2]} maxBarSize={36}>
              {data.map((d) => {
                const isPeak = peak && d.month === peak.month
                return (
                  <Cell
                    key={d.month}
                    fill={isPeak ? 'url(#peakQtyBar)' : 'url(#emeraldQtyBar)'}
                    style={{ filter: isPeak ? 'drop-shadow(0 0 10px rgba(16,185,129,0.5))' : 'none' }}
                  />
                )
              })}
            </Bar>
            <Line yAxisId="pct" dataKey="growth" name="رشد ٪ نسبت به ماه قبل" stroke="#38BDF8" strokeWidth={2.5} dot={{ r: 4, fill: '#38BDF8', stroke: isDark ? '#0F172A' : '#FFFFFF', strokeWidth: 2 }} connectNulls={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </AppleCard>
  )
}

export const QuantityPage = ({ p }) => {
  const { isDark } = useAppearance()
  const r = useApi('/quantity', { ...p, limit: 20 })
  const data = (Array.isArray(r.data) ? r.data : []).map((x) => ({ ...x, short: x.product }))
  const totalTopQty = useMemo(() => data.reduce((s, x) => s + (x.net_qty || 0), 0), [data])

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6">
      {/* 1. Master Executive Hero Card */}
      <QuantityHeroCard p={p} />

      {/* 2. Monthly Growth Trend Card */}
      <QuantityGrowth p={p} />

      {/* 3. Top 20 Products Chart with Podium Highlighting */}
      <AppleCard
        title="تحلیل تیراژ ۲۰ کالای برتر"
        subtitle="بر اساس تعداد خالص فروش (فروش منهای مرجوعی، بدون پروموشن)"
        action={
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-bold tabular-nums">
            مجموع ۲۰ برتر: {fa(totalTopQty)} عدد
          </span>
        }
      >
        <div className="h-[520px] w-full mt-2" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="goldQtyBar" x1="1" y1="0" x2="0" y2="0">
                  <stop offset="0%" stopColor="#F59E0B" />
                  <stop offset="100%" stopColor="#D97706" />
                </linearGradient>
                <linearGradient id="silverQtyBar" x1="1" y1="0" x2="0" y2="0">
                  <stop offset="0%" stopColor="#38BDF8" />
                  <stop offset="100%" stopColor="#0284C7" />
                </linearGradient>
                <linearGradient id="bronzeQtyBar" x1="1" y1="0" x2="0" y2="0">
                  <stop offset="0%" stopColor="#34D399" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
                <linearGradient id="emeraldQtyHBar" x1="1" y1="0" x2="0" y2="0">
                  <stop offset="0%" stopColor="#10B981" />
                  <stop offset="100%" stopColor="#047857" />
                </linearGradient>
              </defs>
              <CartesianGrid horizontal={false} stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E5E5EA'} strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} tick={{ fill: isDark ? '#94A3B8' : '#86868B', fontSize: 12, fontFamily: 'Vazirmatn' }} />
              <YAxis type="category" dataKey="short" width={240} tickLine={false} axisLine={false} interval={0} tick={{ fill: isDark ? '#E2E8F0' : '#1D1D1F', fontSize: 11, fontFamily: 'Vazirmatn' }} />
              <Tooltip content={<ProductBarTip totalTopQty={totalTopQty} />} cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
              <Bar dataKey="net_qty" name="تعداد خالص" radius={[0, 6, 6, 0]} maxBarSize={22}>
                {data.map((d, i) => (
                  <Cell
                    key={d.product || i}
                    fill={
                      i === 0 ? 'url(#goldQtyBar)' :
                      i === 1 ? 'url(#silverQtyBar)' :
                      i === 2 ? 'url(#bronzeQtyBar)' :
                      'url(#emeraldQtyHBar)'
                    }
                    style={{
                      filter: i === 0 ? 'drop-shadow(0 0 8px rgba(245,158,11,0.4))' : 'none',
                    }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </AppleCard>

      {/* 4. Ranked Table with Podium Colors */}
      <AppleCard
        title="جدول رتبه‌بندی تعداد کالا"
        subtitle="رتبه، تعداد خالص، سهم از ۲۰ کالا، فروش خالص، تعداد فاکتور و ریال به ازای هر واحد"
        badge={`${data.length} ردیف`}
      >
        <Table
          name="تعداد-کالا"
          rows={data}
          rowClassName={(x, i) => {
            if (i === 0) return 'podium-gold border-r-4 border-r-amber-400'
            if (i === 1) return 'podium-silver border-r-4 border-r-sky-400'
            if (i === 2) return 'podium-bronze border-r-4 border-r-emerald-400'
            return ''
          }}
          columns={[
            {
              label: 'رتبه',
              render: (_, i) => {
                if (i === 0) {
                  return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-400/40 shadow-xs shadow-amber-500/10">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      #{fa(1)}
                    </span>
                  )
                }
                if (i === 1) {
                  return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-400/40 shadow-xs shadow-sky-500/10">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                      #{fa(2)}
                    </span>
                  )
                }
                if (i === 2) {
                  return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-400/40 shadow-xs shadow-emerald-500/10">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      #{fa(3)}
                    </span>
                  )
                }
                return <span className="tabular-nums text-slate-400 font-medium px-2">{fa(i + 1)}</span>
              },
              value: (_, i) => i + 1,
            },
            {
              label: 'کالا',
              render: (r, i) => {
                if (i === 0) {
                  return (
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>{r.product}</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-400/30">پیشتاز تیراژ</span>
                    </div>
                  )
                }
                if (i === 1) {
                  return (
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${isDark ? 'text-sky-300' : 'text-sky-800'}`}>{r.product}</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-400/30">رتبه ۲</span>
                    </div>
                  )
                }
                if (i === 2) {
                  return (
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>{r.product}</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30">رتبه ۳</span>
                    </div>
                  )
                }
                return <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{r.product}</span>
              },
              value: (r) => r.product,
            },
            {
              label: 'تعداد خالص',
              render: (r, i) => {
                const colorClass =
                  i === 0 ? (isDark ? 'text-amber-400 font-black' : 'text-amber-700 font-black') :
                  i === 1 ? (isDark ? 'text-sky-400 font-black' : 'text-sky-700 font-black') :
                  i === 2 ? (isDark ? 'text-emerald-400 font-black' : 'text-emerald-700 font-black') :
                  (isDark ? 'text-emerald-400 font-bold' : 'text-emerald-700 font-bold')
                return <span className={`tabular-nums ${colorClass}`}>{fa(r.net_qty)}</span>
              },
              value: (r) => r.net_qty,
            },
            {
              label: 'سهم از ۲۰ برتر',
              render: (r, i) => {
                const share = totalTopQty > 0 ? (r.net_qty / totalTopQty) * 100 : 0
                const colorClass =
                  i === 0 ? (isDark ? 'text-amber-300 font-bold' : 'text-amber-700 font-bold') :
                  i === 1 ? (isDark ? 'text-sky-300 font-bold' : 'text-sky-700 font-bold') :
                  i === 2 ? (isDark ? 'text-emerald-300 font-bold' : 'text-emerald-700 font-bold') :
                  'font-medium'
                return <span className={`tabular-nums ${colorClass}`}>{pct(share / 100, 1)}</span>
              },
              value: (r) => totalTopQty > 0 ? (r.net_qty / totalTopQty) * 100 : 0,
              unit: '٪',
            },
            {
              label: 'فروش خالص (ریال)',
              render: (r) => <span className={`tabular-nums font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{rial(r.net_rial)}</span>,
              value: (r) => r.net_rial,
            },
            {
              label: 'تعداد فاکتور',
              render: (r) => <span className="tabular-nums">{fa(r.invoices)}</span>,
              value: (r) => r.invoices,
            },
            {
              label: 'ریال به ازای واحد',
              render: (r) => <span className={`tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{rial(Math.round(r.rial_per_unit))}</span>,
              value: (r) => r.rial_per_unit,
            },
          ]}
        />
      </AppleCard>
    </div>
  )
}

/* ---------- کامپوننت کارت کی‌پی‌آی با استایل دارک امرالد ---------- */
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

/* ---------- کامپوننت پوسته کارت با استایل دارک امرالد ---------- */
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

/* ---------- نمودار کیکی سهم فروش (طراحی مدرن اپل دنات) ---------- */
const PIE_COLORS = ['#2563eb', '#0f766e', '#8b5cf6', '#f59e0b', '#ec4899', '#0ea5e9', '#84cc16', '#ef4444', '#94a3b8']
const PIE_OPTIONS = [['branch', 'شعبه'], ['region', 'منطقه'], ['brand', 'برند'], ['main_group', 'گروه کالا'], ['grade', 'گرید مشتری'], ['month', 'ماه']]

function SharePie({ p, defaultBy }) {
  const [by, setBy] = useState(defaultBy)
  const r = useApi('/breakdown', { ...p, by, limit: 40 })
  return (
    <div className="rounded-[24px] sm:rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4 sm:p-6 overflow-hidden w-full max-w-full h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-[#1D1D1F]">سهم از فروش</h2>
          <span className="text-[11px] text-[#86868B]">۸ مورد برتر و بقیه در «سایر»</span>
        </div>

        {/* Apple Segmented Control Bar */}
        <div className="flex items-center gap-1 p-1 bg-[#E8E8ED]/80 rounded-2xl flex-nowrap overflow-x-auto no-scrollbar max-w-full pb-1 mb-3" role="tablist" aria-label="بعد نمودار">
          {PIE_OPTIONS.map(([k, label]) => {
            const active = by === k
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setBy(k)}
                className="relative shrink-0 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-medium transition-all select-none"
              >
                {active && (
                  <motion.span
                    layoutId={`pieShareFilter-${defaultBy}`}
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 shadow-sm shadow-emerald-500/25"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span
                  className="relative z-10 font-bold transition-colors"
                  style={{ color: active ? '#FFFFFF' : '#6E6E73' }}
                >
                  {label}
                </span>
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
          if (!top.length) return <div className="text-center py-10 text-xs text-[#86868B]">داده‌ای برای این فیلترها وجود ندارد.</div>
          return (
            <>
              {/* Apple Donut Chart */}
              <div className="relative w-full h-44 my-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={top}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="62%"
                      outerRadius="88%"
                      paddingAngle={3}
                      stroke="none"
                    >
                      {top.map((s, i) => (
                        <Cell key={s.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v, n) => [`${fa(v)} ریال (${pct(v / total)})`, n]}
                      contentStyle={{
                        background: '#0F172A',
                        borderRadius: '14px',
                        border: 'none',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        direction: 'rtl',
                        fontFamily: 'Vazirmatn, sans-serif',
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                      }}
                      itemStyle={{ color: '#FFFFFF' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-[10px] text-[#86868B] font-medium">مجموع سهم</span>
                  <span className="text-base font-extrabold text-[#1D1D1F] tabular-nums mt-0.5">
                    {fa(Math.round(total / 1e9))}
                  </span>
                  <span className="text-[10px] text-[#86868B]">میلیارد ریال</span>
                </div>
              </div>

              {/* Breakdown list with animated micro-bars */}
              <ul className="space-y-2 mt-3 pt-3 border-t border-black/[0.05] max-h-48 overflow-y-auto pr-1">
                {top.map((s, i) => (
                  <li key={s.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs text-[#1D1D1F] font-medium flex-1 truncate">{s.name}</span>
                    <span className="text-xs font-semibold text-[#1D1D1F] tabular-nums">{pct(s.value / total)}</span>
                    <span aria-hidden="true" className="w-16 h-1.5 bg-black/[0.06] rounded-full overflow-hidden shrink-0">
                      <motion.span
                        className="block h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(s.value / total) * 100}%` }}
                        transition={{ duration: 0.8, delay: i * 0.04, ease: [0.23, 1, 0.32, 1] }}
                        style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                    </span>
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

/* ---------- روند ماهانه (Executive Dark Bento Design) ---------- */
export { default as MonthlyTrendPage } from './monthly/MonthlyTrend'

/* ---------- روند روزانه (Executive Dark Bento Design) ---------- */
export { default as TrendPage } from './trend/DailyTrend'

/* ---------- شعب و مناطق / کالا و برند ---------- */
const breakdownColumns = (labelHead) => [
  { label: labelHead, render: (r) => r.key, value: (r) => String(r.key) },
  { label: 'Sum of Rial+Vat', render: (r) => rial(r.sum_rial_vat), value: (r) => r.sum_rial_vat },
  { label: 'ریال خالص', render: (r) => rial(r.net_rial), value: (r) => r.net_rial },
  { label: 'تعداد فاکتور', render: (r) => fa(r.invoice_count), value: (r) => r.invoice_count },
  { label: 'مشتری فعال', render: (r) => fa(r.active_customers), value: (r) => r.active_customers },
  { label: 'درصد پروموشن کل', render: (r) => pct(r.promo_percent, 2), value: (r) => r.promo_percent * 100, unit: '٪' },
  { label: 'درصد تخفیف', render: (r) => pct(r.discount_percent, 2), value: (r) => r.discount_percent * 100, unit: '٪' },
  { label: 'درصد مرجوعی', render: (r) => pct(r.return_percent, 2), value: (r) => r.return_percent * 100, unit: '٪' },
]

const DIM_LABELS = { brand: 'برند', main_group: 'گروه کالا', group: 'لاین', product: 'کالا' }

const PROFILE_LABELS = { branch: 'شعبه', brand: 'برند', group: 'لاین', product: 'کالا' }

function BreakdownPage({ p, options, defaultBy, title, labelHead, drill, openProfile }) {
  const [by, setBy] = useState(defaultBy)
  const [sel, setSel] = useState(null)
  const [childBy, setChildBy] = useState(null)
  const children = sel ? drill[sel.by] : null
  const activeChild = sel ? (children.includes(childBy) ? childBy : children[0]) : null
  const r = useApi('/breakdown', sel
    ? { ...p, [sel.by]: sel.key, by: activeChild, limit: 500 }
    : { ...p, by, limit: 40 })
  const changeBy = (v) => { setBy(v); setSel(null) }
  const open = (key) => {
    if (key == null) return
    if (drill?.[by]) { setSel({ by, key: String(key) }); setChildBy(null) } else if (PROFILE_LABELS[by]) openProfile(by, String(key))
  }
  const canDrill = Boolean(drill?.[by] || PROFILE_LABELS[by]) && !sel
  const head = sel ? DIM_LABELS[activeChild] : labelHead
  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6">
      {/* Apple Floating Filter Bar */}
      <div className="rounded-[24px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-[#86868B]">بُعد گزارش:</span>
          <div className="flex items-center gap-1 p-1 bg-[#E8E8ED]/80 rounded-2xl flex-wrap">
            {options.map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => changeBy(k)}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  by === k ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-500/25' : 'text-[#1D1D1F] hover:bg-black/[0.05]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {canDrill && (
          <span className="text-xs text-[#86868B] font-medium hidden md:inline">
            💡 برای بررسی عمیق‌تر، روی میله‌های نمودار یا ردیف‌های جدول کلیک کنید
          </span>
        )}
      </div>

      {/* Drilldown Sub-bar if an item is selected */}
      {sel && (
        <div className="rounded-[22px] bg-emerald-500/10 border border-emerald-500/20 p-3.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setSel(null)}
              className="px-3.5 py-1.5 rounded-xl bg-white border border-black/10 text-xs font-bold text-[#1D1D1F] hover:bg-black/[0.03] transition-all shadow-sm"
            >
              ← بازگشت به همهٔ {DIM_LABELS[sel.by]}‌ها
            </button>
            <span className="text-xs font-extrabold text-emerald-400">
              {DIM_LABELS[sel.by]}: <span className="underline">{sel.key}</span>
            </span>
            {children && (
              <div className="flex items-center gap-1 p-1 bg-white/80 border border-black/[0.05] rounded-xl">
                {children.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setChildBy(k)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      activeChild === k ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white' : 'text-[#1D1D1F] hover:bg-black/[0.04]'
                    }`}
                  >
                    به تفکیک {DIM_LABELS[k]}
                  </button>
                ))}
              </div>
            )}
          </div>
          {PROFILE_LABELS[sel.by] && (
            <button
              type="button"
              onClick={() => openProfile(sel.by, sel.key)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold hover:from-emerald-500 hover:to-teal-500 transition-all shadow-sm shadow-emerald-500/25"
            >
              پروفایل کامل {sel.key}
            </button>
          )}
        </div>
      )}

      <Status state={r}>{(rows) => {
        const d = rows.slice(0, 20).map((x) => ({ ...x, gross: billions(x.sum_rial_vat) }))
        return (
          <>
            <AppleCard
              title={sel ? `${sel.key} — زیرشاخه‌ها به تفکیک ${DIM_LABELS[activeChild]}` : `${title} — ۲۰ مورد برتر`}
              subtitle="Rial+Vat به میلیارد ریال · برای دریل‌داون روی میله کلیک کنید"
              badge="۲۰ برتر"
            >
              <div className="h-80 w-full mt-2" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="appleBreakdownBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#E5E5EA" strokeDasharray="3 3" />
                    <XAxis dataKey="key" reversed tickFormatter={(v) => String(v).slice(0, 14)} tickLine={false} axisLine={false} interval={0} angle={d.length > 10 ? -35 : 0} textAnchor={d.length > 10 ? 'end' : 'middle'} height={d.length > 10 ? 70 : 30} tick={{ fill: '#86868B', fontSize: 11 }} />
                    <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={64} tick={{ fill: '#86868B', fontSize: 12 }} />
                    <Tooltip content={<ChartTip unit="میلیارد ریال" />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                    <Bar
                      dataKey="gross"
                      name="Rial+Vat"
                      fill="url(#appleBreakdownBar)"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={36}
                      onClick={canDrill ? (b) => open(b?.payload?.key ?? b?.key) : undefined}
                      cursor={canDrill ? 'pointer' : undefined}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </AppleCard>

            <AppleCard
              title={sel ? `جدول تفصیلی ${sel.key}` : 'جدول تفصیلی'}
              subtitle={canDrill ? `${drill?.[by] ? `برای دیدن زیرشاخه‌ها روی ${DIM_LABELS[by]} کلیک کنید` : `برای دیدن پروفایل ${PROFILE_LABELS[by]} روی ردیف کلیک کنید`}. درصد تخفیف = PromisonRial ÷ فروش عادی؛ درصد مرجوعی = مرجوعی ÷ فروش عادی`
                : 'درصد تخفیف = PromisonRial ÷ فروش عادی؛ درصد مرجوعی = مرجوعی ÷ فروش عادی'}
              badge={`${rows.length} ردیف`}
            >
              <Table
                name={sel ? `جدول-${sel.key}-${activeChild}` : `جدول-${by}`}
                rows={rows}
                columns={breakdownColumns(head)}
                onRow={canDrill ? (x) => open(x.key) : undefined}
              />
            </AppleCard>
          </>
        )
      }}</Status>
    </div>
  )
}

export { default as BranchRegionPage } from './branch/BranchRegionPage'

export { default as ProductBrandPage } from './ProductBrandPage'




/* ---------- تحلیل فاکتور (Dark Emerald Matte Design) ---------- */
function InvoiceCompare({ p }) {
  const { isDark } = useAppearance()
  const r = useApi('/invoice-compare', { ...p, day: p.end ? p.end.replaceAll('-', '/') : undefined })
  if (!r.data || !r.data.available) return null

  const daysCur = fa(r.data.current.to % 100)
  const items = [
    {
      label: 'تعداد فاکتور فروش',
      current: fa(r.data.current.invoices),
      curUnit: 'فقره فاکتور',
      previous: fa(r.data.previous.invoices),
      prevUnit: 'فقره',
      change: r.data.change.invoices,
      icon: FileText,
      curRaw: r.data.current.invoices,
      prevRaw: r.data.previous.invoices,
    },
    {
      label: 'جمع فروش فاکتورها',
      current: rial(r.data.current.sales_rial),
      curUnit: `${billions(r.data.current.sales_rial).toFixed(1)} میلیارد ریال`,
      previous: rial(r.data.previous.sales_rial),
      prevUnit: `${billions(r.data.previous.sales_rial).toFixed(1)} م.ر`,
      change: r.data.change.sales_rial,
      icon: CircleDollarSign,
      curRaw: r.data.current.sales_rial,
      prevRaw: r.data.previous.sales_rial,
    },
    {
      label: 'میانگین هر فاکتور (AOV)',
      current: rial(r.data.current.avg_invoice_rial),
      curUnit: 'ریال در فاکتور',
      previous: rial(r.data.previous.avg_invoice_rial),
      prevUnit: 'ریال',
      change: r.data.change.avg_invoice_rial,
      icon: TrendingUp,
      curRaw: r.data.current.avg_invoice_rial,
      prevRaw: r.data.previous.avg_invoice_rial,
    },
  ]

  return (
    <AppleCard
      title="مقایسه عملکرد با مدت مشابه ماه قبل"
      subtitle={`از ابتدای ماه تا ${r.data.day} در برابر همان بازه در ماه قبل`}
      badge={`این ماه: ${daysCur} روز`}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
        {items.map((it) => {
          const ch = it.change
          const isUp = ch != null && ch >= 0
          const Icon = it.icon
          const maxRaw = Math.max(it.curRaw || 1, it.prevRaw || 1)
          const curPct = Math.min(100, Math.round(((it.curRaw || 0) / maxRaw) * 100))
          const prevPct = Math.min(100, Math.round(((it.prevRaw || 0) / maxRaw) * 100))

          return (
            <div
              key={it.label}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                isDark ? 'bg-black/25 border-white/5 hover:border-white/10' : 'bg-slate-50 border-slate-200/60 hover:shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      <Icon size={16} />
                    </div>
                    <span className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {it.label}
                    </span>
                  </div>

                  {ch != null && (
                    <span className={`inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold tabular-nums ${
                      isUp
                        ? isDark ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : isDark ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {isUp ? '▲ +' : '▼ '}{pct(Math.abs(ch), 1)}
                    </span>
                  )}
                </div>

                {/* Values comparison */}
                <div className="space-y-2 mt-2">
                  <div>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>این ماه ({daysCur} روز):</span>
                      <span className={`text-base font-black tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                        {it.current}
                      </span>
                    </div>
                    {it.curUnit && (
                      <div className={`text-[10px] text-left tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {it.curUnit}
                      </div>
                    )}
                    <div className={`h-1.5 rounded-full mt-1.5 overflow-hidden ${isDark ? 'bg-white/5' : 'bg-slate-200'}`}>
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all"
                        style={{ width: `${curPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-white/5">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>مدت مشابه ماه قبل:</span>
                      <span className={`text-sm font-semibold tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        {it.previous}
                      </span>
                    </div>
                    <div className={`h-1.5 rounded-full mt-1.5 overflow-hidden ${isDark ? 'bg-white/5' : 'bg-slate-200'}`}>
                      <div
                        className={`h-full rounded-full transition-all ${isDark ? 'bg-slate-600' : 'bg-slate-400'}`}
                        style={{ width: `${prevPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </AppleCard>
  )
}

function InvoiceLinesSection({ p, linesState }) {
  const { isDark } = useAppearance()
  const fallback = useApi('/invoice-lines', p)
  const r = linesState || fallback

  return (
    <Status state={r}>{(j) => {
      const buckets = (j.buckets ?? []).map((b) => ({ ...b, label: b.open_ended ? `${fa(b.lines)}+ سطر` : `${fa(b.lines)} سطر` }))
      const maxBucket = buckets.reduce((max, b) => ((b.invoices || 0) > (max?.invoices || 0) ? b : max), buckets[0])

      return (
        <div className="space-y-5">
          {/* Distribution Chart Bento */}
          <AppleCard
            title="توزیع فاکتورها بر حسب تعداد سطر (عمق سبد خرید)"
            subtitle={maxBucket ? `تمرکز اصلی روی فاکتورهای ${maxBucket.label} با ${fa(maxBucket.invoices)} فقره (${pct(maxBucket.invoice_share, 1)} از کل فاکتورها)` : 'محور افقی: تعداد سطر در فاکتور · عمودی: تعداد فاکتور'}
            badge="توزیع اقلام"
          >
            <div className="h-72 w-full mt-2" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buckets} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="emeraldLinesBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" />
                      <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E5E5EA'} strokeDasharray="3 3" />
                  <XAxis dataKey="label" reversed tickLine={false} axisLine={false} tick={{ fill: isDark ? '#94A3B8' : '#86868B', fontSize: 11, fontFamily: 'Vazirmatn' }} />
                  <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={55} tick={{ fill: isDark ? '#94A3B8' : '#86868B', fontSize: 12, fontFamily: 'Vazirmatn' }} />
                  <Tooltip
                    content={
                      <ChartTip
                        unit="فاکتور"
                        valueFn={(v, payload) => {
                          const item = payload?.payload
                          return item ? `${fa(v)} فقره (${pct(item.invoice_share, 1)})` : fa(v)
                        }}
                      />
                    }
                    cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                  />
                  <Bar dataKey="invoices" name="تعداد فاکتور" fill="url(#emeraldLinesBar)" radius={[6, 6, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </AppleCard>

          {/* Tables Row: Line Distribution Table + Monthly Trend Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full items-start">
            <AppleCard title="جدول سطر فاکتور" subtitle="فقط فروش عادی؛ آخرین ردیف شامل ۱۰ سطر یا بیشتر است" badge={`${fa(buckets.length)} ردیف`}>
              <Table name="توزیع-سطر-فاکتور" rows={buckets} columns={[
                {
                  label: 'سطر در فاکتور',
                  render: (b) => (
                    <span className={`font-bold px-2 py-0.5 rounded-md text-xs ${
                      isDark ? 'bg-white/5 text-slate-100' : 'bg-slate-100 text-slate-900'
                    }`}>
                      {b.label}
                    </span>
                  ),
                  value: (b) => b.lines,
                },
                { label: 'تعداد فاکتور', render: (b) => <span className="tabular-nums font-bold">{fa(b.invoices)}</span>, value: (b) => b.invoices },
                { label: 'جمع سطرها', render: (b) => <span className="tabular-nums">{fa(b.line_count)}</span>, value: (b) => b.line_count },
                {
                  label: 'سهم از فاکتورها',
                  render: (b) => (
                    <div className="flex items-center gap-2 min-w-[90px]">
                      <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                          style={{ width: `${Math.min(100, Math.max(4, b.invoice_share * 100))}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold tabular-nums min-w-[34px] text-left">
                        {pct(b.invoice_share, 1)}
                      </span>
                    </div>
                  ),
                  value: (b) => b.invoice_share * 100,
                  unit: '٪',
                },
                {
                  label: 'سهم تجمعی',
                  render: (b) => (
                    <span className={`tabular-nums font-bold text-xs px-2 py-0.5 rounded-md ${
                      isDark ? 'bg-teal-500/10 text-teal-300' : 'bg-teal-50 text-teal-700'
                    }`}>
                      {pct(b.cum_invoice_share, 1)}
                    </span>
                  ),
                  value: (b) => b.cum_invoice_share * 100,
                  unit: '٪',
                },
              ]} />
            </AppleCard>

            <AppleCard title="روند ماهانه سطر فاکتور" subtitle="میانگین سطر هر فاکتور در هر ماه" badge={`${fa(j.months?.length || 0)} ماه`}>
              <Table name="سطر-فاکتور-ماهانه" rows={j.months || []} columns={[
                {
                  label: 'ماه',
                  render: (m) => <span className={`font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{monthName(m.year_month)}</span>,
                  value: (m) => m.year_month,
                },
                { label: 'تعداد فاکتور', render: (m) => <span className="tabular-nums font-semibold">{fa(m.invoices)}</span>, value: (m) => m.invoices },
                { label: 'تعداد سطر', render: (m) => <span className="tabular-nums">{fa(m.lines)}</span>, value: (m) => m.lines },
                {
                  label: 'میانگین سطر',
                  render: (m) => (
                    <span className={`tabular-nums font-black text-xs px-2 py-0.5 rounded-md ${
                      isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {fa2(m.avg_lines_per_invoice)}
                    </span>
                  ),
                  value: (m) => m.avg_lines_per_invoice ?? 0,
                },
                {
                  label: 'فروش عادی',
                  render: (m) => (
                    <div className="flex flex-col">
                      <span className={`tabular-nums font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{rial(m.sales_rial)}</span>
                      <span className={`text-[10px] tabular-nums font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {billions(m.sales_rial).toFixed(1)} م.ر
                      </span>
                    </div>
                  ),
                  value: (m) => m.sales_rial,
                  unit: 'ریال',
                },
              ]} />
            </AppleCard>
          </div>
        </div>
      )
    }}</Status>
  )
}

export function InvoicePage({ p }) {
  const { isDark } = useAppearance()
  const [step, setStep] = useState('10000000')
  const bandsApi = useApi('/invoice-bands', { ...p, step })
  const linesApi = useApi('/invoice-lines', p)

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5">
      <Status state={bandsApi}>{(j) => {
        const lines = linesApi.data
        const totalInvoices = j.total_invoices || 0
        const totalRial = j.total_rial || 0
        const avgInvoice = totalInvoices > 0 ? Math.round(totalRial / totalInvoices) : 0

        return (
          <>
            {/* 6 Unified Symmetrical Apple Bento KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3.5 w-full">
              <AppleKpiCard label="تعداد فاکتور فروش" value={fa(totalInvoices)} unit="فقره فاکتور صادرشده" icon={FileText} tone="blue" />
              <AppleKpiCard label="جمع فروش فاکتورها" value={rial(totalRial)} unit={`${billions(totalRial).toFixed(1)} میلیارد ریال`} icon={CircleDollarSign} tone="teal" />
              <AppleKpiCard label="میانگین هر فاکتور" value={avgInvoice ? rial(avgInvoice) : '—'} unit="ریال به ازای هر خرید" icon={TrendingUp} tone="green" />
              <AppleKpiCard label="تعداد سطر فاکتور" value={lines ? fa(lines.total_lines) : '…'} unit="سطر بدون پروموشن و مرجوعی" icon={Layers} tone="amber" />
              <AppleKpiCard label="میانگین سطر هر فاکتور" value={lines ? fa2(lines.avg_lines_per_invoice) : '…'} unit="قلم کالا در هر سبد خرید" icon={Package} tone="teal" />
              <AppleKpiCard label="میانگین ریال هر سطر" value={lines?.avg_rial_per_line != null ? rial(lines.avg_rial_per_line) : '…'} unit="ریال به ازای هر سطر" icon={BarChart3} tone="green" />
            </div>

            {/* Comparison with same day last month (Executive Bento Cards) */}
            <InvoiceCompare p={p} />

            {/* Invoice Lines Section (Distribution Chart + 2 Tables) */}
            <InvoiceLinesSection p={p} linesState={linesApi} />

            {/* Invoice Bands Section */}
            <AppleCard
              title="تحلیل بازه‌های مبلغی فاکتور"
              subtitle="توزیع تعداد و سهم فروش عادی فاکتورها در پله‌های مختلف ریالی"
              badge="بازه مبالغ"
              action={
                <div className={`flex items-center gap-1.5 p-1 rounded-xl flex-wrap ${isDark ? 'bg-black/30' : 'bg-slate-100'}`}>
                  <span className={`text-[11px] px-2 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>عرض بازه:</span>
                  {[
                    ['5000000', '۵ م'],
                    ['10000000', '۱۰ م'],
                    ['20000000', '۲۰ م'],
                    ['50000000', '۵۰ م'],
                  ].map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setStep(v)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        step === v
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
                          : isDark ? 'text-slate-300 hover:text-white hover:bg-white/5' : 'text-slate-700 hover:bg-white'
                      }`}
                    >
                      {l} ریال
                    </button>
                  ))}
                </div>
              }
            >
              <Table name="بازه-فاکتور" rows={j.bands} pageSize={50} columns={[
                {
                  label: 'بازه ریالی فاکتور',
                  render: (b) => (
                    <span className={`font-mono text-xs tabular-nums font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {rial(b.from_rial)} تا {rial(b.to_rial)} ریال
                    </span>
                  ),
                  value: (b) => b.from_rial,
                },
                {
                  label: 'تعداد فاکتور',
                  render: (b) => <span className="tabular-nums font-bold">{fa(b.invoices)}</span>,
                  value: (b) => b.invoices,
                },
                {
                  label: 'سهم از فاکتورها',
                  render: (b) => (
                    <div className="flex items-center gap-2 min-w-[90px]">
                      <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-400"
                          style={{ width: `${Math.min(100, Math.max(4, b.invoice_share * 100))}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold tabular-nums min-w-[34px] text-left">
                        {pct(b.invoice_share, 1)}
                      </span>
                    </div>
                  ),
                  value: (b) => b.invoice_share * 100,
                  unit: '٪',
                },
                {
                  label: 'سهم تجمعی فاکتور',
                  render: (b) => (
                    <span className={`tabular-nums font-bold text-xs px-2 py-0.5 rounded-md ${
                      isDark ? 'bg-sky-500/10 text-sky-300' : 'bg-sky-50 text-sky-700'
                    }`}>
                      {pct(b.cum_invoice_share, 1)}
                    </span>
                  ),
                  value: (b) => b.cum_invoice_share * 100,
                  unit: '٪',
                },
                {
                  label: 'مبلغ فروش',
                  render: (b) => (
                    <div className="flex flex-col">
                      <span className={`tabular-nums font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{rial(b.sales_rial)}</span>
                      <span className={`text-[10px] tabular-nums font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {billions(b.sales_rial).toFixed(1)} م.ر
                      </span>
                    </div>
                  ),
                  value: (b) => b.sales_rial,
                  unit: 'ریال',
                },
                {
                  label: 'سهم از کل فروش',
                  render: (b) => (
                    <div className="flex items-center gap-2 min-w-[90px]">
                      <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                          style={{ width: `${Math.min(100, Math.max(4, b.sales_share * 100))}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold tabular-nums min-w-[34px] text-left">
                        {pct(b.sales_share, 1)}
                      </span>
                    </div>
                  ),
                  value: (b) => b.sales_share * 100,
                  unit: '٪',
                },
                {
                  label: 'سهم تجمعی فروش',
                  render: (b) => (
                    <span className={`tabular-nums font-bold text-xs px-2 py-0.5 rounded-md ${
                      isDark ? 'bg-teal-500/10 text-teal-300' : 'bg-teal-50 text-teal-700'
                    }`}>
                      {pct(b.cum_sales_share, 1)}
                    </span>
                  ),
                  value: (b) => b.cum_sales_share * 100,
                  unit: '٪',
                },
              ]} />
            </AppleCard>
          </>
        )
      }}</Status>
    </div>
  )
}

/* ---------- پروفایل مشتری (Dark Emerald Matte Design) ---------- */
export function CustomerPage({ core, code, setCode, openReturns }) {
  const { isDark } = useAppearance()
  const [draft, setDraft] = useState(code ?? '')
  const reasonFilter = new URLSearchParams(location.hash.split('?')[1] || '').get('reason') || undefined
  const r = useApi(`/customer/${encodeURIComponent(code ?? '')}`, { core, reason: reasonFilter }, Boolean(code))

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5">
      {/* Floating Glass Search & Quick Access Bar */}
      <form
        className={`rounded-2xl backdrop-blur-xl border p-3.5 sm:p-4 flex items-center justify-between gap-4 flex-wrap ${
          isDark
            ? 'bg-[#0B100E]/80 border-emerald-500/15 shadow-[0_4px_20px_rgba(0,0,0,0.35)]'
            : 'bg-white/95 border-slate-200/90 shadow-xs'
        }`}
        onSubmit={(e) => { e.preventDefault(); if (draft.trim()) setCode(draft.trim()) }}
      >
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap flex-1 max-w-xl">
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
              <Search size={16} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
            </div>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="جستجوی کد مشتری (مثلاً Gol100101)..."
              dir="ltr"
              className={`w-full pr-10 pl-4 py-2 text-sm rounded-xl border focus:outline-none transition-all ${
                isDark
                  ? 'bg-black/40 border-white/10 text-slate-100 placeholder-slate-500 focus:border-emerald-500/60 focus:bg-black/60'
                  : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-600 focus:bg-white'
              }`}
            />
          </div>
          <button
            type="submit"
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs active:scale-[0.98] transition-all"
          >
            نمایش پروفایل
          </button>
        </div>

        {code && (
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`} dir="ltr">
              کد فعال: {code}
            </span>
            <button
              type="button"
              onClick={() => { setCode(''); setDraft('') }}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              ✕ پاک کردن
            </button>
          </div>
        )}
      </form>

      {!code && (
        <AppleCard>
          <div className="text-center py-12 space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-600/20 to-teal-500/20 flex items-center justify-center text-emerald-400">
              <UserRound size={32} />
            </div>
            <h3 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>کد مشتری را وارد کنید</h3>
            <p className={`text-xs max-w-md mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              کد مشتری مورد نظر را جستجو کنید یا از طریق کلیک روی مشتریان در بخش پارتو و گزارش‌های فروش، پروفایل تفصیلی را فراخوانی نمایید.
            </p>
          </div>
        </AppleCard>
      )}

      {code && r.error && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 px-5 py-4 text-sm font-semibold text-center">
          مشتری با کد «{code}» در این هسته فروش پیدا نشد.
        </div>
      )}

      {code && !r.error && (
        <Status state={r}>{(j) => {
          const total = (j.months ?? []).reduce((s, m) => s + (m.sales_rial || 0), 0)
          const invoices = (j.months ?? []).reduce((s, m) => s + (m.invoices || 0), 0)
          const totalDiscounts = (j.months ?? []).reduce((s, m) => s + (m.discount_rial || 0), 0)
          const avgInvoice = invoices > 0 ? Math.round(total / invoices) : 0
          const d = (j.months ?? []).map((m) => ({ ...m, gross: billions(m.sales_rial) }))
          const isVip = String(j.grade ?? '').toUpperCase().includes('VIP')
          const products = (j.products ?? []).map((x, idx) => ({ ...x, rank: idx + 1 }))
          const brandTotal = (j.brands ?? []).reduce((s, b) => s + (b.sales_rial || 0), 0)
          const brands = (j.brands ?? []).map((x, idx) => ({
            ...x,
            rank: idx + 1,
            share: brandTotal > 0 ? x.sales_rial / brandTotal : 0
          }))
          const maxMonth = (j.months ?? []).reduce((max, m) => ((m.sales_rial || 0) > (max?.sales_rial || 0) ? m : max), j.months?.[0])

          return (
            <div className="space-y-5">
              {/* Executive Customer Identity Bento Card */}
              <div
                className={`rounded-2xl sm:rounded-3xl border transition-all p-5 sm:p-6 overflow-hidden relative ${
                  isDark
                    ? 'bg-[#0B100E]/90 backdrop-blur-2xl border-emerald-500/20 shadow-[0_12px_40px_rgba(0,0,0,0.5)]'
                    : 'bg-white/95 backdrop-blur-xl border-slate-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.04)]'
                }`}
              >
                {/* Top Accent Gradient Line */}
                <div className={`absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r ${
                  isVip
                    ? 'from-amber-400 via-yellow-400 to-amber-500'
                    : 'from-emerald-500 via-teal-400 to-emerald-600'
                }`} />

                {/* Header: Customer Name & Header Badges */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-5 border-b border-white/5">
                  {/* Right: Emblem + Customer Name */}
                  <div className="flex items-center gap-3.5 sm:gap-4.5 flex-1 min-w-0">
                    <div className="relative shrink-0">
                      <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-white shadow-xl text-2xl font-black ${
                        isVip
                          ? 'bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-600 text-amber-950 shadow-amber-900/30'
                          : 'bg-gradient-to-br from-emerald-500 to-teal-700 shadow-emerald-900/30'
                      }`}>
                        {isVip ? '👑' : <Store size={28} className="text-white" />}
                      </div>
                      {isVip && (
                        <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-950 font-black text-[9px] shadow-sm">
                          VIP
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          پروفایل مشتری
                        </span>
                        {j.grade && (
                          <span className={`px-3 py-0.5 rounded-full text-xs font-extrabold flex items-center gap-1 ${
                            isVip
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                              : isDark
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {isVip ? '👑 گرید VIP' : `گرید ${j.grade}`}
                          </span>
                        )}
                      </div>
                      <h1 className={`text-xl sm:text-2xl lg:text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {j.name || j.sales_point || 'مشتری بدون نام'}
                      </h1>
                      {j.sales_point && j.sales_point !== j.name && (
                        <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          نام تابلو: <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>{j.sales_point}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Left: Quick Financial Status Pills */}
                  <div className="flex items-center gap-3 shrink-0 flex-wrap">
                    <div className={`px-4 py-2.5 rounded-2xl border ${isDark ? 'bg-black/40 border-white/10' : 'bg-slate-50 border-slate-200'} flex items-center gap-3`}>
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                        <CircleDollarSign size={20} />
                      </div>
                      <div>
                        <span className={`text-[10px] block font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>مجموع خرید دوره</span>
                        <span className={`text-base font-black tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                          {billions(total).toFixed(1)} <span className="text-xs font-normal">میلیارد ریال</span>
                        </span>
                      </div>
                    </div>
                    <div className={`px-4 py-2.5 rounded-2xl border ${isDark ? 'bg-black/40 border-white/10' : 'bg-slate-50 border-slate-200'} flex items-center gap-3`}>
                      <div className="w-9 h-9 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center shrink-0">
                        <Calendar size={20} />
                      </div>
                      <div>
                        <span className={`text-[10px] block font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>آخرین تاریخ خرید</span>
                        <span className={`text-base font-bold tabular-nums ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>
                          {j.last_purchase ?? '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Structured Metadata Grid (6 Clean Cards) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5 pt-5">
                  {/* نام فروشگاه / تابلو */}
                  <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50/80 border-slate-200'}`}>
                    <span className={`text-[11px] block font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>نام فروشگاه / تابلو</span>
                    <span className={`text-xs sm:text-sm font-bold block truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`} title={j.sales_point || j.name}>
                      {j.sales_point || j.name || '—'}
                    </span>
                  </div>

                  {/* کد مشتری */}
                  <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50/80 border-slate-200'}`}>
                    <span className={`text-[11px] block font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>کد مشتری</span>
                    <span className={`text-xs sm:text-sm font-mono font-bold block ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`} dir="ltr">
                      {j.code}
                    </span>
                  </div>

                  {/* شعبه */}
                  <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50/80 border-slate-200'}`}>
                    <span className={`text-[11px] block font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>شعبه</span>
                    <span className={`text-xs sm:text-sm font-bold block truncate ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>
                      {j.branch || '—'}
                    </span>
                  </div>

                  {/* ویزیتور */}
                  <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50/80 border-slate-200'}`}>
                    <span className={`text-[11px] block font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ویزیتور فعال</span>
                    <span className={`text-xs sm:text-sm font-semibold block truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`} title={j.visitor}>
                      {j.visitor || '—'}
                    </span>
                  </div>

                  {/* شهر و منطقه */}
                  <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50/80 border-slate-200'}`}>
                    <span className={`text-[11px] block font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>شهر / منطقه</span>
                    <span className={`text-xs sm:text-sm font-medium block truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`} title={[j.city, j.region].filter(Boolean).join(' / ')}>
                      {[j.city, j.region].filter(Boolean).join(' / ') || '—'}
                    </span>
                  </div>

                  {/* گرید مشتری */}
                  <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50/80 border-slate-200'}`}>
                    <span className={`text-[11px] block font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>سطح وفاداری</span>
                    <span className={`text-xs sm:text-sm font-black block ${
                      isVip ? 'text-amber-400' : isDark ? 'text-emerald-400' : 'text-emerald-700'
                    }`}>
                      {j.grade ? (isVip ? 'VIP ★' : `گرید ${j.grade}`) : 'عادی'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5 Symmetrical Apple Bento KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-3.5 w-full">
                <AppleKpiCard label="جمع خرید عادی" value={rial(total)} unit={`${billions(total).toFixed(1)} میلیارد ریال`} icon={CircleDollarSign} tone="teal" />
                <AppleKpiCard label="تعداد فاکتور" value={fa(invoices)} unit="فقره فاکتور موفق" icon={FileText} tone="blue" />
                <AppleKpiCard label="میانگین هر فاکتور" value={avgInvoice > 0 ? rial(avgInvoice) : '—'} unit="ریال به ازای هر خرید" icon={TrendingUp} tone="green" />
                <AppleKpiCard label="مجموع تخفیف‌ها" value={rial(totalDiscounts)} unit={total > 0 ? `${pct(totalDiscounts / total, 1)} تخفیف موثر` : 'ریال'} icon={Award} tone="amber" />
                <AppleKpiCard label="تاریخ آخرین خرید" value={j.last_purchase ?? '—'} unit="آخرین ثبت فاکتور" icon={Calendar} tone="violet" />
              </div>

              {/* Monthly Pattern Bar Chart Bento */}
              <AppleCard
                title="الگوی ماهانه خرید مشتری"
                subtitle={maxMonth && maxMonth.sales_rial > 0 ? `فروش ناخالص به میلیارد ریال • اوج خرید در ${monthName(maxMonth.year_month)} (${billions(maxMonth.sales_rial).toFixed(1)} م.ر)` : 'فروش ناخالص به میلیارد ریال'}
                badge="روند ماهانه"
              >
                <div className="h-72 w-full mt-2" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="emeraldCustMonthly" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" />
                          <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E5E5EA'} strokeDasharray="3 3" />
                      <XAxis dataKey="year_month" reversed tickFormatter={monthName} tickLine={false} axisLine={false} tick={{ fill: isDark ? '#94A3B8' : '#86868B', fontSize: 12, fontFamily: 'Vazirmatn' }} />
                      <YAxis
                        orientation="right"
                        tickFormatter={(v) => (v % 1 === 0 && Math.abs(v) >= 10 ? fa(v) : Number(v).toLocaleString('fa-IR', { maximumFractionDigits: 2 }))}
                        tickLine={false}
                        axisLine={false}
                        width={55}
                        tick={{ fill: isDark ? '#94A3B8' : '#86868B', fontSize: 12, fontFamily: 'Vazirmatn' }}
                      />
                      <Tooltip
                        content={<ChartTip labelFn={monthName} unit="میلیارد ریال" valueFn={(v) => (v == null ? '—' : Number(v).toLocaleString('fa-IR', { minimumFractionDigits: (Number(v) % 1 === 0 && Number(v) >= 10 ? 0 : 1), maximumFractionDigits: 2 }))} />}
                        cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                      />
                      <Bar dataKey="gross" name="فروش عادی" fill="url(#emeraldCustMonthly)" radius={[6, 6, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </AppleCard>

              {/* Products & Brands Bento Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full items-start">
                <AppleCard title="کالاهای خریداری‌شده" subtitle="۱۵ کالای برتر بر اساس مبلغ فروش" badge={`${fa(products.length)} کالا`}>
                  <Table
                    name="کالاهای-مشتری"
                    rows={products}
                    columns={[
                      {
                        label: 'رتبه',
                        render: (x) => {
                          if (x.rank === 1) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400/20 text-amber-300 font-black text-xs border border-amber-400/40 shadow-xs">🥇</span>
                          if (x.rank === 2) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300/20 text-slate-200 font-black text-xs border border-slate-300/40 shadow-xs">🥈</span>
                          if (x.rank === 3) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-500 font-black text-xs border border-amber-600/40 shadow-xs">🥉</span>
                          return <span className={`text-xs font-semibold tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fa(x.rank)}</span>
                        },
                        value: (x) => x.rank,
                      },
                      {
                        label: 'نام کالا',
                        render: (x) => <span className={`font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{x.name}</span>,
                        value: (x) => String(x.name ?? ''),
                      },
                      {
                        label: 'مبلغ خرید',
                        render: (x) => (
                          <div className="flex flex-col">
                            <span className={`tabular-nums font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{rial(x.sales_rial)}</span>
                            <span className={`text-[10px] tabular-nums font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {billions(x.sales_rial).toFixed(1)} م.ر
                            </span>
                          </div>
                        ),
                        value: (x) => x.sales_rial,
                        unit: 'ریال',
                      },
                      {
                        label: 'تعداد',
                        render: (x) => <span className="tabular-nums font-bold text-amber-400">{fa(x.qty)} <span className="text-[10px] text-slate-400 font-normal">عدد</span></span>,
                        value: (x) => x.qty,
                      },
                    ]}
                  />
                </AppleCard>

                <AppleCard title="ترکیب برندها" subtitle="سهم هر برند از کل خرید مشتری" badge={`${fa(brands.length)} برند`}>
                  <Table
                    name="برندهای-مشتری"
                    rows={brands}
                    columns={[
                      {
                        label: 'رتبه',
                        render: (x) => {
                          if (x.rank === 1) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400/20 text-amber-300 font-black text-xs border border-amber-400/40 shadow-xs">🥇</span>
                          if (x.rank === 2) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300/20 text-slate-200 font-black text-xs border border-slate-300/40 shadow-xs">🥈</span>
                          if (x.rank === 3) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-500 font-black text-xs border border-amber-600/40 shadow-xs">🥉</span>
                          return <span className={`text-xs font-semibold tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fa(x.rank)}</span>
                        },
                        value: (x) => x.rank,
                      },
                      {
                        label: 'برند',
                        render: (x) => (
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-500" />
                            <span className={`font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{x.name}</span>
                          </div>
                        ),
                        value: (x) => String(x.name ?? ''),
                      },
                      {
                        label: 'مبلغ خرید',
                        render: (x) => (
                          <div className="flex flex-col">
                            <span className={`tabular-nums font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{rial(x.sales_rial)}</span>
                            <span className={`text-[10px] tabular-nums font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {billions(x.sales_rial).toFixed(1)} م.ر
                            </span>
                          </div>
                        ),
                        value: (x) => x.sales_rial,
                        unit: 'ریال',
                      },
                      {
                        label: 'سهم از سبد',
                        render: (x) => (
                          <div className="flex items-center gap-2 min-w-[90px]">
                            <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                                style={{ width: `${Math.min(100, Math.max(5, x.share * 100))}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold tabular-nums min-w-[34px] text-left ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                              {pct(x.share, 1)}
                            </span>
                          </div>
                        ),
                        value: (x) => x.share * 100,
                        unit: '٪',
                      },
                    ]}
                  />
                </AppleCard>
              </div>

              {/* Returns Card */}
              <ReturnsProfileCard data={j.dispatch_returns} entity="مشتری" onOpen={() => openReturns(returnsArg('customer', code))} />
            </div>
          )
        }}</Status>
      )}
    </div>
  )
}

/* ---------- آنالیز رشد و پروفایل شعبه/برند ---------- */
const GROWTH_LABELS = { month: 'ماهانه', season: 'فصلی', half: '۶ماهه' }
const PROFILE_LABELS_FULL = { branch: 'شعبه', brand: 'برند', group: 'لاین', product: 'کالا' }
const PROFILE_SPLITS = { branch: 'شعبه', brand: 'برند', group: 'لاین', grade: 'گرید مشتری', region: 'منطقه' }

/* ---------- آنالیز رشد و افت (Executive Dark Bento Design) ---------- */
export { default as GrowthPage } from './growth/GrowthAnalysis'

function ProfileCommon({ j, back, openCustomer, openVisitor }) {
  const { isDark } = useAppearance()
  const months = (j.months ?? []).map((m) => ({ ...m, gross: billions(m.sales_rial) }))
  const days = (j.days ?? []).map((d) => ({ ...d, gross: billions(d.sales_rial) }))
  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 space-y-5">
      {/* Dark Emerald Hero Header */}
      <div className={`rounded-2xl backdrop-blur-xl border p-4 sm:p-5 flex items-center justify-between flex-wrap gap-4 ${
        isDark
          ? 'bg-[#0B100E]/80 border-emerald-500/15 shadow-[0_8px_30px_rgba(0,0,0,0.45)]'
          : 'bg-white/90 border-slate-200/80 shadow-xs'
      }`}>
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-white font-black text-lg shadow-sm shadow-emerald-900/30">
            {PROFILE_LABELS_FULL[j.by]?.[0] ?? 'پ'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                پروفایل {PROFILE_LABELS_FULL[j.by]}
              </span>
              <h1 className={`text-lg sm:text-xl font-extrabold tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{j.key}</h1>
            </div>
            <div className={`flex items-center gap-3 sm:gap-4 mt-1 text-xs flex-wrap ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span>سهم از فروش هسته: <b className={`font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{pct(j.share, 2)}</b></span>
              <span>•</span>
              <span>اولین فروش دوره: <b className={isDark ? 'text-slate-200' : 'text-slate-700'}>{j.first_sale ?? '—'}</b></span>
              <span>•</span>
              <span>آخرین فروش دوره: <b className={isDark ? 'text-slate-200' : 'text-slate-700'}>{j.last_sale ?? '—'}</b></span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={back}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            isDark ? 'bg-white/10 hover:bg-white/15 text-slate-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
          }`}
        >
          <span>← بازگشت</span>
        </button>
      </div>

      {/* 10 Compact Dark Emerald KPI Cards in 2 Symmetrical Rows of 5 */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-3 w-full">
        <AppleKpiCard label="فروش عادی" value={rial(j.sales_rial)} unit="ریال" icon={CircleDollarSign} tone="teal" />
        <AppleKpiCard label="ریال خالص" value={rial(j.net_rial)} unit="خالص از پروموشن" icon={Award} tone="green" />
        <AppleKpiCard label="فاکتور فروش" value={fa(j.sales_invoices)} unit="فقره فاکتور" icon={FileText} tone="blue" />
        <AppleKpiCard label="مشتری خریدار" value={fa(j.buying_customers)} unit="مشتری یکتا" icon={Users} tone="teal" />
        <AppleKpiCard label="روز دارای فروش" value={fa(j.active_days)} unit="روز فعال" icon={Calendar} tone="green" />
        <AppleKpiCard label="سطر فاکتور" value={fa(j.sales_lines)} unit={`میانگین ${fa2(j.avg_lines_per_invoice)} سطر در فاکتور`} icon={Layers} tone="amber" />
        <AppleKpiCard label="میانگین هر فاکتور" value={j.avg_invoice_rial == null ? '—' : rial(j.avg_invoice_rial)} unit="ریال" icon={CircleDollarSign} tone="blue" />
        <AppleKpiCard label="میانگین هر مشتری" value={j.avg_customer_rial == null ? '—' : rial(j.avg_customer_rial)} unit="ریال" icon={UserCheck} tone="teal" />
        <AppleKpiCard label="درصد مرجوعی" value={pct(j.return_percent, 2)} unit="از فروش عادی" icon={RotateCcw} tone="red" />
        <AppleKpiCard label="درصد تخفیف" value={pct(j.discount_percent, 2)} unit="از فروش عادی" icon={TrendingUp} tone="pink" />
      </div>

      {/* Monthly & Daily Trend Bento Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full items-start">
        <AppleCard title="روند ماهانه" subtitle="فروش عادی به میلیارد ریال" badge="ماهانه">
          <div className="h-72 w-full mt-2" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="emeraldProfileMonthlyBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E5E5EA'} strokeDasharray="3 3" />
                <XAxis dataKey="year_month" reversed tickFormatter={monthName} tickLine={false} axisLine={false} tick={{ fill: isDark ? '#94A3B8' : '#86868B', fontSize: 12, fontFamily: 'Vazirmatn' }} />
                <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={55} tick={{ fill: isDark ? '#94A3B8' : '#86868B', fontSize: 12, fontFamily: 'Vazirmatn' }} />
                <Tooltip content={<ChartTip labelFn={monthName} unit="میلیارد ریال" />} cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
                <Bar dataKey="gross" name="فروش عادی" fill="url(#emeraldProfileMonthlyBar)" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AppleCard>

        <AppleCard title="روند روزانه" subtitle="فروش عادی به میلیارد ریال" badge="روزانه">
          {!days.length ? (
            <div className={`text-center py-12 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>در این بازه فروشی ثبت نشده است.</div>
          ) : (
            <div className="h-72 w-full mt-2" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={days} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="emeraldProfileDailyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E5E5EA'} strokeDasharray="3 3" />
                  <XAxis dataKey="date" reversed tickFormatter={dayLabel} tickLine={false} axisLine={false} tick={{ fill: isDark ? '#94A3B8' : '#86868B', fontSize: 11, fontFamily: 'Vazirmatn' }} />
                  <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={55} tick={{ fill: isDark ? '#94A3B8' : '#86868B', fontSize: 12, fontFamily: 'Vazirmatn' }} />
                  <Tooltip content={<ChartTip labelFn={dayLabel} unit="میلیارد ریال" />} />
                  <Area type="monotone" dataKey="gross" name="فروش عادی" stroke="#10B981" strokeWidth={2.5} fill="url(#emeraldProfileDailyGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </AppleCard>
      </div>

      {/* Donut Charts Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5 w-full items-stretch">
        {Object.entries(PROFILE_SPLITS)
          .filter(([key]) => key !== j.by)
          .map(([key, label]) => (
            <SplitPie key={key} title={`سهم ${label}`} rows={j[`split_${key}`] ?? []} />
          ))}
      </div>

      {/* Top Tables Bento Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full items-start">
        <AppleCard title="ویزیتورهای برتر" subtitle="برای دیدن پروفایل روی ردیف کلیک کنید">
          <Table name={`ویزیتور-${j.key}`} rows={j.visitors ?? []} onRow={(x) => openVisitor(x.code)} columns={[
            { label: 'کد', render: (x) => x.code, value: (x) => String(x.code) },
            { label: 'نام', render: (x) => <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{x.name ?? '—'}</span>, value: (x) => String(x.name ?? '') },
            { label: 'فروش', render: (x) => <span className={`tabular-nums font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{rial(x.sales_rial)}</span>, value: (x) => x.sales_rial },
            { label: 'مشتری', render: (x) => <span className="tabular-nums">{fa(x.customers)}</span>, value: (x) => x.customers },
          ]} />
        </AppleCard>

        <AppleCard title="مشتریان برتر" subtitle="برای دیدن پروفایل روی ردیف کلیک کنید">
          <Table name={`مشتری-${j.key}`} rows={j.customers ?? []} onRow={(x) => openCustomer(x.code)} columns={[
            { label: 'کد', render: (x) => x.code, value: (x) => String(x.code) },
            { label: 'نام مشتری', render: (x) => <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{x.name ?? '—'}</span>, value: (x) => String(x.name ?? '') },
            { label: 'فروش', render: (x) => <span className={`tabular-nums font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{rial(x.sales_rial)}</span>, value: (x) => x.sales_rial },
            { label: 'فاکتور', render: (x) => <span className="tabular-nums">{fa(x.invoices)}</span>, value: (x) => x.invoices },
          ]} />
        </AppleCard>
      </div>

      {j.products?.length > 0 && (
        <AppleCard title="کالاهای برتر" subtitle="۱۵ کالای پرفروش" badge="کالاها">
          <Table name={`کالا-${j.key}`} rows={j.products} columns={[
            { label: 'کالا', render: (x) => <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{x.name}</span>, value: (x) => String(x.name ?? '') },
            { label: 'فروش', render: (x) => <span className={`tabular-nums font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{rial(x.sales_rial)}</span>, value: (x) => x.sales_rial },
            { label: 'تعداد', render: (x) => <span className="tabular-nums">{fa(x.qty)}</span>, value: (x) => x.qty },
          ]} />
        </AppleCard>
      )}
    </div>
  )
}

function ProfileDirectory({ p, openProfile }) {
  const { isDark } = useAppearance()
  const [by, setBy] = useState('branch')
  const r = useApi('/breakdown', { ...p, by, limit: 100 })
  const labels = { branch: 'شعبه', brand: 'برند', group: 'لاین', product: 'کالا' }

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 space-y-5">
      {/* Dark Emerald Floating Filter Bar */}
      <div className={`rounded-2xl backdrop-blur-xl border p-3 sm:p-4 flex items-center justify-between gap-4 flex-wrap ${
        isDark
          ? 'bg-[#0B100E]/75 border-emerald-500/15 shadow-[0_4px_20px_rgba(0,0,0,0.35)]'
          : 'bg-white/90 border-slate-200/80 shadow-xs'
      }`}>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>نوع پروفایل:</span>
          <div className={`flex items-center gap-1 p-1 rounded-xl flex-wrap ${isDark ? 'bg-black/30' : 'bg-slate-100'}`}>
            {Object.entries(labels).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setBy(k)}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  by === k
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
                    : isDark ? 'text-slate-300 hover:text-white hover:bg-white/5' : 'text-slate-700 hover:bg-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <span className={`text-xs font-medium hidden sm:inline ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          برای مشاهدهٔ تحلیل تفصیلی هر مورد روی ردیف آن کلیک کنید
        </span>
      </div>

      <Status state={r}>{(rows) => (
        <AppleCard
          title={`فهرست ${labels[by]}‌ها`}
          subtitle="برای مشاهدهٔ جزئیات و شاخص‌های کامل، روی هر ردیف کلیک کنید"
          badge={`${rows.length} ردیف`}
        >
          <Table
            name={`فهرست-${by}`}
            rows={rows}
            onRow={(x) => openProfile(by, x.key)}
            columns={[
              { label: labels[by], render: (x) => <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{String(x.key)}</span>, value: (x) => String(x.key) },
              { label: 'فروش عادی', render: (x) => <span className={`tabular-nums font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{rial(x.sales_rial)}</span>, value: (x) => x.sales_rial },
              { label: 'ریال خالص', render: (x) => <span className={`tabular-nums font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{rial(x.net_rial)}</span>, value: (x) => x.net_rial },
              { label: 'فاکتور', render: (x) => <span className="tabular-nums">{fa(x.invoice_count)}</span>, value: (x) => x.invoice_count },
              { label: 'مشتری فعال', render: (x) => <span className="tabular-nums">{fa(x.active_customers)}</span>, value: (x) => x.active_customers },
            ]}
          />
        </AppleCard>
      )}</Status>
    </div>
  )
}

export function ProfilePage({ p, arg, openProfile, back, openCustomer, openVisitor }) {
  const [by, key] = arg?.includes('~') ? arg.split('~') : ['', '']
  const r = useApi(`/profile/${encodeURIComponent(by)}/${encodeURIComponent(key)}`, { ...p }, Boolean(by && key))
  if (!by || !key) return <ProfileDirectory p={p} openProfile={openProfile} />
  if (r.error) {
    return (
      <div className="w-full max-w-[1600px] mx-auto p-6">
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 text-xs text-rose-500 flex items-center justify-between">
          <span>مورد یافت نشد.</span>
          <button className="px-3 py-1 rounded-xl bg-white border border-rose-200 text-rose-700 font-bold" type="button" onClick={back}>بازگشت</button>
        </div>
      </div>
    )
  }
  return <Status state={r}>{(j) => <ProfileCommon j={j} back={back} openCustomer={openCustomer} openVisitor={openVisitor} />}</Status>
}

/* ---------- پروفایل ویزیتور (Dark Emerald Matte Design) ---------- */
function SplitPie({ title, rows }) {
  const { isDark } = useAppearance()
  const top = (rows ?? []).slice(0, 8).map((x) => ({ name: String(x.name), value: x.sales_rial }))
  const rest = (rows ?? []).slice(8).reduce((s, x) => s + x.sales_rial, 0)
  if (rest > 0) top.push({ name: 'سایر', value: rest })
  const total = top.reduce((s, x) => s + x.value, 0)
  return (
    <AppleCard title={title} subtitle="توزیع فروش عادی" className="h-full flex flex-col justify-between">
      {!top.length ? (
        <div className={`text-center py-12 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>داده‌ای برای این فیلترها وجود ندارد.</div>
      ) : (
        <div className="flex flex-col xl:flex-row items-center justify-between gap-4 mt-2 flex-1">
          {/* Donut Chart with Center Metric */}
          <div className="w-[140px] h-[140px] sm:w-[150px] sm:h-[150px] shrink-0 relative flex items-center justify-center" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={top}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="60%"
                  outerRadius="88%"
                  paddingAngle={2.5}
                  stroke="none"
                >
                  {top.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  formatter={(v, n) => [`${fa(v)} ریال (${pct(v / total, 1)})`, n]}
                  contentStyle={{
                    background: isDark ? '#1C1C1E' : '#FFFFFF',
                    borderRadius: '12px',
                    border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #E2E8F0',
                    color: isDark ? '#F1F5F9' : '#0F172A',
                    fontSize: '12px',
                    direction: 'rtl',
                    fontFamily: 'Vazirmatn, sans-serif',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
                  }}
                  itemStyle={{ color: isDark ? '#F1F5F9' : '#0F172A' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>مجموع</span>
              <span className={`text-xs font-black tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                {billions(total) >= 1 ? `${billions(total).toFixed(1)} م.ر` : `${fa(Math.round(total / 1e6))} م.ر`}
              </span>
            </div>
          </div>

          {/* Legend List with dedicated safe padding and sleek scrollbar */}
          <ul className="flex-1 min-w-0 w-full space-y-1.5 max-h-[200px] overflow-y-auto px-2 pl-3.5 pr-1 exec-hover-scrollbar">
            {top.map((s, i) => (
              <li key={s.name} className={`flex items-center justify-between gap-2 text-xs py-1 px-1.5 rounded-lg transition-colors ${
                isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100/70'
              }`}>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className={`font-semibold truncate text-[12px] ${isDark ? 'text-slate-200' : 'text-slate-800'}`} title={s.name}>
                    {s.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`font-bold tabular-nums text-[12px] min-w-[38px] text-left ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    {pct(s.value / total, 1)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AppleCard>
  )
}

const dash = (v, f = rial) => (v == null ? '—' : f(v))

function VisitorList({ p, openVisitor }) {
  const { isDark } = useAppearance()
  const r = useApi('/visitors', p)
  const ov = useApi('/overview', p)
  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5">
      <Status state={r}>{(j) => {
        const rows = j.visitors ?? []
        const sales = rows.reduce((s, x) => s + x.sales_rial, 0)
        const unassigned = ov.data ? ov.data.sum_rial_vat - rows.reduce((s, x) => s + x.sum_rial_vat, 0) : null
        const top = rows.slice(0, 15).map((x) => ({ ...x, label: `${x.name ?? ''} (${x.code})`, gross: billions(x.sales_rial) }))
        return (
          <>
            {/* 5 Compact Dark Emerald KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-3 w-full">
              <AppleKpiCard label="تعداد ویزیتور دارای فروش" value={fa(rows.length)} unit="کد ویزیتور" icon={UserCheck} tone="teal" />
              <AppleKpiCard label="جمع فروش عادی" value={rial(sales)} unit="ریال" icon={CircleDollarSign} tone="green" />
              <AppleKpiCard label="میانگین فروش هر ویزیتور" value={rows.length ? rial(sales / rows.length) : '—'} unit="ریال" icon={TrendingUp} tone="blue" />
              <AppleKpiCard label="خرید پرسنلی" value={rial(j.personnel_rial ?? 0)} unit={`${fa(j.personnel_visitors ?? 0)} ویزیتور`} icon={Award} tone="amber" />
              <AppleKpiCard label="Rial+Vat بدون کد ویزیتور" value={unassigned == null ? '…' : rial(unassigned)} unit="ریال" icon={FileText} tone="pink" />
            </div>

            {/* Top Visitors Chart Bento */}
            <AppleCard title="ویزیتورهای برتر — ۱۵ مورد" subtitle="فروش عادی به میلیارد ریال" badge="۱۵ ویزیتور برتر">
              <div className="h-80 w-full mt-2" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top} margin={{ top: 8, right: 8, left: 8, bottom: 20 }}>
                    <defs>
                      <linearGradient id="emeraldVisitorTopBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E5E5EA'} strokeDasharray="3 3" />
                    <XAxis dataKey="label" reversed tickLine={false} axisLine={false} interval={0} angle={-25} textAnchor="end" height={60} tick={{ fill: isDark ? '#94A3B8' : '#86868B', fontSize: 11, fontFamily: 'Vazirmatn' }} />
                    <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={55} tick={{ fill: isDark ? '#94A3B8' : '#86868B', fontSize: 12, fontFamily: 'Vazirmatn' }} />
                    <Tooltip content={<ChartTip unit="میلیارد ریال" />} cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
                    <Bar dataKey="gross" name="فروش عادی" fill="url(#emeraldVisitorTopBar)" radius={[6, 6, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </AppleCard>

            {/* Visitors Table Bento */}
            <AppleCard title="جدول ویزیتورها" subtitle="هر کد ویزیتور یک ردیف است؛ برای دیدن پروفایل روی ردیف کلیک کنید">
              <Table name="جدول-ویزیتورها" rows={rows} onRow={(x) => openVisitor(x.code)} columns={[
                { label: 'رتبه', render: (x) => fa(x.rank), value: (x) => x.rank },
                { label: 'کد', render: (x) => x.code, value: (x) => String(x.code) },
                { label: 'نام ویزیتور', render: (x) => <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{x.name ?? '—'}</span>, value: (x) => String(x.name ?? '') },
                { label: 'تعداد شعبه', render: (x) => fa(x.branch_count), value: (x) => x.branch_count },
                { label: 'فروش عادی (ریال)', render: (x) => <span className={`tabular-nums font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{rial(x.sales_rial)}</span>, value: (x) => x.sales_rial },
                { label: 'ریال خالص', render: (x) => <span className={`tabular-nums font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{rial(x.net_rial)}</span>, value: (x) => x.net_rial },
                { label: 'تعداد فاکتور', render: (x) => fa(x.invoice_count), value: (x) => x.invoice_count },
                { label: 'مشتری فعال', render: (x) => fa(x.active_customers), value: (x) => x.active_customers },
                { label: 'سهم فروش', render: (x) => pct(x.share, 2), value: (x) => x.share * 100, unit: '٪' },
                { label: 'درصد مرجوعی', render: (x) => pct(x.return_percent, 2), value: (x) => x.return_percent * 100, unit: '٪' },
                { label: 'درصد تخفیف', render: (x) => pct(x.discount_percent, 2), value: (x) => x.discount_percent * 100, unit: '٪' },
                { label: 'آخرین فروش', render: (x) => x.last_sale ?? '—', value: (x) => x.last_sale ?? '' },
              ]} />
            </AppleCard>
          </>
        )
      }}</Status>
    </div>
  )
}

function VisitorProfile({ p, code, back, openCustomer, openReturns }) {
  const { isDark } = useAppearance()
  const r = useApi(`/visitor/${encodeURIComponent(code)}`, p)
  if (r.error) {
    return (
      <div className="w-full max-w-[1600px] mx-auto p-6">
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 p-5 text-sm flex items-center justify-between">
          <span>ویزیتوری با این کد در این هسته فروش پیدا نشد.</span>
          <button type="button" className="px-4 py-2 rounded-xl bg-white border border-rose-200 text-rose-700 text-xs font-semibold" onClick={back}>
            بازگشت به فهرست
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5">
      <Status state={r}>{(j) => {
        const months = (j.months ?? []).map((m) => ({ ...m, gross: billions(m.sales_rial) }))
        const days = (j.days ?? []).map((d) => ({ ...d, gross: billions(d.sales_rial) }))
        const multi = (j.names?.length > 1) || (j.all_branches?.length > 1)
        const customers = (j.customers ?? []).map((x, idx) => ({ ...x, rank: idx + 1 }))
        const products = (j.products ?? []).map((x, idx) => ({ ...x, rank: idx + 1 }))

        return (
          <>
            {/* Executive Visitor Hero Card */}
            <div
              className={`rounded-2xl sm:rounded-3xl border transition-all p-5 sm:p-6 overflow-hidden relative ${
                isDark
                  ? 'bg-[#0B100E]/90 backdrop-blur-2xl border-emerald-500/20 shadow-[0_12px_40px_rgba(0,0,0,0.5)]'
                  : 'bg-white/95 backdrop-blur-xl border-slate-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.04)]'
              }`}
            >
              <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 opacity-80" />

              {/* Header: Visitor Name, Badges & Quick Stats */}
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-5 border-b border-white/5">
                {/* Right: Avatar + Visitor Name */}
                <div className="flex items-center gap-3.5 sm:gap-4.5 flex-1 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-xl shadow-emerald-900/30 text-2xl font-black">
                      <UserRound size={28} className="text-white" />
                    </div>
                    {j.rank && j.rank <= 3 && (
                      <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-400 text-amber-950 font-black text-xs flex items-center justify-center shadow-md">
                        {j.rank === 1 ? '🥇' : j.rank === 2 ? '🥈' : '🥉'}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        پروفایل ویزیتور
                      </span>
                      {j.rank && (
                        <span className={`px-3 py-0.5 rounded-full text-xs font-extrabold flex items-center gap-1.5 ${
                          j.rank <= 3
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                            : isDark
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          <Award size={13} />
                          رتبه {fa(j.rank)} از {fa(j.visitor_count)} ویزیتور
                        </span>
                      )}
                    </div>
                    <h1 className={`text-xl sm:text-2xl lg:text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {j.name || 'نامشخص'}
                    </h1>
                  </div>
                </div>

                {/* Left: Quick Financial Status Pills + Back Button */}
                <div className="flex items-center gap-3 shrink-0 flex-wrap">
                  <div className={`px-4 py-2.5 rounded-2xl border ${isDark ? 'bg-black/40 border-white/10' : 'bg-slate-50 border-slate-200'} flex items-center gap-3`}>
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                      <CircleDollarSign size={20} />
                    </div>
                    <div>
                      <span className={`text-[10px] block font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>فروش عادی دوره</span>
                      <span className={`text-base font-black tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                        {billions(j.sales_rial).toFixed(1)} <span className="text-xs font-normal">میلیارد ریال</span>
                      </span>
                    </div>
                  </div>

                  <div className={`px-4 py-2.5 rounded-2xl border ${isDark ? 'bg-black/40 border-white/10' : 'bg-slate-50 border-slate-200'} flex items-center gap-3`}>
                    <div className="w-9 h-9 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center shrink-0">
                      <Percent size={20} />
                    </div>
                    <div>
                      <span className={`text-[10px] block font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>سهم از کل فروش</span>
                      <span className={`text-base font-black tabular-nums ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>
                        {pct(j.share, 2)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={back}
                    className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 shadow-xs ${
                      isDark
                        ? 'bg-white/10 hover:bg-white/15 text-slate-100 border border-white/10'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                    }`}
                  >
                    <span>← بازگشت به فهرست</span>
                  </button>
                </div>
              </div>

              {/* Structured Metadata Grid (4 Clean Cards) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 pt-5">
                {/* کد ویزیتور */}
                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50/80 border-slate-200'}`}>
                  <span className={`text-[11px] block font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>کد ویزیتور</span>
                  <span className={`text-xs sm:text-sm font-mono font-bold block ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`} dir="ltr">
                    {j.code}
                  </span>
                </div>

                {/* شعبه */}
                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50/80 border-slate-200'}`}>
                  <span className={`text-[11px] block font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>شعبه‌های فعال</span>
                  <span className={`text-xs sm:text-sm font-bold block truncate ${isDark ? 'text-teal-300' : 'text-teal-700'}`} title={j.all_branches?.join('، ')}>
                    {j.all_branches?.join('، ') || '—'}
                  </span>
                </div>

                {/* بازه فروش */}
                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50/80 border-slate-200'}`}>
                  <span className={`text-[11px] block font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>بازه ثبت فروش</span>
                  <span className={`text-xs sm:text-sm font-medium block tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {j.first_sale ?? '—'} تا {j.last_sale ?? '—'}
                  </span>
                </div>

                {/* روزهای فعال */}
                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50/80 border-slate-200'}`}>
                  <span className={`text-[11px] block font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>روزهای فروش فعال</span>
                  <span className={`text-xs sm:text-sm font-bold block ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                    {fa(j.active_days)} روز کاری
                  </span>
                </div>
              </div>
            </div>

            {multi && (
              <div className={`rounded-2xl border px-5 py-3.5 text-xs leading-relaxed flex items-center gap-2.5 ${
                isDark
                  ? 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                <span className="text-base">⚠️</span>
                <span>
                  این کد با {j.names?.length > 1 ? `چند نام (${j.names.join('، ')})` : ''}{j.names?.length > 1 && j.all_branches?.length > 1 ? ' و ' : ''}{j.all_branches?.length > 1 ? `چند شعبه (${j.all_branches.length})` : ''} ثبت شده است؛ شاخص‌ها بر پایهٔ کد ویزیتور و یکجا محاسبه می‌شوند.
                </span>
              </div>
            )}

            {/* 12 Bento KPI Cards in 2 Symmetrical Rows of 6 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5 sm:gap-3.5 w-full">
              <AppleKpiCard label="فروش عادی" value={rial(j.sales_rial)} unit={`${billions(j.sales_rial).toFixed(1)} میلیارد ریال`} icon={CircleDollarSign} tone="teal" />
              <AppleKpiCard label="ریال خالص" value={rial(j.net_rial)} unit="خالص از پروموشن و تخفیف" icon={Award} tone="green" />
              <AppleKpiCard label="رتبه بین ویزیتورها" value={j.rank ? fa(j.rank) : '—'} unit={j.rank ? `از ${fa(j.visitor_count)} ویزیتور فعال` : '—'} icon={Award} tone="amber" />
              <AppleKpiCard label="سهم از کل فروش" value={pct(j.share, 2)} unit="سهم از فروش عادی کل" icon={PieIcon} tone="blue" />
              <AppleKpiCard label="فاکتور فروش" value={fa(j.sales_invoices)} unit="فقره فاکتور صادرشده" icon={FileText} tone="teal" />
              <AppleKpiCard label="مشتری خریدار" value={fa(j.buying_customers)} unit="مشتری یکتا دارای خرید" icon={Users} tone="green" />
              <AppleKpiCard label="روزهای فروش" value={fa(j.active_days)} unit="روز دارای فاکتور موفق" icon={Calendar} tone="teal" />
              <AppleKpiCard label="میانگین هر فاکتور" value={dash(j.avg_invoice_rial)} unit="ریال به ازای هر فاکتور" icon={TrendingUp} tone="blue" />
              <AppleKpiCard label="میانگین هر مشتری" value={dash(j.avg_customer_rial)} unit="ریال به ازای هر خریدار" icon={UserCheck} tone="green" />
              <AppleKpiCard label="سطرهای فاکتور" value={fa(j.sales_lines)} unit="سطر کالای سفارش‌داده‌شده" icon={Layers} tone="amber" />
              <AppleKpiCard label="تنوع اقلام فاکتور" value={fa2(j.avg_lines_per_invoice)} unit="میانگین سطر در هر فاکتور" icon={Package} tone="teal" />
              <AppleKpiCard label="درصد مرجوعی" value={pct(j.return_percent, 2)} unit="نسبت به فروش عادی" icon={RotateCcw} tone="red" />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full items-stretch">
              <AppleCard title="روند ماهانه فروش ویزیتور" subtitle="میلیارد ریال؛ مستقل از فیلتر ماه" badge="ماهانه">
                <div className="h-72 w-full mt-2" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={months} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="emeraldVisitorMonthly" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" />
                          <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E5E5EA'} strokeDasharray="3 3" />
                      <XAxis dataKey="year_month" reversed tickFormatter={monthName} tickLine={false} axisLine={false} tick={{ fill: isDark ? '#94A3B8' : '#86868B', fontSize: 12, fontFamily: 'Vazirmatn' }} />
                      <YAxis
                        orientation="right"
                        tickFormatter={(v) => (v % 1 === 0 && Math.abs(v) >= 10 ? fa(v) : Number(v).toLocaleString('fa-IR', { maximumFractionDigits: 2 }))}
                        tickLine={false}
                        axisLine={false}
                        width={55}
                        tick={{ fill: isDark ? '#94A3B8' : '#86868B', fontSize: 12, fontFamily: 'Vazirmatn' }}
                      />
                      <Tooltip content={<ChartTip labelFn={monthName} unit="میلیارد ریال" valueFn={(v) => (v == null ? '—' : Number(v).toLocaleString('fa-IR', { minimumFractionDigits: (Number(v) % 1 === 0 && Number(v) >= 10 ? 0 : 1), maximumFractionDigits: 2 }))} />} cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }} />
                      <Bar dataKey="gross" name="فروش عادی" fill="url(#emeraldVisitorMonthly)" radius={[6, 6, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </AppleCard>

              <AppleCard title="روند روزانه فروش ویزیتور" subtitle="میلیارد ریال، در بازهٔ انتخاب‌شده" badge="روزانه">
                {!days.length ? (
                  <div className={`text-center py-20 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>در این بازه فروشی ثبت نشده است.</div>
                ) : (
                  <div className="h-72 w-full mt-2" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={days} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                        <defs>
                          <linearGradient id="emeraldVisitorDaily" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#10B981" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E5E5EA'} strokeDasharray="3 3" />
                        <XAxis dataKey="date" reversed tickFormatter={dayLabel} tickLine={false} axisLine={false} minTickGap={28} tick={{ fill: isDark ? '#94A3B8' : '#86868B', fontSize: 12, fontFamily: 'Vazirmatn' }} />
                        <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={55} tick={{ fill: isDark ? '#94A3B8' : '#86868B', fontSize: 12, fontFamily: 'Vazirmatn' }} />
                        <Tooltip content={<ChartTip labelFn={dayLabel} unit="میلیارد ریال" />} />
                        <Area type="monotone" dataKey="gross" name="فروش عادی" stroke="#10B981" strokeWidth={2.5} fill="url(#emeraldVisitorDaily)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </AppleCard>
            </div>

            {/* SplitPies Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5 w-full items-stretch">
              <SplitPie title="سهم شعبه‌ها" rows={j.branches} />
              <SplitPie title="سهم برندها" rows={j.brands} />
              <SplitPie title="سهم گرید مشتری" rows={j.grades} />
            </div>

            {/* Tables Row: Top Customers + Top Products with Podium Ranking */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full items-start">
              <AppleCard title="مشتریان برتر" subtitle="۲۰ مشتری پرخرید؛ برای مشاهده پروفایل روی هر ردیف کلیک کنید" badge={`${fa(customers.length)} مشتری`}>
                <Table
                  name={`مشتریان-ویزیتور-${j.code}`}
                  rows={customers}
                  onRow={(x) => openCustomer(x.code)}
                  columns={[
                    {
                      label: 'رتبه',
                      render: (x) => {
                        if (x.rank === 1) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400/20 text-amber-300 font-black text-xs border border-amber-400/40 shadow-xs">🥇</span>
                        if (x.rank === 2) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300/20 text-slate-200 font-black text-xs border border-slate-300/40 shadow-xs">🥈</span>
                        if (x.rank === 3) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-500 font-black text-xs border border-amber-600/40 shadow-xs">🥉</span>
                        return <span className={`text-xs font-semibold tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fa(x.rank)}</span>
                      },
                      value: (x) => x.rank,
                    },
                    { label: 'کد', render: (x) => <span className="font-mono text-xs tabular-nums" dir="ltr">{x.code}</span>, value: (x) => String(x.code) },
                    {
                      label: 'نام مشتری',
                      render: (x) => (
                        <span className={`font-bold transition-colors ${isDark ? 'text-slate-100 hover:text-emerald-400' : 'text-slate-900 hover:text-emerald-600'}`}>
                          {x.name ?? '—'}
                        </span>
                      ),
                      value: (x) => String(x.name ?? ''),
                    },
                    {
                      label: 'فروش عادی',
                      render: (x) => (
                        <div className="flex flex-col">
                          <span className={`tabular-nums font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{rial(x.sales_rial)}</span>
                          <span className={`text-[10px] tabular-nums font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {billions(x.sales_rial).toFixed(1)} م.ر
                          </span>
                        </div>
                      ),
                      value: (x) => x.sales_rial,
                      unit: 'ریال',
                    },
                    {
                      label: 'تعداد فاکتور',
                      render: (x) => <span className="tabular-nums font-semibold">{fa(x.invoices)}</span>,
                      value: (x) => x.invoices,
                    },
                  ]}
                />
              </AppleCard>

              <AppleCard title="کالاهای برتر" subtitle="۱۵ کالای پرفروش و پرتقاضا" badge={`${fa(products.length)} کالا`}>
                <Table
                  name={`کالاهای-ویزیتور-${j.code}`}
                  rows={products}
                  columns={[
                    {
                      label: 'رتبه',
                      render: (x) => {
                        if (x.rank === 1) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400/20 text-amber-300 font-black text-xs border border-amber-400/40 shadow-xs">🥇</span>
                        if (x.rank === 2) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300/20 text-slate-200 font-black text-xs border border-slate-300/40 shadow-xs">🥈</span>
                        if (x.rank === 3) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 text-amber-500 font-black text-xs border border-amber-600/40 shadow-xs">🥉</span>
                        return <span className={`text-xs font-semibold tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fa(x.rank)}</span>
                      },
                      value: (x) => x.rank,
                    },
                    {
                      label: 'نام کالا',
                      render: (x) => <span className={`font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{x.name}</span>,
                      value: (x) => String(x.name ?? ''),
                    },
                    {
                      label: 'فروش عادی',
                      render: (x) => (
                        <div className="flex flex-col">
                          <span className={`tabular-nums font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{rial(x.sales_rial)}</span>
                          <span className={`text-[10px] tabular-nums font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {billions(x.sales_rial).toFixed(1)} م.ر
                          </span>
                        </div>
                      ),
                      value: (x) => x.sales_rial,
                      unit: 'ریال',
                    },
                    {
                      label: 'تعداد فروش',
                      render: (x) => <span className="tabular-nums font-bold text-amber-400">{fa(x.qty)} <span className="text-[10px] text-slate-400 font-normal">عدد</span></span>,
                      value: (x) => x.qty,
                    },
                  ]}
                />
              </AppleCard>
            </div>

            <ReturnsProfileCard
              data={j.dispatch_returns}
              entity="ویزیتور"
              onOpen={j.dispatch_returns?.matched_names?.length ? () => openReturns(returnsArg('visitor', j.dispatch_returns.matched_names)) : undefined}
            />
          </>
        )
      }}</Status>
    </div>
  )
}

export function VisitorPage({ p, code, setCode, openCustomer, openReturns }) {
  return code
    ? <VisitorProfile key={code} p={p} code={code} back={() => setCode('')} openCustomer={openCustomer} openReturns={openReturns} />
    : <VisitorList p={p} openVisitor={setCode} />
}

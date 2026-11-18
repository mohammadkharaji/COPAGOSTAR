import React, { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Filter,
  Layers,
  Package,
  Percent,
  RefreshCw,
  Repeat,
  ShoppingBag,
  TrendingUp,
  UserCheck,
  Users,
  Search,
  Sparkles,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { motion, AnimatePresence } from 'motion/react'
import { useApi } from './api'
import { useAppearance } from './AppearanceContext'
import { fa, fa1, fa2, monthLabel } from './format'
import { Table, pct, rial } from './ui'

const DIM_LABELS = { brand: 'برند', main_group: 'گروه کالا', product: 'کالا', sales_type: 'نوع فروش' }
const DRILL_OPTIONS = {
  brand: ['main_group', 'product'],
  main_group: ['product'],
}

const faDate = (k) => {
  if (!k) return '—'
  const s = String(k)
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}/${s.slice(4, 6)}/${s.slice(6)}`
  return s
}

/**
 * Glassmorphic Tooltip for Product Analytics Charts
 */
function ChartTooltip({ active, payload, label, isDark, unit = '', formatter }) {
  if (!active || !payload?.length) return null

  return (
    <div
      dir="rtl"
      className={`rounded-2xl p-3 shadow-2xl backdrop-blur-xl border text-right min-w-[170px] ${
        isDark
          ? 'bg-[#0F1412]/95 border-white/10 text-slate-100 shadow-[0_16px_40px_rgba(0,0,0,0.6)]'
          : 'bg-white/95 border-slate-200 text-slate-900 shadow-xl'
      }`}
    >
      <div className={`pb-1.5 mb-1.5 border-b text-xs font-bold ${
        isDark ? 'border-white/[0.08] text-slate-300' : 'border-slate-100 text-slate-700'
      }`}>
        {label}
      </div>
      <div className="space-y-1.5 text-xs">
        {payload.map((p, idx) => {
          const valStr = formatter ? formatter(p.value, p.name, p) : `${fa(p.value)} ${unit}`
          return (
            <div key={idx} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color || p.fill }} />
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{p.name}:</span>
              </span>
              <b className={`font-sans font-bold tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                {valStr}
              </b>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ProductBrandPage({ p, openProfile }) {
  const { isDark } = useAppearance()

  const [by, setBy] = useState('brand')
  const [sel, setSel] = useState(null) // e.g. { by: 'brand', key: 'سوفیت' }
  const [childBy, setChildBy] = useState(null)

  const children = sel ? DRILL_OPTIONS[sel.by] : null
  const activeChild = sel ? (children && children.includes(childBy) ? childBy : children?.[0] || 'product') : null

  // 1. Fetch breakdown table data
  const breakdownQuery = useMemo(() => {
    if (sel) {
      return { ...p, [sel.by]: sel.key, by: activeChild, limit: 500 }
    }
    return { ...p, by, limit: 60 }
  }, [p, sel, by, activeChild])

  const breakdownRes = useApi('/breakdown', breakdownQuery)
  const rows = Array.isArray(breakdownRes.data) ? breakdownRes.data : []

  // 2. Fetch product metrics data (KPIs, frequency pattern, monthly trends, cycles)
  const metricsQuery = useMemo(() => {
    const q = { ...p, by: sel ? activeChild : by }
    if (sel) {
      q.item_key = sel.key
      q.by = sel.by
    }
    return q
  }, [p, sel, by, activeChild])

  const metricsRes = useApi('/analytics/product-metrics', metricsQuery)
  const metricsData = metricsRes.data || {}
  const kpis = metricsData.kpis || {}
  const freqPattern = metricsData.frequency_pattern || []
  const monthlyTrend = metricsData.monthly_trend || []
  const monthlyDiscount = metricsData.monthly_discount || []
  const itemCycles = metricsData.item_cycles || {}
  const summaryCycle = metricsData.summary_cycle

  // Card appearance
  const cardCls = isDark
    ? 'bg-[#0F1412] border-white/[0.06] text-slate-100 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
    : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'

  const changeBy = (newBy) => {
    setBy(newBy)
    setSel(null)
    setChildBy(null)
  }

  const handleDrill = (key) => {
    if (key == null) return
    if (!sel && DRILL_OPTIONS[by]) {
      setSel({ by, key: String(key) })
      setChildBy(null)
    } else if (sel && sel.by === 'brand' && activeChild === 'main_group') {
      setSel({ by: 'main_group', key: String(key) })
      setChildBy('product')
    } else if (openProfile) {
      openProfile(sel ? activeChild : by, String(key))
    }
  }

  const headLabel = sel ? DIM_LABELS[activeChild] : DIM_LABELS[by] || 'مورد'

  // Top 20 items for chart
  const top20Rows = useMemo(() => {
    return rows.slice(0, 20)
  }, [rows])

  // Enhanced Columns for Table
  const tableColumns = useMemo(() => [
    { label: headLabel, render: (r) => r.key, value: (r) => String(r.key) },
    { label: 'فروش ریالی + مالیات', render: (r) => rial(r.sum_rial_vat), value: (r) => r.sum_rial_vat },
    { label: 'ریال خالص', render: (r) => rial(r.net_rial), value: (r) => r.net_rial },
    { label: 'تعداد فاکتور', render: (r) => fa(r.invoice_count), value: (r) => r.invoice_count },
    { label: 'مشتری فعال', render: (r) => fa(r.active_customers), value: (r) => r.active_customers },
    {
      label: 'فروش کارتنی',
      render: (r) => fa(Math.round(r.sum_qty || 0)),
      value: (r) => r.sum_qty || 0,
    },
    {
      label: 'دوره تناوب خرید',
      render: (r) => {
        const cycle = itemCycles[String(r.key)]
        if (cycle == null) return <span className="text-slate-400">—</span>
        let badgeCls = isDark
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        if (cycle > 35) {
          badgeCls = isDark
            ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
            : 'bg-cyan-50 text-cyan-700 border border-cyan-200'
        } else if (cycle > 14) {
          badgeCls = isDark
            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold tabular-nums font-sans ${badgeCls}`}>
            {fa1(cycle)} روز
          </span>
        )
      },
      value: (r) => itemCycles[String(r.key)] ?? 999,
    },
    { label: 'درصد پروموشن کل', render: (r) => pct(r.promo_percent, 2), value: (r) => (r.promo_percent || 0) * 100, unit: '٪' },
    { label: 'درصد تخفیف', render: (r) => pct(r.discount_percent, 2), value: (r) => (r.discount_percent || 0) * 100, unit: '٪' },
    { label: 'درصد مرجوعی', render: (r) => pct(r.return_percent, 2), value: (r) => (r.return_percent || 0) * 100, unit: '٪' },
  ], [headLabel, itemCycles, isDark])

  // Table summary footer row calculation
  const tableFooter = useMemo(() => {
    if (!rows.length) return null
    const totalGross = rows.reduce((acc, r) => acc + (r.sum_rial_vat || 0), 0)
    const totalNet = rows.reduce((acc, r) => acc + (r.net_rial || 0), 0)
    const totalInvoices = rows.reduce((acc, r) => acc + (r.invoice_count || 0), 0)
    const totalCusts = rows.reduce((acc, r) => acc + (r.active_customers || 0), 0)
    const totalQty = rows.reduce((acc, r) => acc + (r.sum_qty || 0), 0)
    const totalReturns = rows.reduce((acc, r) => acc + (r.returns_rial || 0), 0)
    const totalDiscounts = rows.reduce((acc, r) => acc + (r.promison_rial || 0), 0)
    const totalPromos = rows.reduce((acc, r) => acc + (r.promo_total_rial || 0), 0)

    const avgPromoPct = totalGross > 0 ? totalPromos / totalGross : 0
    const avgDiscPct = totalGross > 0 ? totalDiscounts / totalGross : 0
    const avgReturnPct = totalGross > 0 ? Math.abs(totalReturns) / totalGross : 0

    return [
      () => 'مجموع',
      () => rial(totalGross),
      () => rial(totalNet),
      () => fa(totalInvoices),
      () => fa(totalCusts),
      () => fa(Math.round(totalQty)),
      () => (summaryCycle ? `${fa1(summaryCycle)} روز` : '—'),
      () => pct(avgPromoPct, 2),
      () => pct(avgDiscPct, 2),
      () => pct(avgReturnPct, 2),
    ]
  }, [rows, summaryCycle])

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5 sm:space-y-6">
      {/* ── 1. Floating Dimension & Drilldown Selector ── */}
      <div className={`rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 flex items-center justify-between gap-3 flex-wrap border transition-colors ${cardCls}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isDark ? 'bg-emerald-400 shadow-[0_0_10px_#10B981]' : 'bg-emerald-500'}`} />
            <span className={`text-xs sm:text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              بُعد گزارش:
            </span>
          </div>

          <div className={`flex items-center gap-1 p-1 rounded-2xl border ${
            isDark ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-slate-100 border-slate-200'
          }`} role="tablist">
            {[['brand', 'برند'], ['main_group', 'گروه کالا'], ['product', 'کالا'], ['sales_type', 'نوع فروش']].map(([k, label]) => {
              const active = by === k && !sel
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => changeBy(k)}
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
                      layoutId="productDimTab"
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

        {/* Active Drilldown Pill & Clear Button */}
        {sel && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border ${
              isDark
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}>
              <span>فیلتر عمیق:</span>
              <span className="underline font-black">{sel.key}</span>
              <span className="text-[10px] opacity-75">({DIM_LABELS[sel.by]})</span>
            </div>

            {children && (
              <div className={`flex items-center gap-1 p-1 rounded-xl border ${
                isDark ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-slate-100 border-slate-200'
              }`}>
                {children.map((c) => {
                  const active = activeChild === c
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setChildBy(c)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        active
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-[#090C0B]'
                          : isDark
                          ? 'text-slate-400 hover:text-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      زیرشاخه {DIM_LABELS[c]}
                    </button>
                  )
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setSel(null)
                setChildBy(null)
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all border border-rose-500/20 cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>بازگشت به همه</span>
            </button>
          </div>
        )}

        {!sel && (
          <span className={`text-xs hidden lg:inline font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            💡 روی هر میله نمودار یا سطر جدول برای دریل‌داون کلیک کنید
          </span>
        )}
      </div>

      {/* ── 2. Top 5-Card Unified Executive KPI Strip (Single Row) ── */}
      <div className="grid grid-cols-5 gap-2 sm:gap-2.5 w-full">
        {/* KPI 1: خرید کارتنی */}
        <div className={`rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between transition-all border ${cardCls}`}>
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>خرید کارتنی / تعداد</span>
            <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
              isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
            }`}>
              <Package size={13} />
            </span>
          </div>
          <div className="my-1">
            <div className={`text-base sm:text-lg font-black tabular-nums font-sans tracking-tight truncate ${
              isDark ? 'text-slate-100' : 'text-slate-900'
            }`}>
              {fa(Math.round(kpis.total_cartons || 0))} <span className={`text-[10px] font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>کارتن</span>
            </div>
            <div className={`text-[11px] font-sans font-medium truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              فروش خالص کارتنی
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium pt-1.5 border-t border-white/[0.06] truncate">
            <CheckCircle2 size={11} className="shrink-0" />
            <span className="truncate">حجم ناخالص کالا</span>
          </div>
        </div>

        {/* KPI 2: خرید ریالی */}
        <div className={`rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between transition-all border ${cardCls}`}>
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>خرید ریالی کل</span>
            <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
              isDark ? 'bg-teal-500/15 text-teal-400' : 'bg-teal-50 text-teal-700'
            }`}>
              <CircleDollarSign size={13} />
            </span>
          </div>
          <div className="my-1">
            <div className={`text-base sm:text-lg font-black tabular-nums font-sans tracking-tight truncate ${
              isDark ? 'text-teal-400' : 'text-teal-700'
            }`}>
              {rial(kpis.total_rial || 0)}
            </div>
            <div className={`text-[11px] font-sans font-medium truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              فروش با احتساب مالیات
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-teal-400 font-medium pt-1.5 border-t border-white/[0.06] truncate">
            <Sparkles size={11} className="shrink-0" />
            <span className="truncate">Rial + VAT</span>
          </div>
        </div>

        {/* KPI 3: مشتریان خریدار */}
        <div className={`rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between transition-all border ${cardCls}`}>
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>مشتریان خریدار</span>
            <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
              isDark ? 'bg-cyan-500/15 text-cyan-400' : 'bg-cyan-50 text-cyan-700'
            }`}>
              <Users size={13} />
            </span>
          </div>
          <div className="my-1">
            <div className={`text-base sm:text-lg font-black tabular-nums font-sans tracking-tight truncate ${
              isDark ? 'text-cyan-400' : 'text-cyan-700'
            }`}>
              {fa(kpis.unique_customers || 0)} <span className="text-[10px] font-bold">مشتری</span>
            </div>
            <div className={`text-[11px] font-sans font-medium truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              خریداران یکتا با فاکتور
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-cyan-400 font-medium pt-1.5 border-t border-white/[0.06] truncate">
            <TrendingUp size={11} className="shrink-0" />
            <span className="truncate">پوشش فعال مشتری</span>
          </div>
        </div>

        {/* KPI 4: فروشندگان کالا */}
        <div className={`rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between transition-all border ${cardCls}`}>
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>ویزیتورهای فعال</span>
            <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
              isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-700'
            }`}>
              <UserCheck size={13} />
            </span>
          </div>
          <div className="my-1">
            <div className={`text-base sm:text-lg font-black tabular-nums font-sans tracking-tight truncate ${
              isDark ? 'text-amber-400' : 'text-amber-700'
            }`}>
              {fa(kpis.unique_sellers || 0)} <span className="text-[10px] font-bold">ویزیتور</span>
            </div>
            <div className={`text-[11px] font-sans font-medium truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              ویزیتور با فروش موفق
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-amber-400 font-medium pt-1.5 border-t border-white/[0.06] truncate">
            <CheckCircle2 size={11} className="shrink-0" />
            <span className="truncate">نیروی فروش درگیر</span>
          </div>
        </div>

        {/* KPI 5: تاریخ آخرین خرید */}
        <div className={`rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between transition-all border ${cardCls}`}>
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>آخرین تاریخ خرید</span>
            <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
              isDark ? 'bg-purple-500/15 text-purple-400' : 'bg-purple-50 text-purple-700'
            }`}>
              <Calendar size={13} />
            </span>
          </div>
          <div className="my-1">
            <div className={`text-base sm:text-lg font-black tabular-nums font-sans tracking-tight truncate ${
              isDark ? 'text-purple-400' : 'text-purple-700'
            }`}>
              {faDate(kpis.last_purchase_date)}
            </div>
            <div className={`text-[11px] font-sans font-medium truncate ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              آخرین سفارش ثبت‌شده
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-purple-400 font-medium pt-1.5 border-t border-white/[0.06] truncate">
            <Clock size={11} className="shrink-0" />
            <span className="truncate">تازگی داده‌های فروش</span>
          </div>
        </div>
      </div>

      {/* ── 3. Three Analytical Trend Charts ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 items-stretch">
        {/* Chart 1: الگوی تناوب خرید مشتریان */}
        <div className={`rounded-[24px] sm:rounded-[28px] p-5 flex flex-col justify-between border transition-colors ${cardCls}`}>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2 h-2 rounded-full ${isDark ? 'bg-emerald-400 shadow-[0_0_8px_#10B981]' : 'bg-emerald-500'}`} />
              <div>
                <h3 className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  الگوی تناوب خرید مشتریان
                </h3>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  توزیع بازه تکرار خرید (میانگین روز بین سفارشات)
                </p>
              </div>
            </div>

            <div className="h-[210px] w-full mt-2" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={freqPattern} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'} />
                  <XAxis
                    dataKey="interval"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 10, fontFamily: 'Vazirmatn' }}
                  />
                  <YAxis
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => fa(v)}
                    tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 10, fontFamily: 'Vazirmatn' }}
                    width={40}
                  />
                  <Tooltip
                    content={<ChartTooltip isDark={isDark} formatter={(val, name, item) => `${fa(val)} مشتری (${fa1(item?.payload?.percent)}٪)`} />}
                  />
                  <Bar dataKey="count" name="تعداد مشتری" radius={[6, 6, 0, 0]} maxBarSize={38}>
                    {freqPattern.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color || '#10B981'} />
                    ))}
                    <LabelList
                      dataKey="percent"
                      position="top"
                      formatter={(val) => `${fa1(val)}٪`}
                      style={{
                        fill: isDark ? '#94A3B8' : '#475569',
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: 'Vazirmatn',
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Frequency Breakdown Footers */}
          <div className={`pt-2.5 mt-2 border-t grid grid-cols-4 gap-1.5 text-center text-[10px] ${
            isDark ? 'border-white/[0.06]' : 'border-slate-100'
          }`}>
            {freqPattern.map((f) => (
              <div key={f.key} className={`p-1.5 rounded-xl border ${
                isDark ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-slate-50 border-slate-200/60'
              }`}>
                <span className={`block truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{f.interval}</span>
                <span className="font-bold tabular-nums font-sans block mt-0.5" style={{ color: f.color }}>
                  {fa(f.count)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: الگوی ماهانه خرید کالا */}
        <div className={`rounded-[24px] sm:rounded-[28px] p-5 flex flex-col justify-between border transition-colors ${cardCls}`}>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2 h-2 rounded-full ${isDark ? 'bg-teal-400 shadow-[0_0_8px_#14B8A6]' : 'bg-teal-500'}`} />
              <div>
                <h3 className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  الگوی ماهانه خرید کالا
                </h3>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  روند ماهانه مشتریان خریدار و حجم کارتنی
                </p>
              </div>
            </div>

            <div className="h-[210px] w-full mt-2" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'} />
                  <XAxis
                    dataKey="month_label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 10, fontFamily: 'Vazirmatn' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => fa(v)}
                    tick={{ fill: '#0EA5E9', fontSize: 10, fontFamily: 'Vazirmatn' }}
                    width={40}
                  />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => fa(Math.round(v))}
                    tick={{ fill: '#10B981', fontSize: 10, fontFamily: 'Vazirmatn' }}
                    width={40}
                  />
                  <Tooltip
                    content={<ChartTooltip isDark={isDark} formatter={(val, name) => name === 'unique_customers' ? `${fa(val)} مشتری` : `${fa(Math.round(val))} کارتن`} />}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: 10, paddingBottom: 6, fontFamily: 'Vazirmatn' }}
                    formatter={(val) => (val === 'unique_customers' ? 'مشتریان خریدار' : 'فروش کارتنی')}
                  />
                  <Bar yAxisId="right" dataKey="unique_customers" name="unique_customers" fill="#0EA5E9" radius={[4, 4, 0, 0]} maxBarSize={18} />
                  <Bar yAxisId="left" dataKey="carton_qty" name="carton_qty" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={`pt-2.5 mt-2 border-t flex items-center justify-between text-[11px] ${
            isDark ? 'border-white/[0.06] text-slate-400' : 'border-slate-100 text-slate-500'
          }`}>
            <span>ابتدا: <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>{monthlyTrend[0]?.month_label || '—'}</strong></span>
            <span>انتها: <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>{monthlyTrend[monthlyTrend.length - 1]?.month_label || '—'}</strong></span>
          </div>
        </div>

        {/* Chart 3: الگوی ماهانه تخفیف و پروموشن */}
        <div className={`rounded-[24px] sm:rounded-[28px] p-5 flex flex-col justify-between border transition-colors ${cardCls}`}>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2 h-2 rounded-full ${isDark ? 'bg-amber-400 shadow-[0_0_8px_#F59E0B]' : 'bg-amber-500'}`} />
              <div>
                <h3 className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  الگوی ماهانه تخفیف و پروموشن
                </h3>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  درصد تخفیفات فاکتور و کل پروموشن‌ها به تفکیک ماه
                </p>
              </div>
            </div>

            <div className="h-[210px] w-full mt-2" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyDiscount} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'} />
                  <XAxis
                    dataKey="month_label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 10, fontFamily: 'Vazirmatn' }}
                  />
                  <YAxis
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${fa1(v)}٪`}
                    tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 10, fontFamily: 'Vazirmatn' }}
                    width={40}
                  />
                  <Tooltip
                    content={<ChartTooltip isDark={isDark} formatter={(val, name) => `${fa2(val)}٪`} />}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: 10, paddingBottom: 6, fontFamily: 'Vazirmatn' }}
                    formatter={(val) => (val === 'discount_pct' ? 'درصد تخفیف' : 'درصد پروموشن')}
                  />
                  <Bar dataKey="discount_pct" name="discount_pct" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="promo_pct" name="promo_pct" fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={`pt-2.5 mt-2 border-t flex items-center justify-between text-[11px] ${
            isDark ? 'border-white/[0.06] text-slate-400' : 'border-slate-100 text-slate-500'
          }`}>
            <span>میانگین تخفیف: <strong className="text-amber-400 font-bold">{fa2(monthlyDiscount.reduce((acc, m) => acc + m.discount_pct, 0) / (monthlyDiscount.length || 1))}٪</strong></span>
            <span>میانگین پروموشن: <strong className="text-rose-400 font-bold">{fa2(monthlyDiscount.reduce((acc, m) => acc + m.promo_pct, 0) / (monthlyDiscount.length || 1))}٪</strong></span>
          </div>
        </div>
      </div>

      {/* ── 4. Top 20 Breakdown Ranking Bar Chart ── */}
      <div className={`rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 border transition-colors ${cardCls}`}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isDark ? 'bg-emerald-400 shadow-[0_0_10px_#10B981]' : 'bg-emerald-500'}`} />
            <div>
              <h3 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                ۲۰ {headLabel} برتر بر پایه فروش ریالی
              </h3>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                برای فیلتر روی هر {headLabel} و بررسی زیرشاخه‌های آن، روی میله مربوطه کلیک کنید
              </p>
            </div>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-xl ${
            isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-800'
          }`}>
            {fa(top20Rows.length)} مورد برتر
          </span>
        </div>

        <div className="h-[250px] w-full mt-2" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top20Rows} margin={{ top: 20, right: 10, left: 0, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'} />
              <XAxis
                dataKey="key"
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={top20Rows.length > 8 ? -30 : 0}
                textAnchor={top20Rows.length > 8 ? 'end' : 'middle'}
                tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 10, fontFamily: 'Vazirmatn' }}
              />
              <YAxis
                orientation="right"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => rial(v)}
                tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 10, fontFamily: 'Vazirmatn' }}
                width={72}
              />
              <Tooltip
                content={<ChartTooltip isDark={isDark} formatter={(val) => rial(val)} />}
              />
              <Bar
                dataKey="sum_rial_vat"
                name="فروش ریالی"
                radius={[6, 6, 0, 0]}
                maxBarSize={42}
                onClick={(entry) => handleDrill(entry.key)}
                cursor="pointer"
              >
                {top20Rows.map((entry, idx) => (
                  <Cell
                    key={`bar-${idx}`}
                    fill={sel?.key === String(entry.key) ? '#10B981' : isDark ? '#059669' : '#10B981'}
                    className="hover:opacity-80 transition-opacity"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 5. Enhanced Detailed Ledger Table ── */}
      <div className={`rounded-[24px] sm:rounded-[28px] p-5 sm:p-7 border transition-colors ${cardCls}`}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isDark ? 'bg-cyan-400 shadow-[0_0_10px_#06B6D4]' : 'bg-cyan-500'}`} />
            <div>
              <h3 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {sel ? `جدول تفصیلی زیرشاخه‌های «${sel.key}»` : `جدول تفصیلی تحلیل ${headLabel}`}
              </h3>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                شامل فروش کارتنی، دوره تناوب خرید (فاصله خرید مجدد)، درصد تخفیف و مرجوعی
              </p>
            </div>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-xl tabular-nums ${
            isDark ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-50 text-cyan-800'
          }`}>
            {fa(rows.length)} ردیف
          </span>
        </div>

        <Table
          name={sel ? `جدول-${sel.key}-${activeChild}` : `جدول-${by}`}
          rows={rows}
          columns={tableColumns}
          footer={tableFooter}
          onRow={(r) => handleDrill(r.key)}
        />
      </div>
    </div>
  )
}

export default ProductBrandPage
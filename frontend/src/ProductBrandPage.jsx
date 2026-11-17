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
import { useApi } from './api'
import { useAppearance } from './AppearanceContext'
import { fa, fa1, fa2, monthLabel } from './format'
import { ChartTip, Table, pct, rial } from './ui'

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

export function ProductBrandPage({ p, openProfile }) {
  const { isDark, isSolid } = useAppearance()

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

  // Appearance classes
  const glassCard = isSolid
    ? isDark
      ? 'bg-[#18181B] border border-zinc-800 shadow-sm'
      : 'bg-white border border-slate-200 shadow-sm'
    : isDark
    ? 'bg-[#1C1C1E]/80 backdrop-blur-xl border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.3)]'
    : 'bg-white/85 backdrop-blur-xl border border-black/[0.06] shadow-[0_4px_20px_rgb(0,0,0,0.03)]'

  const glassPill = isSolid
    ? isDark
      ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
      : 'bg-slate-100 text-slate-700 border border-slate-200'
    : isDark
    ? 'bg-white/[0.06] text-zinc-300 border border-white/[0.08]'
    : 'bg-black/[0.04] text-slate-700 border border-black/[0.05]'

  const glassPillActive = 'bg-[#0071E3] text-white shadow-sm font-bold border-transparent'

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
        if (cycle == null) return <span className="text-zinc-400 dark:text-zinc-500">—</span>
        let badgeCls = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
        if (cycle > 35) badgeCls = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
        else if (cycle > 14) badgeCls = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${badgeCls}`}>
            {fa1(cycle)} روز
          </span>
        )
      },
      value: (r) => itemCycles[String(r.key)] ?? 999,
    },
    { label: 'درصد پروموشن کل', render: (r) => pct(r.promo_percent, 2), value: (r) => (r.promo_percent || 0) * 100, unit: '٪' },
    { label: 'درصد تخفیف', render: (r) => pct(r.discount_percent, 2), value: (r) => (r.discount_percent || 0) * 100, unit: '٪' },
    { label: 'درصد مرجوعی', render: (r) => pct(r.return_percent, 2), value: (r) => (r.return_percent || 0) * 100, unit: '٪' },
  ], [headLabel, itemCycles])

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
    <div className="w-full max-w-[1600px] mx-auto space-y-4 px-1 pb-12 font-sans select-none">
      {/* 1. Header & Dimension Selector (Floating Glass Filter Bar) */}
      <div className={`rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 flex-wrap ${glassCard}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0071E3] animate-pulse" />
            <span className="text-xs sm:text-sm font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7]">
              بُعد گزارش:
            </span>
          </div>

          <div className="flex items-center gap-1 p-1 bg-black/[0.04] dark:bg-white/[0.05] rounded-xl flex-wrap">
            {[['brand', 'برند'], ['main_group', 'گروه کالا'], ['product', 'کالا'], ['sales_type', 'نوع فروش']].map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => changeBy(k)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  by === k && !sel ? glassPillActive : 'text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Active Drilldown Pill & Clear Button */}
        {sel && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1 bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20 rounded-xl text-xs font-extrabold">
              <span>فیلتر عمیق:</span>
              <span className="underline">{sel.key}</span>
              <span className="text-[10px] text-[#0071E3]/70">({DIM_LABELS[sel.by]})</span>
            </div>

            {children && (
              <div className="flex items-center gap-1 p-0.5 bg-black/[0.04] dark:bg-white/[0.05] rounded-xl text-xs">
                {children.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChildBy(c)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      activeChild === c ? glassPillActive : 'text-[#86868B]'
                    }`}
                  >
                    زیرشاخه {DIM_LABELS[c]}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setSel(null)
                setChildBy(null)
              }}
              className="flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition-all border border-rose-500/20"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>بازگشت به همه</span>
            </button>
          </div>
        )}

        {!sel && (
          <span className="text-[11px] text-[#86868B] dark:text-[#98989D] hidden lg:inline font-medium">
            💡 برای فیلتر و بررسی دقیق، روی میله‌های نمودار یا ردیف‌های جدول کلیک کنید
          </span>
        )}
      </div>

      {/* 2. Top 5 Summary KPI Cards (Compact, Single-Row Responsive Glass Grid) */}
      <div className="product-kpi-grid">
        {/* KPI 1: خرید کارتنی / تعدادی */}
        <div className={`rounded-xl p-2.5 flex flex-col justify-between transition-all hover:scale-[1.01] ${glassCard}`}>
          <div className="flex items-center justify-between text-[#0071E3]">
            <span className="text-[11px] font-bold text-[#86868B] dark:text-[#98989D] truncate">
              خرید کارتنی / تعدادی
            </span>
            <div className="w-5 h-5 rounded-md bg-[#0071E3]/10 flex items-center justify-center shrink-0">
              <Package className="w-3 h-3" />
            </div>
          </div>
          <div className="my-1">
            <span className="text-lg sm:text-xl font-black text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums tracking-tight">
              {fa(Math.round(kpis.total_cartons || 0))}
            </span>
            <p className="text-[10px] text-[#86868B] dark:text-[#98989D] font-medium truncate">
              کارتن خالص فروش
            </p>
          </div>
          <div className="pt-1 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-[9px]">
            <span className="text-[#86868B]">واحد</span>
            <span className="font-bold text-[#0071E3]">کارتن</span>
          </div>
        </div>

        {/* KPI 2: خرید ریالی */}
        <div className={`rounded-xl p-2.5 flex flex-col justify-between transition-all hover:scale-[1.01] ${glassCard}`}>
          <div className="flex items-center justify-between text-[#10B981]">
            <span className="text-[11px] font-bold text-[#86868B] dark:text-[#98989D] truncate">
              خرید ریالی
            </span>
            <div className="w-5 h-5 rounded-md bg-[#10B981]/10 flex items-center justify-center shrink-0">
              <CircleDollarSign className="w-3 h-3" />
            </div>
          </div>
          <div className="my-1">
            <span className="text-lg sm:text-xl font-black text-[#10B981] tabular-nums tracking-tight">
              {rial(kpis.total_rial || 0)}
            </span>
            <p className="text-[10px] text-[#86868B] dark:text-[#98989D] font-medium truncate">
              فروش با مالیات
            </p>
          </div>
          <div className="pt-1 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-[9px]">
            <span className="text-[#86868B]">مبنا</span>
            <span className="font-bold text-[#10B981]">Rial+VAT</span>
          </div>
        </div>

        {/* KPI 3: تعداد مشتریان خریدار */}
        <div className={`rounded-xl p-2.5 flex flex-col justify-between transition-all hover:scale-[1.01] ${glassCard}`}>
          <div className="flex items-center justify-between text-[#0D9488]">
            <span className="text-[11px] font-bold text-[#86868B] dark:text-[#98989D] truncate">
              مشتریان خریدار
            </span>
            <div className="w-5 h-5 rounded-md bg-[#0D9488]/10 flex items-center justify-center shrink-0">
              <Users className="w-3 h-3" />
            </div>
          </div>
          <div className="my-1">
            <span className="text-lg sm:text-xl font-black text-[#0D9488] tabular-nums tracking-tight">
              {fa(kpis.unique_customers || 0)}
            </span>
            <p className="text-[10px] text-[#86868B] dark:text-[#98989D] font-medium truncate">
              مشتری دارای فاکتور
            </p>
          </div>
          <div className="pt-1 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-[9px]">
            <span className="text-[#86868B]">خریدار یکتا</span>
            <span className="font-bold text-[#0D9488]">Unique</span>
          </div>
        </div>

        {/* KPI 4: تعداد فروشندگان کالا */}
        <div className={`rounded-xl p-2.5 flex flex-col justify-between transition-all hover:scale-[1.01] ${glassCard}`}>
          <div className="flex items-center justify-between text-[#6366F1]">
            <span className="text-[11px] font-bold text-[#86868B] dark:text-[#98989D] truncate">
              فروشندگان کالا
            </span>
            <div className="w-5 h-5 rounded-md bg-[#6366F1]/10 flex items-center justify-center shrink-0">
              <UserCheck className="w-3 h-3" />
            </div>
          </div>
          <div className="my-1">
            <span className="text-lg sm:text-xl font-black text-[#6366F1] tabular-nums tracking-tight">
              {fa(kpis.unique_sellers || 0)}
            </span>
            <p className="text-[10px] text-[#86868B] dark:text-[#98989D] font-medium truncate">
              ویزیتور با فروش موفق
            </p>
          </div>
          <div className="pt-1 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-[9px]">
            <span className="text-[#86868B]">پوشش</span>
            <span className="font-bold text-[#6366F1]">Sellers</span>
          </div>
        </div>

        {/* KPI 5: تاریخ آخرین خرید */}
        <div className={`rounded-xl p-2.5 flex flex-col justify-between transition-all hover:scale-[1.01] ${glassCard}`}>
          <div className="flex items-center justify-between text-[#8B5CF6]">
            <span className="text-[11px] font-bold text-[#86868B] dark:text-[#98989D] truncate">
              آخرین تاریخ خرید
            </span>
            <div className="w-5 h-5 rounded-md bg-[#8B5CF6]/10 flex items-center justify-center shrink-0">
              <Calendar className="w-3 h-3" />
            </div>
          </div>
          <div className="my-1">
            <span className="text-base sm:text-lg font-black text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums tracking-tight">
              {faDate(kpis.last_purchase_date)}
            </span>
            <p className="text-[10px] text-[#86868B] dark:text-[#98989D] font-medium truncate">
              آخرین سفارش ثبت‌شده
            </p>
          </div>
          <div className="pt-1 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-[9px]">
            <span className="text-[#86868B]">تازگی</span>
            <span className="font-bold text-[#8B5CF6]">Last Date</span>
          </div>
        </div>
      </div>

      {/* 3. Three New Analytical Charts (3-Column Glass Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Chart 1: الگوی تناوب خرید مشتریان (Customer Purchase Frequency Pattern) */}
        <div className={`rounded-2xl p-4 flex flex-col justify-between ${glassCard}`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#10B981]/10 text-[#10B981] flex items-center justify-center">
                  <Repeat className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    الگوی تناوب خرید مشتریان
                  </h3>
                  <span className="text-[10px] text-[#86868B] dark:text-[#98989D]">
                    توزیع بازه تکرار خرید (میانگین روز بین سفارشات)
                  </span>
                </div>
              </div>
            </div>

            <div className="h-[210px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={freqPattern} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#2C2C2E' : '#E5E5EA'} />
                  <XAxis
                    dataKey="interval"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: isDark ? '#98989D' : '#86868B', fontSize: 10, fontWeight: 600 }}
                  />
                  <YAxis
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => fa(v)}
                    tick={{ fill: isDark ? '#98989D' : '#86868B', fontSize: 10 }}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                      borderColor: isDark ? '#2C2C2E' : '#E5E5EA',
                      borderRadius: '12px',
                      fontSize: '11px',
                      direction: 'rtl',
                    }}
                    formatter={(val, name, item) => [
                      `${fa(val)} مشتری (${fa1(item.payload.percent)}٪)`,
                      'تعداد مشتریان',
                    ]}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44}>
                    {freqPattern.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                    <LabelList
                      dataKey="percent"
                      position="top"
                      formatter={(val) => `${fa1(val)}٪`}
                      style={{
                        fill: isDark ? '#F5F5F7' : '#1D1D1F',
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Frequency Breakdown Footers */}
          <div className="pt-2 mt-1 border-t border-black/[0.04] dark:border-white/[0.05] grid grid-cols-4 gap-1 text-center text-[9px]">
            {freqPattern.map((f) => (
              <div key={f.key} className="p-1 rounded-lg bg-black/[0.02] dark:bg-white/[0.02]">
                <span className="text-[#86868B] block truncate">{f.interval}</span>
                <span className="font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums block mt-0.5" style={{ color: f.color }}>
                  {fa(f.count)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: الگوی ماهانه خرید کالا (Monthly Purchase Trend) */}
        <div className={`rounded-2xl p-4 flex flex-col justify-between ${glassCard}`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    الگوی ماهانه خرید کالا
                  </h3>
                  <span className="text-[10px] text-[#86868B] dark:text-[#98989D]">
                    روند ماهانه مشتریان خریدار و حجم کارتنی
                  </span>
                </div>
              </div>
            </div>

            <div className="h-[210px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#2C2C2E' : '#E5E5EA'} />
                  <XAxis
                    dataKey="month_label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: isDark ? '#98989D' : '#86868B', fontSize: 10, fontWeight: 600 }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => fa(v)}
                    tick={{ fill: '#0071E3', fontSize: 10 }}
                    width={40}
                  />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => fa(Math.round(v))}
                    tick={{ fill: '#10B981', fontSize: 10 }}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                      borderColor: isDark ? '#2C2C2E' : '#E5E5EA',
                      borderRadius: '12px',
                      fontSize: '11px',
                      direction: 'rtl',
                    }}
                    formatter={(val, name) => [
                      name === 'unique_customers' ? `${fa(val)} مشتری` : `${fa(Math.round(val))} کارتن`,
                      name === 'unique_customers' ? 'مشتریان خریدار' : 'فروش کارتنی',
                    ]}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: 10, paddingBottom: 6 }}
                    formatter={(val) => (val === 'unique_customers' ? 'مشتریان خریدار' : 'فروش کارتنی')}
                  />
                  <Bar yAxisId="right" dataKey="unique_customers" fill="#0071E3" radius={[4, 4, 0, 0]} maxBarSize={18} />
                  <Bar yAxisId="left" dataKey="carton_qty" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-2 mt-1 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-[10px] text-[#86868B]">
            <span>ماه ابتدایی: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{monthlyTrend[0]?.month_label || '—'}</strong></span>
            <span>آخرین ماه: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{monthlyTrend[monthlyTrend.length - 1]?.month_label || '—'}</strong></span>
          </div>
        </div>

        {/* Chart 3: الگوی ماهانه تخفیف کالا (Monthly Discount / Promotion Pattern) */}
        <div className={`rounded-2xl p-4 flex flex-col justify-between ${glassCard}`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#F59E0B]/10 text-[#F59E0B] flex items-center justify-center">
                  <Percent className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    الگوی ماهانه تخفیف و پروموشن
                  </h3>
                  <span className="text-[10px] text-[#86868B] dark:text-[#98989D]">
                    درصد تخفیفات فاکتور و کل پروموشن‌ها به تفکیک ماه
                  </span>
                </div>
              </div>
            </div>

            <div className="h-[210px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyDiscount} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#2C2C2E' : '#E5E5EA'} />
                  <XAxis
                    dataKey="month_label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: isDark ? '#98989D' : '#86868B', fontSize: 10, fontWeight: 600 }}
                  />
                  <YAxis
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${fa1(v)}٪`}
                    tick={{ fill: isDark ? '#98989D' : '#86868B', fontSize: 10 }}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                      borderColor: isDark ? '#2C2C2E' : '#E5E5EA',
                      borderRadius: '12px',
                      fontSize: '11px',
                      direction: 'rtl',
                    }}
                    formatter={(val, name) => [
                      `${fa2(val)}٪`,
                      name === 'discount_pct' ? 'درصد تخفیف' : 'درصد کل پروموشن',
                    ]}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: 10, paddingBottom: 6 }}
                    formatter={(val) => (val === 'discount_pct' ? 'درصد تخفیف' : 'درصد پروموشن')}
                  />
                  <Bar dataKey="discount_pct" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="promo_pct" fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-2 mt-1 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-[10px] text-[#86868B]">
            <span>میانگین تخفیف: <strong className="text-[#F59E0B] font-bold">{fa2(monthlyDiscount.reduce((acc, m) => acc + m.discount_pct, 0) / (monthlyDiscount.length || 1))}٪</strong></span>
            <span>میانگین پروموشن: <strong className="text-[#F43F5E] font-bold">{fa2(monthlyDiscount.reduce((acc, m) => acc + m.promo_pct, 0) / (monthlyDiscount.length || 1))}٪</strong></span>
          </div>
        </div>
      </div>

      {/* 4. Top 20 Breakdown Ranking Bar Chart */}
      <div className={`rounded-2xl p-4 ${glassCard}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7]">
                ۲۰ {headLabel} برتر بر اساس فروش ریالی
              </h3>
              <span className="text-[10px] text-[#86868B] dark:text-[#98989D]">
                کلیک روی هر میله برای فیلتر و تمرکز روی آن {headLabel}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-[#0071E3] bg-[#0071E3]/10 px-2 py-0.5 rounded-lg tabular-nums">
            {fa(top20Rows.length)} مورد
          </span>
        </div>

        <div className="h-[240px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top20Rows} margin={{ top: 20, right: 10, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#2C2C2E' : '#E5E5EA'} />
              <XAxis
                dataKey="key"
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={top20Rows.length > 8 ? -30 : 0}
                textAnchor={top20Rows.length > 8 ? 'end' : 'middle'}
                tick={{ fill: isDark ? '#98989D' : '#86868B', fontSize: 10, fontWeight: 600 }}
              />
              <YAxis
                orientation="right"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => rial(v)}
                tick={{ fill: isDark ? '#98989D' : '#86868B', fontSize: 10 }}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                  borderColor: isDark ? '#2C2C2E' : '#E5E5EA',
                  borderRadius: '12px',
                  fontSize: '11px',
                  direction: 'rtl',
                }}
                formatter={(val) => [rial(val), 'فروش ریالی']}
              />
              <Bar
                dataKey="sum_rial_vat"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
                onClick={(entry) => handleDrill(entry.key)}
                cursor="pointer"
              >
                {top20Rows.map((entry, idx) => (
                  <Cell
                    key={`bar-${idx}`}
                    fill={sel?.key === String(entry.key) ? '#0071E3' : '#3B82F6'}
                    className="hover:opacity-80 transition-opacity"
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. Enhanced Detailed Table (جدول تفصیلی) with Carton Qty & Repurchase Cycle Badge */}
      <div className={`rounded-2xl p-4 ${glassCard}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7]">
                {sel ? `جدول تفصیلی زیرشاخه‌های «${sel.key}»` : `جدول تفصیلی تحلیل ${headLabel}`}
              </h3>
              <span className="text-[10px] text-[#86868B] dark:text-[#98989D]">
                شامل فروش کارتنی، دوره تناوب خرید (فاصله خرید مجدد)، تخفیف و مرجوعی
              </span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-[#0071E3] bg-[#0071E3]/10 px-2.5 py-1 rounded-lg tabular-nums">
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

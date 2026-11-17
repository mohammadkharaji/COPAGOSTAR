import React, { useMemo, useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Layers,
  MapPin,
  Package,
  Percent,
  RefreshCw,
  Repeat,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useApi } from './api'
import { useAppearance } from './AppearanceContext'
import { billions, fa, fa2, faDigits } from './format'

const METRIC_OPTIONS = [
  { id: 'churn_rate', label: 'نرخ ریزش', en: 'Churn Rate', unit: '٪', isPercent: true, higherIsBad: true, icon: TrendingDown },
  { id: 'returning_rate', label: 'نرخ بازگشت', en: 'Returning Rate', unit: '٪', isPercent: true, higherIsBad: false, icon: TrendingUp },
  { id: 'clv_qty', label: 'CLV (تعداد)', en: 'CLV Qty', unit: 'کارتن', isPercent: false, icon: Package },
  { id: 'avg_order_size', label: 'میانگین هر فاکتور', en: 'Avg Order Size', unit: 'کارتن', isPercent: false, icon: ShoppingBag },
  { id: 'avg_sku', label: 'تنوع کالای فاکتور', en: 'Avg SKU', unit: 'قلم', isPercent: false, icon: Layers },
  { id: 'avg_category', label: 'تنوع گروه کالا', en: 'Avg Category', unit: 'گروه', isPercent: false, icon: Activity },
]

export default function CustomerMetricsPage({ p, core, setCore, openCustomer }) {
  const { isDark, isSolid } = useAppearance()

  // Local filters
  const [targetMonth, setTargetMonth] = useState('140508')
  const [lookback, setLookback] = useState('prev_1m')
  const [branch, setBranch] = useState('')
  const [geoMode, setGeoMode] = useState('branch') // 'branch' or 'region'
  const [selectedMetric, setSelectedMetric] = useState('churn_rate')

  // Fetch metrics data from API
  const query = useMemo(() => {
    const q = { core, lookback }
    if (targetMonth) q.target_month = targetMonth
    if (branch) q.branch = branch
    if (p.v) q.v = p.v
    return q
  }, [core, targetMonth, lookback, branch, p.v])

  const apiRes = useApi('/analytics/customer-metrics', query)
  const data = apiRes.data
  const loading = apiRes.loading

  const metrics = data?.metrics || {}
  const activeMetricObj = METRIC_OPTIONS.find((m) => m.id === selectedMetric) || METRIC_OPTIONS[0]

  // Appearance-dependent styling classes
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

  const glassPillActive = isDark
    ? 'bg-[#0071E3] text-white shadow-[0_2px_10px_rgba(0,113,227,0.4)] border-transparent'
    : 'bg-[#0071E3] text-white shadow-[0_2px_10px_rgba(0,113,227,0.3)] border-transparent'

  // Dynamic bar color mapper based on metric
  const getBrandBarColor = (item) => {
    const val = item[selectedMetric]
    if (selectedMetric === 'churn_rate') {
      if (val >= 65) return '#F43F5E' // Coral / Rose
      if (val >= 50) return '#F59E0B' // Amber
      return '#10B981' // Emerald
    }
    if (selectedMetric === 'returning_rate') {
      if (val >= 45) return '#10B981' // Emerald
      if (val >= 25) return '#F59E0B' // Amber
      return '#F43F5E' // Coral
    }
    if (selectedMetric === 'clv_qty') return '#0071E3'
    if (selectedMetric === 'avg_order_size') return '#6366F1'
    if (selectedMetric === 'avg_sku') return '#8B5CF6'
    return '#0EA5E9'
  }

  const getGeoBarColor = (item) => {
    const val = item[selectedMetric]
    if (selectedMetric === 'churn_rate') {
      if (val >= 65) return '#F43F5E'
      if (val >= 50) return '#F59E0B'
      return '#10B981'
    }
    if (selectedMetric === 'returning_rate') {
      if (val >= 45) return '#10B981'
      if (val >= 25) return '#F59E0B'
      return '#F43F5E'
    }
    if (selectedMetric === 'clv_qty') return '#2563EB'
    if (selectedMetric === 'avg_order_size') return '#4F46E5'
    if (selectedMetric === 'avg_sku') return '#7C3AED'
    return '#0284C7'
  }

  // Top brands list (clean & sorted)
  const brandChartData = useMemo(() => {
    if (!data?.breakdown_brand) return []
    return [...data.breakdown_brand]
      .filter((b) => b.active_custs > 10)
      .slice(0, 8)
  }, [data?.breakdown_brand])

  // Branches/Regions list (sorted by selected metric or active customers)
  const geoChartData = useMemo(() => {
    const list = geoMode === 'branch' ? data?.breakdown_branch : data?.breakdown_region
    if (!list) return []
    return [...list]
      .filter((g) => g.active_custs > 5)
      .sort((a, b) => (b[selectedMetric] || 0) - (a[selectedMetric] || 0))
      .slice(0, 10)
  }, [data, geoMode, selectedMetric])

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-4 sm:space-y-5 pb-12" dir="rtl">
      {/* ─────────────────────────────────────────────────────────────
          1. Subheader: Cohort Badge, Calculation Period & Core Quick Toggle
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5 pb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-tight bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20">
            <Sparkles className="w-3.5 h-3.5" />
            آنالیز رفتاری و کوهورت مشتریان (Cohort Analytics)
          </span>
          <span className="text-xs font-semibold text-[#86868B] dark:text-[#98989D]">
            {data?.target_month_label ? `دوره محاسباتی: ${data.target_month_label}` : 'در حال بارگذاری…'}
          </span>
        </div>

        {/* Core Quick Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#86868B] dark:text-[#98989D]">کانال فروش:</span>
          <div className={`p-1 rounded-2xl flex items-center gap-1 ${glassCard}`}>
            <button
              type="button"
              onClick={() => setCore('kg')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                core === 'kg' ? glassPillActive : 'text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white'
              }`}
            >
              کوپا گستر
            </button>
            <button
              type="button"
              onClick={() => setCore('ch')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                core === 'ch' ? glassPillActive : 'text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white'
              }`}
            >
              فروشگاه‌های زنجیره‌ای
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. Analytical Filter Bar (Apple Floating Glass)
      ───────────────────────────────────────────────────────────── */}
      <div className={`rounded-2xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 transition-all ${glassCard}`}>
        {/* Left Side: Month Pill Selector + Lookback Selector */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          {/* Target Month */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 text-xs font-bold text-[#86868B] dark:text-[#98989D]">
              <Calendar className="w-3.5 h-3.5 text-[#0071E3]" />
              <span>ماه هدف:</span>
            </div>
            <div className="flex items-center gap-1 p-0.5 bg-black/[0.03] dark:bg-white/[0.04] rounded-xl flex-wrap">
              {(data?.available_months || [
                { value: '140508', label: 'آبان ۱۴۰۵' },
                { value: '140507', label: 'مهر ۱۴۰۵' },
                { value: '140506', label: 'شهریور ۱۴۰۵' },
                { value: '140505', label: 'مرداد ۱۴۰۵' },
              ]).map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setTargetMonth(m.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums transition-all ${
                    (targetMonth || data?.target_month) === m.value
                      ? glassPillActive
                      : 'text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lookback Comparison Window */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 text-xs font-bold text-[#86868B] dark:text-[#98989D]">
              <Clock className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span>بازه عقب‌نگر:</span>
            </div>
            <div className="flex items-center gap-1 p-0.5 bg-black/[0.03] dark:bg-white/[0.04] rounded-xl flex-wrap">
              {[
                { id: 'prev_1m', label: 'ماه قبل' },
                { id: 'prev_2m', label: '۲ ماه قبل' },
                { id: 'ytd', label: 'کل سال تا قبل از ماه جاری' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLookback(opt.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    lookback === opt.id
                      ? 'bg-[#8B5CF6] text-white shadow-[0_2px_10px_rgba(139,92,246,0.35)]'
                      : 'text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Optional Branch Dropdown */}
        <div className="flex items-center gap-3">
          {data?.available_branches?.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#86868B] dark:text-[#98989D]">فیلتر شعبه:</span>
              <div className="relative">
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className={`appearance-none text-xs font-bold pr-2.5 pl-7 py-1.5 rounded-xl outline-none cursor-pointer transition-all ${glassPill}`}
                >
                  <option value="">همه شعب</option>
                  {data.available_branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#86868B] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Reset Filters */}
          {(branch || lookback !== 'prev_1m' || targetMonth !== '140508') && (
            <button
              type="button"
              onClick={() => {
                setBranch('')
                setLookback('prev_1m')
                setTargetMonth('140508')
              }}
              className="text-xs font-bold text-[#0071E3] hover:underline px-1.5 py-1"
            >
              بازنشانی فیلترها
            </button>
          )}
        </div>
      </div>

      {/* Comparison Context Notice Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04] text-[11px] text-[#86868B] dark:text-[#98989D]">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[#0071E3]" />
          <span>
            مبنای مقایسه:{' '}
            <strong className="text-[#1D1D1F] dark:text-[#F5F5F7] font-bold">
              {data?.target_month_label || 'ماه هدف'}
            </strong>{' '}
            در برابر{' '}
            <strong className="text-[#8B5CF6] font-bold">
              {data?.lookback_label || 'دوره قبل'}
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] tabular-nums">
          <span>
            کل مشتریان:{' '}
            <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">
              {fa(metrics.total_customers || 0)}
            </strong>
          </span>
          <span>
            کل فاکتورها:{' '}
            <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">
              {fa(metrics.total_invoices || 0)}
            </strong>
          </span>
          <span>
            حجم کل:{' '}
            <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">
              {fa(Math.round(metrics.total_qty || 0))} کارتن
            </strong>
          </span>
          <span>
            فروش ناخالص:{' '}
            <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">
              {billions(metrics.total_rial || 0)} میلیارد ریال
            </strong>
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. Row 1 — Cohort & Churn Metrics (8 KPI Cards - Sleek & Compact)
      ───────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#0071E3]" />
            <h2 className="text-xs sm:text-sm font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
              شاخص‌های کوهورت و ماندگاری مشتریان (Cohort & Churn Metrics)
            </h2>
          </div>
          <span className="text-[10px] text-[#86868B] dark:text-[#98989D] hidden sm:inline">
            تکراری + ریزشی = مشتریان دوره قبل (۱۰۰٪ پایگاه)
          </span>
        </div>

        {/* Compact, dense, responsive 8-card grid */}
        <div className="customer-metrics-kpi-grid">
          {/* 1. Total Customers */}
          <div className={`rounded-xl p-2.5 flex flex-col justify-between transition-all hover:scale-[1.01] ${glassCard}`}>
            <div className="flex items-center justify-between text-[#4F46E5]">
              <span className="text-[11px] font-bold text-[#86868B] dark:text-[#98989D] truncate">تعداد کل مشتریان</span>
              <div className="w-5 h-5 rounded-md bg-[#4F46E5]/10 flex items-center justify-center shrink-0">
                <Users className="w-3 h-3" />
              </div>
            </div>
            <div className="my-1">
              <span className="text-lg font-black text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums tracking-tight">
                {fa(metrics.total_customers || 0)}
              </span>
              <p className="text-[10px] text-[#86868B] dark:text-[#98989D] font-medium truncate">
                پایگاه کل مشتریان
              </p>
            </div>
            <div className="pt-1 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-[9px]">
              <span className="text-[#86868B]">پوشش ماه جاری</span>
              <span className="font-bold text-[#4F46E5] tabular-nums">
                {metrics.total_customers && metrics.active_customers
                  ? `${fa2((metrics.active_customers / metrics.total_customers) * 100)}٪`
                  : '—'}
              </span>
            </div>
          </div>

          {/* 2. Active Customers */}
          <div className={`rounded-xl p-2.5 flex flex-col justify-between transition-all hover:scale-[1.01] ${glassCard}`}>
            <div className="flex items-center justify-between text-[#059669]">
              <span className="text-[11px] font-bold text-[#86868B] dark:text-[#98989D] truncate">مشتریان خرید کرده</span>
              <div className="w-5 h-5 rounded-md bg-[#059669]/10 flex items-center justify-center shrink-0">
                <UserCheck className="w-3 h-3" />
              </div>
            </div>
            <div className="my-1">
              <span className="text-lg font-black text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums tracking-tight">
                {fa(metrics.active_customers || 0)}
              </span>
              <p className="text-[10px] text-[#86868B] dark:text-[#98989D] font-medium truncate">
                خرید در {data?.target_month_label?.split(' ')[0] || 'ماه'}
              </p>
            </div>
            <div className="pt-1 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-[9px]">
              <span className="text-[#86868B]">پایگاه ماه</span>
              <span className="font-bold text-[#059669]">Active</span>
            </div>
          </div>

          {/* 2. Previous Active Customers */}
          <div className={`rounded-xl p-2.5 flex flex-col justify-between transition-all hover:scale-[1.01] ${glassCard}`}>
            <div className="flex items-center justify-between text-[#6366F1]">
              <span className="text-[11px] font-bold text-[#86868B] dark:text-[#98989D] truncate">مشتریان دوره قبل</span>
              <div className="w-5 h-5 rounded-md bg-[#6366F1]/10 flex items-center justify-center shrink-0">
                <Clock className="w-3 h-3" />
              </div>
            </div>
            <div className="my-1">
              <span className="text-lg font-black text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums tracking-tight">
                {fa(metrics.prev_active_customers || 0)}
              </span>
              <p className="text-[10px] text-[#86868B] dark:text-[#98989D] font-medium truncate">
                فعال در دوره قبل
              </p>
            </div>
            <div className="pt-1 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-[9px]">
              <span className="text-[#86868B]">مبنای سنجش</span>
              <span className="font-bold text-[#6366F1]">Prior Base</span>
            </div>
          </div>

          {/* 3. New Customers */}
          <div className={`rounded-xl p-2.5 flex flex-col justify-between transition-all hover:scale-[1.01] ${glassCard}`}>
            <div className="flex items-center justify-between text-[#0071E3]">
              <span className="text-[11px] font-bold text-[#86868B] dark:text-[#98989D] truncate">مشتریان جدید</span>
              <div className="w-5 h-5 rounded-md bg-[#0071E3]/10 flex items-center justify-center shrink-0">
                <UserPlus className="w-3 h-3" />
              </div>
            </div>
            <div className="my-1">
              <span className="text-lg font-black text-[#0071E3] tabular-nums tracking-tight">
                {fa(metrics.new_customers || 0)}
              </span>
              <p className="text-[10px] text-[#86868B] dark:text-[#98989D] font-medium truncate">
                اولین خرید در بازه
              </p>
            </div>
            <div className="pt-1 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-[9px]">
              <span className="text-[#86868B]">سهم:</span>
              <span className="font-bold text-[#0071E3] tabular-nums">
                {metrics.active_customers
                  ? `${fa2(metrics.new_customers / metrics.active_customers * 100)}٪`
                  : '—'}
              </span>
            </div>
          </div>

          {/* 4. Returning Customers */}
          <div className={`rounded-xl p-2.5 flex flex-col justify-between transition-all hover:scale-[1.01] ${glassCard}`}>
            <div className="flex items-center justify-between text-[#0D9488]">
              <span className="text-[11px] font-bold text-[#86868B] dark:text-[#98989D] truncate">مشتریان تکراری</span>
              <div className="w-5 h-5 rounded-md bg-[#0D9488]/10 flex items-center justify-center shrink-0">
                <Repeat className="w-3 h-3" />
              </div>
            </div>
            <div className="my-1">
              <span className="text-lg font-black text-[#0D9488] tabular-nums tracking-tight">
                {fa(metrics.returning_customers || 0)}
              </span>
              <p className="text-[10px] text-[#86868B] dark:text-[#98989D] font-medium truncate">
                خرید در هر دو بازه
              </p>
            </div>
            <div className="pt-1 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-[9px]">
              <span className="text-[#86868B]">وفاداری جاری</span>
              <span className="font-bold text-[#0D9488]">Returning</span>
            </div>
          </div>

          {/* 5. Returning Rate */}
          <div className={`rounded-xl p-2.5 flex flex-col justify-between transition-all hover:scale-[1.01] ${glassCard}`}>
            <div className="flex items-center justify-between text-[#10B981]">
              <span className="text-[11px] font-bold text-[#86868B] dark:text-[#98989D] truncate">نرخ بازگشت</span>
              <div className="w-5 h-5 rounded-md bg-[#10B981]/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-3 h-3" />
              </div>
            </div>
            <div className="my-1">
              <span className="text-lg font-black text-[#10B981] tabular-nums tracking-tight">
                {fa2(metrics.returning_rate || 0)}٪
              </span>
              <p className="text-[10px] text-[#86868B] dark:text-[#98989D] font-medium truncate">
                تکراری ÷ دوره قبل
              </p>
            </div>
            <div className="pt-1 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-[9px]">
              <span className="text-[#86868B]">Retention</span>
              <span className="font-bold text-[#10B981]">شاخص مثبت</span>
            </div>
          </div>

          {/* 6. Churned Customers */}
          <div className={`rounded-xl p-2.5 flex flex-col justify-between transition-all hover:scale-[1.01] ${glassCard}`}>
            <div className="flex items-center justify-between text-[#E11D48]">
              <span className="text-[11px] font-bold text-[#86868B] dark:text-[#98989D] truncate">مشتریان ریزشی</span>
              <div className="w-5 h-5 rounded-md bg-[#E11D48]/10 flex items-center justify-center shrink-0">
                <UserMinus className="w-3 h-3" />
              </div>
            </div>
            <div className="my-1">
              <span className="text-lg font-black text-[#E11D48] tabular-nums tracking-tight">
                {fa(metrics.churned_customers || 0)}
              </span>
              <p className="text-[10px] text-[#86868B] dark:text-[#98989D] font-medium truncate">
                بدون خرید جدید
              </p>
            </div>
            <div className="pt-1 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-[9px]">
              <span className="text-[#86868B]">از دست رفته</span>
              <span className="font-bold text-[#E11D48]">Lost Cohort</span>
            </div>
          </div>

          {/* 7. Churn Rate */}
          <div className={`rounded-xl p-2.5 flex flex-col justify-between transition-all hover:scale-[1.01] ${glassCard}`}>
            <div className="flex items-center justify-between text-[#F43F5E]">
              <span className="text-[11px] font-bold text-[#86868B] dark:text-[#98989D] truncate">نرخ ریزش</span>
              <div className="w-5 h-5 rounded-md bg-[#F43F5E]/10 flex items-center justify-center shrink-0">
                <TrendingDown className="w-3 h-3" />
              </div>
            </div>
            <div className="my-1">
              <span className="text-lg font-black text-[#F43F5E] tabular-nums tracking-tight">
                {fa2(metrics.churn_rate || 0)}٪
              </span>
              <p className="text-[10px] text-[#86868B] dark:text-[#98989D] font-medium truncate">
                ریزشی ÷ دوره قبل
              </p>
            </div>
            <div className="pt-1 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-[9px]">
              <span className="text-[#86868B]">هشدار ریزش</span>
              <span className="font-bold text-[#F43F5E]">Churn Rate</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. Row 2 — Customer Value & Invoice Metrics (6 KPI Cards in 2 groups - Compact)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Group A: Customer Value */}
        <div className={`rounded-2xl p-3 sm:p-3.5 ${glassCard}`}>
          <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-black/[0.04] dark:border-white/[0.05]">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
                <Users className="w-3 h-3" />
              </div>
              <h3 className="text-xs sm:text-sm font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7]">
                گروه الف: شاخص ارزش خرید مشتری (Customer Value)
              </h3>
            </div>
            <span className="text-[10px] text-[#86868B] dark:text-[#98989D]">میانگین ماهانه به ازای هر خریدار</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* 8. CLV (Qty) */}
            <div className="p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.03] dark:border-white/[0.04]">
              <span className="text-[10px] font-bold text-[#86868B] dark:text-[#98989D] block truncate">
                میانگین خرید (تعداد)
              </span>
              <span className="text-base font-black text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums mt-0.5 block">
                {fa2(metrics.clv_qty || 0)}{' '}
                <span className="text-[9px] font-normal text-[#86868B]">کارتن</span>
              </span>
              <span className="text-[9px] text-[#86868B] dark:text-[#98989D] mt-0.5 block truncate">
                حجم کل ÷ خریداران
              </span>
            </div>

            {/* 9. CLV (Rial) */}
            <div className="p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.03] dark:border-white/[0.04]">
              <span className="text-[10px] font-bold text-[#86868B] dark:text-[#98989D] block truncate">
                میانگین خرید (ریال)
              </span>
              <span className="text-base font-black text-[#0071E3] tabular-nums mt-0.5 block">
                {fa(Math.round((metrics.clv_rial || 0) / 1e6))}{' '}
                <span className="text-[9px] font-normal text-[#86868B]">م.ریال</span>
              </span>
              <span className="text-[9px] text-[#86868B] dark:text-[#98989D] mt-0.5 block truncate" title={`${fa(metrics.clv_rial || 0)} ریال`}>
                ریال ناخالص ÷ خریداران
              </span>
            </div>

            {/* 10. Avg Category per Customer */}
            <div className="p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.03] dark:border-white/[0.04]">
              <span className="text-[10px] font-bold text-[#86868B] dark:text-[#98989D] block truncate">
                میانگین گروه کالا
              </span>
              <span className="text-base font-black text-[#10B981] tabular-nums mt-0.5 block">
                {fa2(metrics.avg_cat_per_customer || 0)}{' '}
                <span className="text-[9px] font-normal text-[#86868B]">برند</span>
              </span>
              <span className="text-[9px] text-[#86868B] dark:text-[#98989D] mt-0.5 block truncate">
                تنوع سبد هر مشتری
              </span>
            </div>
          </div>
        </div>

        {/* Group B: Invoice Metrics */}
        <div className={`rounded-2xl p-3 sm:p-3.5 ${glassCard}`}>
          <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-black/[0.04] dark:border-white/[0.05]">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center">
                <ShoppingBag className="w-3 h-3" />
              </div>
              <h3 className="text-xs sm:text-sm font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7]">
                گروه ب: شاخص‌های فاکتور (Invoice Metrics)
              </h3>
            </div>
            <span className="text-[10px] text-[#86868B] dark:text-[#98989D]">میانگین به ازای هر سفارش</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* 11. Avg Order Size */}
            <div className="p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.03] dark:border-white/[0.04]">
              <span className="text-[10px] font-bold text-[#86868B] dark:text-[#98989D] block truncate">
                میانگین حجم فاکتور
              </span>
              <span className="text-base font-black text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums mt-0.5 block">
                {fa2(metrics.avg_order_size || 0)}{' '}
                <span className="text-[9px] font-normal text-[#86868B]">کارتن</span>
              </span>
              <span className="text-[9px] text-[#86868B] dark:text-[#98989D] mt-0.5 block truncate">
                حجم کل ÷ فاکتورها
              </span>
            </div>

            {/* 12. Avg Invoice Line Item (SKU) */}
            <div className="p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.03] dark:border-white/[0.04]">
              <span className="text-[10px] font-bold text-[#86868B] dark:text-[#98989D] block truncate">
                کالای هر فاکتور
              </span>
              <span className="text-base font-black text-[#8B5CF6] tabular-nums mt-0.5 block">
                {fa2(metrics.avg_sku_per_invoice || 0)}{' '}
                <span className="text-[9px] font-normal text-[#86868B]">قلم</span>
              </span>
              <span className="text-[9px] text-[#86868B] dark:text-[#98989D] mt-0.5 block truncate">
                تعداد SKU فاکتور
              </span>
            </div>

            {/* 13. Avg Product Category per Invoice */}
            <div className="p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.03] dark:border-white/[0.04]">
              <span className="text-[10px] font-bold text-[#86868B] dark:text-[#98989D] block truncate">
                گروه کالا در فاکتور
              </span>
              <span className="text-base font-black text-[#0EA5E9] tabular-nums mt-0.5 block">
                {fa2(metrics.avg_cat_per_invoice || 0)}{' '}
                <span className="text-[9px] font-normal text-[#86868B]">گروه</span>
              </span>
              <span className="text-[9px] text-[#86868B] dark:text-[#98989D] mt-0.5 block truncate">
                تنوع برند سفارش
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. Interactive Metric Switcher
      ───────────────────────────────────────────────────────────── */}
      <div className={`rounded-2xl p-2.5 sm:p-3 flex flex-col md:flex-row items-center justify-between gap-2.5 ${glassCard}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] whitespace-nowrap">
            انتخاب شاخص تحلیلی نمودارها:
          </span>
          <span className="text-[10px] text-[#86868B] dark:text-[#98989D] hidden sm:inline">
            (با کلیک روی هر شاخص، هر دو نمودار تفکیکی زیر فوراً به‌روز می‌شوند)
          </span>
        </div>

        {/* 6 Metric Pills */}
        <div className="flex items-center gap-1 p-0.5 bg-black/[0.03] dark:bg-white/[0.04] rounded-xl overflow-x-auto max-w-full">
          {METRIC_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const isActive = selectedMetric === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedMetric(opt.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? glassPillActive
                    : 'text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{opt.label}</span>
                <span className="text-[10px] opacity-70">({opt.unit})</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          6. Dual Breakdown Charts (Right: Brands / Left: Branches & Regions)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Right Chart: بر اساس تامین‌کننده و گروه کالا (Vertical Bar Chart) */}
        <div className={`rounded-2xl p-4 flex flex-col justify-between ${glassCard}`}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
                  <ShoppingBag className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    بر اساس تامین‌کننده و برندها (Brands & Categories)
                  </h3>
                  <span className="text-[10px] text-[#86868B] dark:text-[#98989D]">
                    شاخص «{activeMetricObj.label}» به تفکیک برندهای اصلی
                  </span>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2 text-[10px] font-bold">
                {selectedMetric === 'churn_rate' ? (
                  <>
                    <span className="flex items-center gap-1 text-[#F43F5E]">
                      <span className="w-2 h-2 rounded-full bg-[#F43F5E]" />
                      ریزش بالا (&gt;۶۵٪)
                    </span>
                    <span className="flex items-center gap-1 text-[#10B981]">
                      <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                      ریزش پایین (&lt;۵۰٪)
                    </span>
                  </>
                ) : (
                  <span className="text-[#86868B] dark:text-[#98989D]">
                    واحد: {activeMetricObj.unit}
                  </span>
                )}
              </div>
            </div>

            {/* Vertical Bar Chart */}
            <div className="h-[380px] mt-2 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={brandChartData} margin={{ top: 25, right: 10, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#333' : '#E2E8F0'} opacity={0.6} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: isDark ? '#F5F5F7' : '#1D1D1F', fontSize: 11, fontWeight: 700 }}
                    axisLine={{ stroke: isDark ? '#444' : '#E2E8F0' }}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fill: isDark ? '#98989D' : '#64748B', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    unit={activeMetricObj.unit === '٪' ? '٪' : ''}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      borderRadius: '16px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                      fontFamily: 'inherit',
                      direction: 'rtl',
                    }}
                    formatter={(val) => [
                      `${fa2(val)} ${activeMetricObj.unit}`,
                      activeMetricObj.label,
                    ]}
                    labelFormatter={(label) => `برند: ${label}`}
                  />
                  <Bar dataKey={selectedMetric} radius={[8, 8, 0, 0]} maxBarSize={44}>
                    {brandChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBrandBarColor(entry)} />
                    ))}
                    <LabelList
                      dataKey={selectedMetric}
                      position="top"
                      formatter={(val) => `${fa2(val)}${activeMetricObj.unit === '٪' ? '٪' : ''}`}
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

          {/* Quick Data Summary Footer */}
          <div className="pt-2.5 border-t border-black/[0.04] dark:border-white/[0.05] grid grid-cols-4 gap-2 text-center text-[10px]">
            {brandChartData.slice(0, 4).map((b) => (
              <div key={b.name} className="p-1 rounded-lg bg-black/[0.02] dark:bg-white/[0.02]">
                <span className="font-bold text-[#86868B] block truncate">{b.name}</span>
                <span className="font-black text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums mt-0.5 block">
                  {fa2(b[selectedMetric])} {activeMetricObj.unit}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Left Chart: بر اساس منطقه و شعبه (Apple HIG Ranked Horizontal Bars - 100% Clear & Beautiful) */}
        <div className={`rounded-2xl p-4 flex flex-col justify-between ${glassCard}`}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#8B5CF6]/10 text-[#8B5CF6] flex items-center justify-center">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    بر اساس شعب و مناطق (Branches & Regions)
                  </h3>
                  <span className="text-[10px] text-[#86868B] dark:text-[#98989D]">
                    رتبه‌بندی شاخص «{activeMetricObj.label}» به تفکیک جغرافیایی
                  </span>
                </div>
              </div>

              {/* Geo Mode Toggle (Branch / Region) */}
              <div className="flex items-center p-0.5 bg-black/[0.04] dark:bg-white/[0.05] rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setGeoMode('branch')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                    geoMode === 'branch' ? glassPillActive : 'text-[#86868B]'
                  }`}
                >
                  شعب
                </button>
                <button
                  type="button"
                  onClick={() => setGeoMode('region')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                    geoMode === 'region' ? glassPillActive : 'text-[#86868B]'
                  }`}
                >
                  مناطق
                </button>
              </div>
            </div>

            {/* Apple HIG Ranked Horizontal Bar List: Zero SVG overlap, 100% crisp Persian text */}
            <div className="h-[380px] overflow-y-auto space-y-2.5 pr-1 pl-1 py-1">
              {geoChartData.map((item, index) => {
                const val = item[selectedMetric] || 0
                const maxVal = selectedMetric.includes('rate')
                  ? 100
                  : Math.max(...geoChartData.map((x) => x[selectedMetric] || 1), 1)
                const percentWidth = Math.min(100, Math.max(2, (val / maxVal) * 100))
                const barColor = getGeoBarColor(item)

                return (
                  <div
                    key={item.name}
                    className="p-1.5 rounded-xl hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Top Row: Name on Right, Value on Left */}
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-black/[0.04] dark:bg-white/[0.06] text-[10px] font-black text-[#86868B] dark:text-[#98989D] flex items-center justify-center shrink-0 tabular-nums">
                          {fa(index + 1)}
                        </span>
                        <span className="font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] text-xs">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-[#86868B] dark:text-[#98989D] hidden sm:inline tabular-nums">
                          ({fa(item.active_custs || 0)} خریدار)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="font-black text-xs tabular-nums"
                          style={{ color: barColor }}
                        >
                          {fa2(val)} {activeMetricObj.unit}
                        </span>
                      </div>
                    </div>

                    {/* Horizontal Bar Track & Fill */}
                    <div className="w-full h-2.5 bg-black/[0.04] dark:bg-white/[0.06] rounded-full overflow-hidden p-0.5">
                      <div
                        className="h-full rounded-full transition-all duration-500 shadow-sm"
                        style={{
                          width: `${percentWidth}%`,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Geo Ranking Highlights Footer */}
          <div className="pt-2.5 mt-2 border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between text-[11px] text-[#86868B]">
            <span>
              رتبه نخست: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{geoChartData[0]?.name || '—'}</strong> (
              {fa2(geoChartData[0]?.[selectedMetric])} {activeMetricObj.unit})
            </span>
            <span>
              کمترین:{' '}
              <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">
                {geoChartData[geoChartData.length - 1]?.name || '—'}
              </strong>{' '}
              ({fa2(geoChartData[geoChartData.length - 1]?.[selectedMetric])} {activeMetricObj.unit})
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

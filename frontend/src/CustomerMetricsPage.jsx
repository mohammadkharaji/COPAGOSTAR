import React, { useMemo, useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Award,
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
  Store,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Zap,
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
import { motion } from 'motion/react'
import { useApi } from './api'
import { useAppearance } from './AppearanceContext'
import { billions, fa, fa2, faDigits } from './format'

const METRIC_OPTIONS = [
  { id: 'churn_rate', label: 'نرخ ریزش', en: 'Churn Rate', unit: '٪', isPercent: true, higherIsBad: true, icon: TrendingDown, color: '#F43F5E' },
  { id: 'returning_rate', label: 'نرخ بازگشت', en: 'Returning Rate', unit: '٪', isPercent: true, higherIsBad: false, icon: TrendingUp, color: '#10B981' },
  { id: 'clv_qty', label: 'حجم خرید (CLV)', en: 'CLV Qty', unit: 'کارتن', isPercent: false, icon: Package, color: '#6366F1' },
  { id: 'avg_order_size', label: 'میانگین هر فاکتور', en: 'Avg Order Size', unit: 'کارتن', isPercent: false, icon: ShoppingBag, color: '#8B5CF6' },
  { id: 'avg_sku', label: 'تنوع کالای فاکتور', en: 'Avg SKU', unit: 'قلم', isPercent: false, icon: Layers, color: '#0EA5E9' },
  { id: 'avg_category', label: 'تنوع گروه کالا', en: 'Avg Category', unit: 'گروه', isPercent: false, icon: Activity, color: '#14B8A6' },
]

export default function CustomerMetricsPage({ p, core, setCore, openCustomer }) {
  const { isDark, isSolid } = useAppearance()

  // Local state & filters
  const [targetMonth, setTargetMonth] = useState('140508')
  const [lookback, setLookback] = useState('prev_1m')
  const [branch, setBranch] = useState('')
  const [geoMode, setGeoMode] = useState('branch') // 'branch' or 'region'
  const [prodMode, setProdMode] = useState('brand') // 'brand' or 'category'
  const [selectedMetric, setSelectedMetric] = useState('churn_rate')

  // Fetch metrics data from API
  const query = useMemo(() => {
    const q = { core, lookback }
    if (targetMonth) q.target_month = targetMonth
    if (branch) q.branch = branch
    if (p?.v) q.v = p.v
    return q
  }, [core, targetMonth, lookback, branch, p?.v])

  const apiRes = useApi('/analytics/customer-metrics', query)
  const data = apiRes.data
  const loading = apiRes.loading

  const metrics = data?.metrics || {}
  const activeMetricObj = METRIC_OPTIONS.find((m) => m.id === selectedMetric) || METRIC_OPTIONS[0]

  // Appearance tokens
  const glassCard = isSolid
    ? isDark
      ? 'bg-[#0B100E] border border-emerald-500/20 text-[#F5F5F7] shadow-sm'
      : 'bg-white border border-slate-200 text-[#1D1D1F] shadow-sm'
    : isDark
    ? 'bg-[#0B100E]/80 backdrop-blur-2xl border border-emerald-500/15 text-[#F5F5F7] shadow-[0_8px_32px_rgba(0,0,0,0.45)]'
    : 'bg-white/90 backdrop-blur-xl border border-slate-200/80 text-[#1D1D1F] shadow-[0_8px_30px_rgb(0,0,0,0.04)]'

  const glassPill = isDark
    ? 'bg-white/[0.04] text-slate-300 border border-white/10 hover:bg-white/[0.08]'
    : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200/80'

  const glassPillActive = 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-sm shadow-emerald-500/25 border-transparent'

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
    if (selectedMetric === 'clv_qty') return '#6366F1'
    if (selectedMetric === 'avg_order_size') return '#8B5CF6'
    if (selectedMetric === 'avg_sku') return '#0EA5E9'
    return '#14B8A6'
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
    if (selectedMetric === 'clv_qty') return '#6366F1'
    if (selectedMetric === 'avg_order_size') return '#8B5CF6'
    if (selectedMetric === 'avg_sku') return '#0EA5E9'
    return '#14B8A6'
  }

  // Top brands or product groups list (sorted by selected metric)
  const productChartData = useMemo(() => {
    const list = prodMode === 'brand'
      ? (data?.breakdown_brand || data?.by_brand)
      : (data?.breakdown_category || data?.by_category)
    if (!list) return []
    return [...list]
      .filter((b) => (b.active_custs || 0) > 0)
      .sort((a, b) => (b[selectedMetric] || 0) - (a[selectedMetric] || 0))
      .slice(0, 10)
  }, [data, prodMode, selectedMetric])

  // Branches/Regions list (sorted by selected metric, top 8 for clean fit without scrollbar)
  const geoChartData = useMemo(() => {
    const list = geoMode === 'branch' ? data?.breakdown_branch : data?.breakdown_region
    if (!list) return []
    return [...list]
      .filter((g) => (g.active_custs || 0) > 0)
      .sort((a, b) => (b[selectedMetric] || 0) - (a[selectedMetric] || 0))
      .slice(0, 8)
  }, [data, geoMode, selectedMetric])

  // Active / Total customer base ratio
  const activationPct = metrics.total_customers && metrics.active_customers
    ? Math.round((metrics.active_customers / metrics.total_customers) * 100)
    : 0

  // New customers share
  const newCustShare = metrics.active_customers && metrics.new_customers
    ? Math.round((metrics.new_customers / metrics.active_customers) * 100)
    : 0

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5 pb-16" dir="rtl">
      {/* ─────────────────────────────────────────────────────────────
          1. Tier 1: Apple Executive Header Bento
      ───────────────────────────────────────────────────────────── */}
      <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-6 transition-all ${glassCard}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Right: Badge, Title & Subtitle */}
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black tracking-tight">
                  آنالیز شاخص‌های خرید مشتریان
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  Cohort & Retention
                </span>
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                سنجش رفتار کوهورت، نرخ ماندگاری، هشدار ریزش، ارزش خرید (CLV) و سلامت سبد سفارشات
              </p>
            </div>
          </div>

          {/* Left: Channel Selector & Live Status Pill */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className={`p-1 rounded-2xl flex items-center gap-1 border ${
              isDark ? 'bg-black/30 border-white/5' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setCore('kg')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  core === 'kg' ? glassPillActive : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                کوپا گستر
              </button>
              <button
                type="button"
                onClick={() => setCore('ch')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  core === 'ch' ? glassPillActive : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                فروشگاه‌های زنجیره‌ای
              </button>
            </div>

            <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border ${
              isDark ? 'bg-white/[0.03] border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>دوره فعال: <strong className={isDark ? 'text-emerald-400' : 'text-emerald-700'}>{data?.target_month_label || 'آبان ۱۴۰۵'}</strong></span>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            2. Tier 2: Analytical Controls & Filter Bar (Integrated Inside Bento)
        ───────────────────────────────────────────────────────────── */}
        <div className={`mt-5 pt-4 border-t flex flex-wrap items-center justify-between gap-3 ${
          isDark ? 'border-white/10' : 'border-slate-200'
        }`}>
          {/* Target Month + Lookback Window */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-6">
            {/* Target Month */}
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>ماه هدف:</span>
              </span>
              <div className={`p-0.5 rounded-xl flex items-center gap-1 border ${
                isDark ? 'bg-black/30 border-white/5' : 'bg-slate-100 border-slate-200'
              }`}>
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
                    className={`px-3 py-1 rounded-lg text-xs font-bold tabular-nums transition-all cursor-pointer ${
                      (targetMonth || data?.target_month) === m.value
                        ? glassPillActive
                        : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lookback Window */}
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>بازه مقایسه:</span>
              </span>
              <div className={`p-0.5 rounded-xl flex items-center gap-1 border ${
                isDark ? 'bg-black/30 border-white/5' : 'bg-slate-100 border-slate-200'
              }`}>
                {[
                  { id: 'prev_1m', label: 'ماه قبل' },
                  { id: 'prev_2m', label: '۲ ماه قبل' },
                  { id: 'ytd', label: 'کل سال تا قبل جاری' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLookback(opt.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      lookback === opt.id
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/25'
                        : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Branch Filter & Reset */}
          <div className="flex items-center gap-3">
            {data?.available_branches?.length > 0 && (
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>فیلتر شعبه:</span>
                <div className="relative">
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className={`appearance-none text-xs font-bold pr-3 pl-8 py-1.5 rounded-xl outline-none cursor-pointer border ${glassPill}`}
                  >
                    <option value="">همه شعب ({data.available_branches.length} شعبه)</option>
                    {data.available_branches.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            {(branch || lookback !== 'prev_1m' || targetMonth !== '140508') && (
              <button
                type="button"
                onClick={() => {
                  setBranch('')
                  setLookback('prev_1m')
                  setTargetMonth('140508')
                }}
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={12} />
                <span>بازنشانی</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Comparison Context Strip */}
      <div className={`px-4 py-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs border ${
        isDark ? 'bg-black/20 border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
      }`}>
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>
            مبنای مقایسه: <strong className={isDark ? 'text-slate-100' : 'text-slate-900'}>{data?.target_month_label || 'ماه هدف'}</strong> در برابر <strong className="text-indigo-400">{data?.lookback_label || 'دوره قبل'}</strong>
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs tabular-nums flex-wrap">
          <span>کل پایگاه: <b className={isDark ? 'text-slate-100' : 'text-slate-900'}>{fa(metrics.total_customers || 0)}</b> مشتری</span>
          <span>کل فاکتورها: <b className={isDark ? 'text-slate-100' : 'text-slate-900'}>{fa(metrics.total_invoices || 0)}</b> فقره</span>
          <span>حجم کل: <b className={isDark ? 'text-slate-100' : 'text-slate-900'}>{fa(Math.round(metrics.total_qty || 0))}</b> کارتن</span>
          <span>فروش ناخالص: <b className={isDark ? 'text-emerald-400' : 'text-emerald-700'}>{billions(metrics.total_rial || 0)}</b> م.ر</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. بخش اول: ماتریس کوهورت و پایداری مشتریان (Cohort & Churn Funnel Bento)
      ───────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
              ماتریس کوهورت و رفتار مشتریان (Cohort & Churn Analysis)
            </h2>
          </div>
          <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} hidden sm:inline`}>
            تفکیک وضعیت خرید: پایگاه فعال، جذب جدید، بازگشت وفاداران و هشدار ریزش
          </span>
        </div>

        {/* 4 Balanced Bento KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Active Customers */}
          <motion.div whileHover={{ y: -2 }} className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all ${glassCard}`}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>پایگاه خریدار ماه جاری</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight">
                {fa(metrics.active_customers || 0)}
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                مشتریان خریدار در {data?.target_month_label?.split(' ')[0] || 'ماه'}
              </p>
            </div>
            <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
              isDark ? 'border-white/5' : 'border-slate-100'
            }`}>
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>پوشش از کل پایگاه</span>
              <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 tabular-nums">
                {faDigits(activationPct)}٪ فعال
              </span>
            </div>
          </motion.div>

          {/* Card 2: New Customers */}
          <motion.div whileHover={{ y: -2 }} className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all ${glassCard}`}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>مشتریان جدید (جذب تازه)</span>
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-cyan-400 tabular-nums tracking-tight">
                {fa(metrics.new_customers || 0)}
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                نخستین خرید ثبت‌شده در بازه محاسباتی
              </p>
            </div>
            <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
              isDark ? 'border-white/5' : 'border-slate-100'
            }`}>
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>سهم از خریداران ماه</span>
              <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 tabular-nums">
                {faDigits(newCustShare)}٪ کوهورت جدید
              </span>
            </div>
          </motion.div>

          {/* Card 3: Returning Customers & Retention Rate */}
          <motion.div whileHover={{ y: -2 }} className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all ${glassCard}`}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>مشتریان وفادار (بازگشتی)</span>
                <div className="w-9 h-9 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center shrink-0">
                  <Repeat className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-teal-400 tabular-nums tracking-tight">
                {fa(metrics.returning_customers || 0)}
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                خریداران مشترک در هر دو بازه مقایسه
              </p>
            </div>
            <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
              isDark ? 'border-white/5' : 'border-slate-100'
            }`}>
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>نرخ بازگشت (Retention)</span>
              <span className="px-2 py-0.5 rounded-md text-xs font-black bg-teal-500/15 text-teal-400 border border-teal-500/25 tabular-nums">
                {fa2(metrics.returning_rate || 0)}٪
              </span>
            </div>
          </motion.div>

          {/* Card 4: Churned Customers & Churn Rate Alert */}
          <motion.div whileHover={{ y: -2 }} className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all ${glassCard}`}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>مشتریان ریزش‌کرده (هشدار)</span>
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
                  <UserMinus className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-rose-400 tabular-nums tracking-tight">
                {fa(metrics.churned_customers || 0)}
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                خریدار دوره قبل، بدون هیچ خرید در ماه جاری
              </p>
            </div>
            <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
              isDark ? 'border-white/5' : 'border-slate-100'
            }`}>
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>نرخ ریزش (Churn Rate)</span>
              <span className="px-2 py-0.5 rounded-md text-xs font-black bg-rose-500/15 text-rose-400 border border-rose-500/25 tabular-nums">
                {fa2(metrics.churn_rate || 0)}٪
              </span>
            </div>
          </motion.div>
        </div>

        {/* Visual Cohort Retention vs Churn Funnel Ribbon */}
        <div className={`rounded-2xl p-4 sm:p-5 space-y-3 transition-all ${glassCard}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-xs sm:text-sm font-bold">تراز دینامیک پایگاه خریداران دوره قبل</span>
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                (پایگاه مبنا: {fa(metrics.prev_active_customers || 0)} مشتری)
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="flex items-center gap-1.5 text-teal-400">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400" />
                <span>وفادار: {fa(metrics.returning_customers || 0)} نفر ({fa2(metrics.returning_rate || 0)}٪)</span>
              </span>
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <span>ریزشی: {fa(metrics.churned_customers || 0)} نفر ({fa2(metrics.churn_rate || 0)}٪)</span>
              </span>
            </div>
          </div>

          {/* Segmented Dual Bar */}
          <div className={`w-full h-3.5 rounded-full overflow-hidden p-0.5 flex border ${
            isDark ? 'bg-black/40 border-white/5' : 'bg-slate-200 border-slate-300'
          }`}>
            <div
              className="h-full rounded-r-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-700 shadow-xs"
              style={{ width: `${Math.min(100, Math.max(0, metrics.returning_rate || 0))}%` }}
              title={`وفاداران: ${fa2(metrics.returning_rate)}٪`}
            />
            <div
              className="h-full rounded-l-full bg-gradient-to-r from-rose-500 to-pink-600 transition-all duration-700 shadow-xs"
              style={{ width: `${Math.min(100, Math.max(0, metrics.churn_rate || 0))}%` }}
              title={`ریزشی‌ها: ${fa2(metrics.churn_rate)}٪`}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
            <span>مشتریان بازگشتی (ماندگاری سالم در دوره)</span>
            <span>مشتریان از دست رفته نیازمند پیگیری فروش و تارگت‌گذاری مجدد</span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. بخش دوم: شاخص‌های ارزش مشتری و کیفیت سبد سفارش (CLV & Basket Bento)
      ───────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
            <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
              ارزش دوره عمر و کیفیت سبد سفارشات (Customer Value & Basket Depth)
            </h2>
          </div>
          <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} hidden sm:inline`}>
            میانگین ریالی و تعدادی خرید به ازای هر مشتری و بررسی عمق فاکتور
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metric 1: CLV Rial */}
          <motion.div whileHover={{ y: -2 }} className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all ${glassCard}`}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ارزش ریالی مشتری (CLV ریال)</span>
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-400 tabular-nums tracking-tight">
                {fa(Math.round((metrics.clv_rial || 0) / 1e6))}
                <span className="text-xs font-bold text-slate-400 mr-1.5">م.ریال</span>
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                میانگین خرید ناخالص به ازای هر خریدار فعال
              </p>
            </div>
            <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
              isDark ? 'border-white/5' : 'border-slate-100'
            }`}>
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>مجموع دوره</span>
              <span className="font-bold tabular-nums text-amber-400">
                {billions(metrics.total_rial || 0)} میلیارد ریال
              </span>
            </div>
          </motion.div>

          {/* Metric 2: CLV Qty */}
          <motion.div whileHover={{ y: -2 }} className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all ${glassCard}`}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>حجم خرید مشتری (CLV تعدادی)</span>
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-indigo-400 tabular-nums tracking-tight">
                {fa2(metrics.clv_qty || 0)}
                <span className="text-xs font-bold text-slate-400 mr-1.5">کارتن</span>
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                میانگین کارتن خریداری‌شده به ازای هر مشتری
              </p>
            </div>
            <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
              isDark ? 'border-white/5' : 'border-slate-100'
            }`}>
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>مبنای محاسبه</span>
              <span className="font-bold tabular-nums text-indigo-400">حجم کل ÷ خریداران</span>
            </div>
          </motion.div>

          {/* Metric 3: Avg Order Size */}
          <motion.div whileHover={{ y: -2 }} className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all ${glassCard}`}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>میانگین حجم فاکتور (AOV)</span>
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-purple-400 tabular-nums tracking-tight">
                {fa2(metrics.avg_order_size || 0)}
                <span className="text-xs font-bold text-slate-400 mr-1.5">کارتن / فاکتور</span>
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                میانگین کارتن تحویلی در هر سفارش‌گذاری
              </p>
            </div>
            <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
              isDark ? 'border-white/5' : 'border-slate-100'
            }`}>
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>تعداد فاکتورها</span>
              <span className="font-bold tabular-nums text-purple-400">{fa(metrics.total_invoices || 0)} فقره</span>
            </div>
          </motion.div>

          {/* Metric 4: Basket SKU & Category Depth */}
          <motion.div whileHover={{ y: -2 }} className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all ${glassCard}`}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>عمق و تنوع سبد خرید</span>
                <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-sky-400 tabular-nums tracking-tight">
                {fa2(metrics.avg_sku_per_invoice || 0)}
                <span className="text-xs font-bold text-slate-400 mr-1.5">قلم کالا</span>
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                تنوع برند فاکتور: {fa2(metrics.avg_cat_per_invoice || 0)} برند/گروه
              </p>
            </div>
            <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
              isDark ? 'border-white/5' : 'border-slate-100'
            }`}>
              <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>تنوع مشتری در دوره</span>
              <span className="font-bold tabular-nums text-sky-400">{fa2(metrics.avg_cat_per_customer || 0)} برند / مشتری</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. بخش سوم: ابزار تعاملی انتخاب شاخص تحلیلی (Segmented Metric Switcher)
      ───────────────────────────────────────────────────────────── */}
      <div className={`rounded-2xl sm:rounded-3xl p-3 sm:p-4 transition-all ${glassCard}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-xs sm:text-sm font-extrabold tracking-tight">
              انتخاب شاخص تحلیلی نمودارها و رتبه‌بندی‌ها:
            </span>
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} hidden md:inline`}>
              (با انتخاب هر شاخص، هر دو نمای کالایی و جغرافیایی فوراً همگام‌سازی می‌شوند)
            </span>
          </div>

          {/* 6 Metric Pills (Wrap cleanly without ugly horizontal scrollbars) */}
          <div className={`p-1 rounded-2xl flex flex-wrap items-center gap-1.5 max-w-full no-scrollbar border ${
            isDark ? 'bg-black/30 border-white/5' : 'bg-slate-100 border-slate-200'
          }`}>
            {METRIC_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const isActive = selectedMetric === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedMetric(opt.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? glassPillActive
                      : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{opt.label}</span>
                  <span className="text-[10px] opacity-75 font-normal">({opt.unit})</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          6. بخش چهارم: کارت‌های تحلیل دوقلو (برندها / گروه‌ها و شعب / مناطق)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card Right: Product & Brand Analysis */}
        <div className={`rounded-2xl sm:rounded-3xl p-5 flex flex-col justify-between transition-all ${glassCard}`}>
          <div>
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-black/[0.04] dark:border-white/[0.06] flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black">
                    {prodMode === 'brand' ? 'تحلیل شاخص بر اساس برندها' : 'تحلیل شاخص بر اساس گروه کالا'}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    نمایش «{activeMetricObj.label}» برای ۱۰ {prodMode === 'brand' ? 'برند اصلی' : 'گروه کالای پرفروش'}
                  </p>
                </div>
              </div>

              {/* Toggle Brand / Category */}
              <div className={`p-0.5 rounded-xl flex items-center gap-1 border ${
                isDark ? 'bg-black/30 border-white/5' : 'bg-slate-100 border-slate-200'
              }`}>
                <button
                  type="button"
                  onClick={() => setProdMode('brand')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    prodMode === 'brand' ? glassPillActive : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  برندها
                </button>
                <button
                  type="button"
                  onClick={() => setProdMode('category')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    prodMode === 'category' ? glassPillActive : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  گروه کالا
                </button>
              </div>
            </div>

            {/* Sorting & Threshold header */}
            <div className="flex items-center justify-between text-xs font-bold mb-2">
              <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                مرتب‌سازی: بیشترین {activeMetricObj.label}
              </span>
              {selectedMetric === 'churn_rate' ? (
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1 text-rose-400">
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    ریزش بالا (&gt;۶۵٪)
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    ریزش کم (&lt;۵۰٪)
                  </span>
                </div>
              ) : (
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  واحد سنجش: {activeMetricObj.unit}
                </span>
              )}
            </div>

            {/* Bar Chart (Zero clutter, no overlapping LabelList on bars) */}
            <div className="h-[360px] w-full mt-3" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productChartData} margin={{ top: 15, right: 8, left: 8, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#2D3748' : '#E2E8F0'} opacity={0.5} />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={productChartData.length > 5 ? -30 : 0}
                    textAnchor={productChartData.length > 5 ? 'end' : 'middle'}
                    height={productChartData.length > 5 ? 65 : 35}
                    tick={{
                      fill: isDark ? '#E2E8F0' : '#1E293B',
                      fontSize: 10.5,
                      fontWeight: 700,
                    }}
                    axisLine={{ stroke: isDark ? '#4A5568' : '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={activeMetricObj.isPercent ? [0, 100] : [0, 'auto']}
                    ticks={activeMetricObj.isPercent ? [0, 25, 50, 75, 100] : undefined}
                    tick={{ fill: isDark ? '#A0AEC0' : '#64748B', fontSize: 10.5 }}
                    axisLine={false}
                    tickLine={false}
                    unit={activeMetricObj.unit === '٪' ? '٪' : ''}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const item = payload[0].payload
                      const val = item[selectedMetric]
                      return (
                        <div className={`p-3 rounded-2xl border shadow-2xl backdrop-blur-xl ${
                          isDark ? 'bg-[#0B100E]/95 border-emerald-500/30 text-white' : 'bg-white/95 border-slate-200 text-slate-900'
                        }`} dir="rtl">
                          <div className="font-bold text-xs mb-1 text-slate-300">
                            {prodMode === 'brand' ? 'برند:' : 'گروه کالا:'} <span className="text-white font-extrabold">{item.name}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-xs">
                            <span className="text-slate-400">{activeMetricObj.label}:</span>
                            <span className="font-black tabular-nums" style={{ color: getBrandBarColor(item) }}>
                              {fa2(val)} {activeMetricObj.unit}
                            </span>
                          </div>
                          {item.active_custs != null && (
                            <div className="flex items-center justify-between gap-4 text-[11px] text-slate-400 mt-1.5 pt-1.5 border-t border-white/10">
                              <span>خریداران در دوره:</span>
                              <span className="font-bold tabular-nums text-slate-200">{fa(item.active_custs)} خریدار</span>
                            </div>
                          )}
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey={selectedMetric} radius={[8, 8, 0, 0]} maxBarSize={36}>
                    {productChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBrandBarColor(entry)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Clean 1-Line Summary Footer */}
          <div className="pt-3 mt-3 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
            <span>
              بیشترین: <strong className={isDark ? 'text-slate-100' : 'text-slate-900'}>{productChartData[0]?.name || '—'}</strong> ({fa2(productChartData[0]?.[selectedMetric])} {activeMetricObj.unit})
            </span>
            <span>
              میانگین شاخص: <strong className={isDark ? 'text-slate-100' : 'text-slate-900'}>{fa2(metrics[selectedMetric] || 0)} {activeMetricObj.unit}</strong>
            </span>
          </div>
        </div>

        {/* Card Left: Geographic Ranked Bars (Branches & Regions) */}
        <div className={`rounded-2xl sm:rounded-3xl p-5 flex flex-col justify-between transition-all ${glassCard}`}>
          <div>
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-black/[0.04] dark:border-white/[0.06] flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black">
                    {geoMode === 'branch' ? 'رتبه‌بندی جغرافیایی شعب' : 'رتبه‌بندی مناطق توزیع'}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    عملکرد شاخص «{activeMetricObj.label}» به تفکیک {geoMode === 'branch' ? 'شعب' : 'مناطق'}
                  </p>
                </div>
              </div>

              {/* Toggle Branch / Region */}
              <div className={`p-0.5 rounded-xl flex items-center gap-1 border ${
                isDark ? 'bg-black/30 border-white/5' : 'bg-slate-100 border-slate-200'
              }`}>
                <button
                  type="button"
                  onClick={() => setGeoMode('branch')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    geoMode === 'branch' ? glassPillActive : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  شعب
                </button>
                <button
                  type="button"
                  onClick={() => setGeoMode('region')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    geoMode === 'region' ? glassPillActive : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  مناطق
                </button>
              </div>
            </div>

            {/* Apple Ranked Horizontal Bar List (Natural height, zero vertical scrollbar) */}
            <div className="space-y-2.5 py-1">
              {geoChartData.map((item, index) => {
                const val = item[selectedMetric] || 0
                const maxVal = selectedMetric.includes('rate')
                  ? 100
                  : Math.max(...geoChartData.map((x) => x[selectedMetric] || 1), 1)
                const percentWidth = Math.min(100, Math.max(3, (val / maxVal) * 100))
                const barColor = getGeoBarColor(item)

                return (
                  <div
                    key={item.name}
                    className={`p-2 rounded-xl transition-all border ${
                      isDark ? 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]' : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center shrink-0 tabular-nums ${
                          index === 0
                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                            : index === 1
                            ? 'bg-slate-300/20 text-slate-200 border border-slate-300/40'
                            : index === 2
                            ? 'bg-amber-700/20 text-amber-400 border border-amber-700/40'
                            : 'bg-black/20 text-slate-400'
                        }`}>
                          {faDigits(index + 1)}
                        </span>
                        <span className="font-bold text-xs">{item.name}</span>
                        <span className="text-[10px] text-slate-400 hidden sm:inline tabular-nums">
                          ({fa(item.active_custs || 0)} خریدار)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-xs tabular-nums" style={{ color: barColor }}>
                          {fa2(val)} {activeMetricObj.unit}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar Track */}
                    <div className={`w-full h-2 rounded-full overflow-hidden p-0.5 border ${
                      isDark ? 'bg-black/40 border-white/5' : 'bg-slate-200 border-slate-300'
                    }`}>
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

          {/* Geo Summary Footer */}
          <div className="pt-3 mt-3 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
            <span>
              رتبه نخست: <strong className={isDark ? 'text-slate-100' : 'text-slate-900'}>{geoChartData[0]?.name || '—'}</strong> ({fa2(geoChartData[0]?.[selectedMetric])} {activeMetricObj.unit})
            </span>
            <span>
              پایین‌ترین رتبه: <strong className={isDark ? 'text-slate-100' : 'text-slate-900'}>{geoChartData[geoChartData.length - 1]?.name || '—'}</strong> ({fa2(geoChartData[geoChartData.length - 1]?.[selectedMetric])} {activeMetricObj.unit})
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

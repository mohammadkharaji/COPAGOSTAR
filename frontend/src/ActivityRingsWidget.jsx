import { useMemo } from 'react'
import { motion } from 'motion/react'
import { Award, ChevronLeft, Sparkles, Target, TrendingUp, Users } from 'lucide-react'
import { useAppearance } from './AppearanceContext'
import { fa, faDigits } from './format'

export default function ActivityRingsWidget({
  type = 'visitor', // 'visitor' | 'b2b' | 'custom'
  data = {},
  customRings = null,
  title,
  subtitle,
  size = 190,
  strokeWidth = 14,
  gap = 4,
}) {
  const { isDark, isSolid } = useAppearance()

  // Build the 3 concentric rings based on the module
  const rings = useMemo(() => {
    if (customRings) return customRings

    if (type === 'visitor') {
      // 1. تحقق تارگت ریالی (Sales Target %) - Emerald #10B981
      const targetVal = data.target_rial || data.target || 500000000
      const actualVal = data.sales_rial || data.sales || 425000000
      const targetPct = Math.min(Math.max(actualVal / (targetVal || 1), 0), 1)

      // 2. تعداد فاکتور / ویزیت موفق (Successful Visits %) - Purple #8B5CF6
      const targetVisits = data.target_visits || 25
      const actualVisits = data.successful_visits || data.customers_count || 19
      const visitsPct = Math.min(Math.max(actualVisits / (targetVisits || 1), 0), 1)

      // 3. وصول مطالبات / سلامت فاکتور (Collection / Net Ratio %) - Blue #0071E3
      const collectionPct = data.collection_rate || 0.92

      return [
        {
          id: 'target_sales',
          label: 'تحقق تارگت ریالی',
          value: `${fa(Math.round(actualVal / 1e6))} م.ر`,
          target: `${fa(Math.round(targetVal / 1e6))} م.ر`,
          progress: targetPct,
          percentage: Math.round(targetPct * 100),
          color: '#10B981',
          colorEnd: '#34D399',
          icon: Target,
        },
        {
          id: 'visits_count',
          label: 'تعداد فاکتور و ویزیت موفق',
          value: `${fa(actualVisits)} ویزیت`,
          target: `${fa(targetVisits)} هدف`,
          progress: visitsPct,
          percentage: Math.round(visitsPct * 100),
          color: '#8B5CF6',
          colorEnd: '#A78BFA',
          icon: Users,
        },
        {
          id: 'collection_health',
          label: 'وصول مطالبات و سلامت فاکتور',
          value: `${fa(Math.round(collectionPct * 100))}٪`,
          target: '۱۰۰٪',
          progress: collectionPct,
          percentage: Math.round(collectionPct * 100),
          color: '#0071E3',
          colorEnd: '#42A1EC',
          icon: TrendingUp,
        },
      ]
    }

    // Default: Customer Club B2B
    // 1. فاصله تا سطح بعدی (برنزی -> نقره‌ای -> طلایی)
    const tierProgress = data.tier_progress != null ? data.tier_progress : (data.points ? Math.min(data.points / 1000, 1) : 0.78)

    // 2. تنوع کالایی (Brand / SKU Diversity)
    const skuDiversity = data.sku_diversity != null ? data.sku_diversity : 0.65

    // 3. تکرار خرید ماهانه (Purchase Frequency)
    const frequency = data.purchase_frequency != null ? data.purchase_frequency : 0.88

    return [
      {
        id: 'tier_progress',
        label: 'فاصله تا سطح بعدی (برنزی ➔ نقره‌ای ➔ طلایی)',
        value: data.tier?.level || 'نقره‌ای',
        target: 'طلایی',
        progress: tierProgress,
        percentage: Math.round(tierProgress * 100),
        color: '#D97706',
        colorEnd: '#F59E0B',
        icon: Award,
      },
      {
        id: 'sku_diversity',
        label: 'تنوع کالایی (برندها و لاین‌ها)',
        value: `${fa(Math.round(skuDiversity * 12))} برند`,
        target: '۱۲ برند',
        progress: skuDiversity,
        percentage: Math.round(skuDiversity * 100),
        color: '#8B5CF6',
        colorEnd: '#C084FC',
        icon: Sparkles,
      },
      {
        id: 'purchase_freq',
        label: 'تکرار خرید ماهانه (وفاداری دوره)',
        value: `${fa(Math.round(frequency * 5))} بار در ماه`,
        target: '۵ بار',
        progress: frequency,
        percentage: Math.round(frequency * 100),
        color: '#0071E3',
        colorEnd: '#60A5FA',
        icon: TrendingUp,
      },
    ]
  }, [type, data, customRings])

  const center = size / 2

  // Pre-calculate concentric radiuses
  const ringMetrics = useMemo(() => {
    return rings.map((ring, idx) => {
      const radius = center - strokeWidth / 2 - idx * (strokeWidth + gap)
      const circumference = 2 * Math.PI * radius
      const offset = circumference * (1 - Math.min(Math.max(ring.progress, 0), 1))
      return { radius, circumference, offset }
    })
  }, [rings, center, strokeWidth, gap])

  const defaultTitle = type === 'visitor' ? 'حلقه‌های فعالیت ویزیتور (Activity Rings)' : 'حلقه‌های رشد باشگاه مشتریان (Activity Rings)'
  const defaultSubtitle = type === 'visitor' ? 'عملکرد سه‌گانه فروش، ویزیت و وصول مطالبات' : 'پیشرفت در سطوح وفاداری، تنوع سبد و تکرار خرید'

  return (
    <div
      className={`rounded-3xl p-5 sm:p-6 transition-all select-none ${
        isDark
          ? 'bg-[#1C1C1E]/80 backdrop-blur-2xl border border-white/10 text-[#F5F5F7] shadow-[0_8px_30px_rgba(0,0,0,0.4)]'
          : isSolid
          ? 'bg-white border border-slate-200 text-[#1D1D1F] shadow-sm'
          : 'bg-white/80 backdrop-blur-2xl border border-slate-200/80 text-[#1D1D1F] shadow-[0_8px_30px_rgba(15,23,42,0.06)]'
      }`}
      dir="rtl"
    >
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-base font-extrabold tracking-normal">{title || defaultTitle}</h2>
          <p className="text-xs text-[#86868B] dark:text-[#98989D] mt-0.5">{subtitle || defaultSubtitle}</p>
        </div>
        <span
          className="px-3 py-1 rounded-full text-xs font-bold"
          style={{
            backgroundColor: `${rings[0].color}18`,
            color: rings[0].color,
          }}
        >
          Apple Activity
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Concentric 3-Ring SVG */}
        <div className="md:col-span-5 flex justify-center items-center py-2">
          <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
              <defs>
                {rings.map((ring) => (
                  <linearGradient key={`grad-${ring.id}`} id={`grad-${ring.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={ring.color} />
                    <stop offset="100%" stopColor={ring.colorEnd || ring.color} />
                  </linearGradient>
                ))}
              </defs>

              {rings.map((ring, idx) => {
                const { radius, circumference, offset } = ringMetrics[idx]
                return (
                  <g key={`ring-group-${ring.id}`}>
                    {/* Ring Track Background */}
                    <circle
                      cx={center}
                      cy={center}
                      r={radius}
                      stroke={ring.color}
                      strokeWidth={strokeWidth}
                      strokeOpacity={0.16}
                      fill="none"
                    />

                    {/* Progress Ring Stroke */}
                    <circle
                      cx={center}
                      cy={center}
                      r={radius}
                      stroke={`url(#grad-${ring.id})`}
                      strokeWidth={strokeWidth}
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                      strokeLinecap="round"
                      fill="none"
                      className="transition-all duration-1000 ease-out"
                    />
                  </g>
                )
              })}
            </svg>

            {/* Center Core Pulsing Glow Badge */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black tabular-nums tracking-normal" style={{ color: rings[0].color }}>
                {fa(rings[0].percentage)}٪
              </span>
              <span className="text-[10px] font-bold text-[#86868B] dark:text-[#98989D] -mt-0.5">
                میانگین تحقق
              </span>
            </div>
          </div>
        </div>

        {/* Legend & Breakdown Bars */}
        <div className="md:col-span-7 space-y-3">
          {rings.map((ring, idx) => {
            const Icon = ring.icon
            return (
              <div
                key={ring.id}
                className={`p-3 rounded-2xl transition-all ${
                  isDark
                    ? 'bg-white/5 border border-white/5'
                    : isSolid
                    ? 'bg-slate-50 border border-slate-100'
                    : 'bg-black/[0.02] border border-black/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: ring.color }}
                    />
                    <span className="text-xs font-bold truncate text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {ring.label}
                    </span>
                  </div>
                  <span
                    className="text-xs font-black tabular-nums px-2 py-0.5 rounded-full whitespace-nowrap"
                    style={{ backgroundColor: `${ring.color}15`, color: ring.color }}
                  >
                    {fa(ring.percentage)}٪
                  </span>
                </div>

                {/* Progress bar line */}
                <div className="h-2 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(ring.percentage, 100)}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: ring.color }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#86868B] dark:text-[#98989D] mt-1.5">
                  <span>عملکرد: <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">{ring.value}</strong></span>
                  <span>هدف: <strong>{ring.target}</strong></span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

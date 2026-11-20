import { useState } from 'react'
import { CircleDollarSign, Users, Award, TrendingUp } from 'lucide-react'
import { useAppearance } from './AppearanceContext'
import { useApi } from './api'
import { fa } from './format'
import { AppleCard, AppleKpiCard, pct, rial, Status, Table } from './ui'

export const PARETO_NAMES = { customer: 'مشتری', product: 'کالا', visitor: 'ویزیتور', branch: 'شعبه', day: 'روز' }

export function ParetoPage({ p, openCustomer, openVisitor, openProfile }) {
  const { isDark } = useAppearance()
  const [by, setBy] = useState('customer')
  const [th, setTh] = useState('0.8')
  const r = useApi('/pareto', { ...p, by, threshold: th })
  const rowOpen = by === 'customer' ? (x) => openCustomer(x.code) : by === 'visitor' ? (x) => openVisitor(x.code)
    : by === 'branch' ? (x) => openProfile('branch', x.code) : by === 'product' ? (x) => openProfile('product', x.name) : undefined
  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5">
      {/* Dark Emerald Floating Filter Bar */}
      <div className={`rounded-2xl backdrop-blur-xl border p-3 sm:p-4 flex items-center justify-between gap-4 flex-wrap ${
        isDark
          ? 'bg-[#0B100E]/75 border-emerald-500/15 shadow-[0_4px_20px_rgba(0,0,0,0.35)]'
          : 'bg-white/90 border-slate-200/80 shadow-xs'
      }`}>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>بُعد پارتو:</span>
          <div className={`flex items-center gap-1 p-1 rounded-xl flex-wrap ${isDark ? 'bg-black/30' : 'bg-slate-100'}`}>
            {Object.entries(PARETO_NAMES).map(([k, label]) => (
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

        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>آستانه پارتو:</span>
          <div className={`flex items-center gap-1 p-1 rounded-xl ${isDark ? 'bg-black/30' : 'bg-slate-100'}`}>
            {['0.5', '0.7', '0.8', '0.9'].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setTh(v)}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  th === v
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
                    : isDark ? 'text-slate-300 hover:text-white hover:bg-white/5' : 'text-slate-700 hover:bg-white'
                }`}
              >
                {pct(Number(v), 0)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Status state={r}>{(j) => (
        <>
          {/* 4 Compact Dark Emerald KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 w-full">
            <AppleKpiCard
              label="جمع فروش عادی"
              value={rial(j.total_rial)}
              unit="ریال · بدون پروموشن و مرجوعی"
              icon={CircleDollarSign}
              tone="teal"
            />
            <AppleKpiCard
              label={`تعداد کل (${PARETO_NAMES[by]})`}
              value={fa(j.count)}
              unit={`کل ردیف‌های ${PARETO_NAMES[by]}`}
              icon={Users}
              tone="blue"
            />
            <AppleKpiCard
              label={`تعداد پارتو (تا ${pct(j.threshold, 0)} فروش)`}
              value={fa(j.pareto_count)}
              unit={`${PARETO_NAMES[by]}‌های سازندهٔ هسته فروش`}
              icon={Award}
              tone="green"
            />
            <AppleKpiCard
              label="درصد تعداد پارتو"
              value={pct(j.pareto_count_percent, 1)}
              unit={`از کل ${PARETO_NAMES[by]}‌ها`}
              icon={TrendingUp}
              tone="amber"
            />
          </div>

          {/* Pareto Table Bento */}
          <AppleCard
            title={`جدول تحلیل پارتو ${PARETO_NAMES[by]}`}
            subtitle={rowOpen ? `برای دیدن پروفایل، روی ${PARETO_NAMES[by]} کلیک کنید · ردیف‌های دارای نشان سبز شامل قانون پارتو هستند` : 'فقط فروش عادی؛ پروموشن و مرجوعی حذف است'}
            badge={`${j.items?.length ?? 0} ردیف`}
          >
            <Table
              name={`پارتو-${by}`}
              rows={j.items}
              highlight={(x) => x.rank <= j.pareto_count}
              rowClassName={(x) => {
                if (x.rank === 1) return 'podium-gold border-r-4 border-r-amber-400'
                if (x.rank === 2) return 'podium-silver border-r-4 border-r-sky-400'
                if (x.rank === 3) return 'podium-bronze border-r-4 border-r-emerald-400'
                return ''
              }}
              onRow={rowOpen}
              columns={[
                {
                  label: 'رتبه',
                  render: (x) => {
                    if (x.rank === 1) {
                      return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-500/25 to-yellow-500/20 text-amber-700 dark:text-amber-300 border border-amber-400/40 shadow-xs shadow-amber-500/10">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          #{fa(1)}
                        </span>
                      )
                    }
                    if (x.rank === 2) {
                      return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-gradient-to-r from-sky-500/25 to-cyan-500/20 text-sky-700 dark:text-sky-300 border border-sky-400/40 shadow-xs shadow-sky-500/10">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                          #{fa(2)}
                        </span>
                      )
                    }
                    if (x.rank === 3) {
                      return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-gradient-to-r from-emerald-500/25 to-teal-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-400/40 shadow-xs shadow-emerald-500/10">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          #{fa(3)}
                        </span>
                      )
                    }
                    return <span className="tabular-nums text-slate-400 font-medium px-2">{fa(x.rank)}</span>
                  },
                  value: (x) => x.rank,
                },
                ...(by === 'day' || by === 'branch' ? [] : [{ label: 'کد', render: (x) => x.code, value: (x) => String(x.code) }]),
                {
                  label: PARETO_NAMES[by],
                  render: (x) => {
                    if (x.rank === 1) {
                      return (
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>{x.name}</span>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-400/30">پیشتاز</span>
                        </div>
                      )
                    }
                    if (x.rank === 2) {
                      return (
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${isDark ? 'text-sky-300' : 'text-sky-800'}`}>{x.name}</span>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-400/30">رتبه ۲</span>
                        </div>
                      )
                    }
                    if (x.rank === 3) {
                      return (
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>{x.name}</span>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30">رتبه ۳</span>
                        </div>
                      )
                    }
                    return <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{x.name}</span>
                  },
                  value: (x) => String(x.name ?? ''),
                },
                {
                  label: 'فروش (ریال)',
                  render: (x) => {
                    const colorClass =
                      x.rank === 1 ? (isDark ? 'text-amber-400 font-black' : 'text-amber-700 font-black') :
                      x.rank === 2 ? (isDark ? 'text-sky-400 font-black' : 'text-sky-700 font-black') :
                      x.rank === 3 ? (isDark ? 'text-emerald-400 font-black' : 'text-emerald-700 font-black') :
                      (isDark ? 'text-emerald-400 font-bold' : 'text-emerald-700 font-bold')
                    return <span className={`tabular-nums ${colorClass}`}>{rial(x.sales_rial)}</span>
                  },
                  value: (x) => x.sales_rial,
                },
                {
                  label: 'سهم فروش',
                  render: (x) => {
                    const colorClass =
                      x.rank === 1 ? (isDark ? 'text-amber-300 font-bold' : 'text-amber-700 font-bold') :
                      x.rank === 2 ? (isDark ? 'text-sky-300 font-bold' : 'text-sky-700 font-bold') :
                      x.rank === 3 ? (isDark ? 'text-emerald-300 font-bold' : 'text-emerald-700 font-bold') :
                      'font-medium'
                    return <span className={`tabular-nums ${colorClass}`}>{pct(x.share, 2)}</span>
                  },
                  value: (x) => x.share * 100,
                  unit: '٪',
                },
                {
                  label: 'سهم تجمعی',
                  render: (x) => {
                    const colorClass =
                      x.rank === 1 ? (isDark ? 'text-amber-300 font-bold' : 'text-amber-700 font-bold') :
                      x.rank === 2 ? (isDark ? 'text-sky-300 font-bold' : 'text-sky-700 font-bold') :
                      x.rank === 3 ? (isDark ? 'text-emerald-300 font-bold' : 'text-emerald-700 font-bold') :
                      (x.rank <= j.pareto_count ? (isDark ? 'text-teal-400 font-semibold' : 'text-teal-700 font-semibold') : 'font-semibold')
                    return <span className={`tabular-nums ${colorClass}`}>{pct(x.cum_share, 1)}</span>
                  },
                  value: (x) => x.cum_share * 100,
                  unit: '٪',
                },
              ]}
            />
          </AppleCard>
        </>
      )}</Status>
    </div>
  )
}

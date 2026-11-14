import { motion, useReducedMotion } from 'motion/react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { fa, monthLabel, dayLabel } from '../format'

const pct  = (v) => (v == null ? '—' : `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(v * 100)}٪`)
const pctN = (v, d = 1) => (v == null ? '—' : `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: d }).format(v * 100)}٪`)

/* ─────────────────────────────────────────────────────────────
   SpotlightCard  (Apple glass widget shell – exported for reuse)
───────────────────────────────────────────────────────────── */
export function SpotlightCard({ children, tone = 'blue', delay = 0, className = '', as: Tag = 'div' }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.23, 1, 0.32, 1] }}
      whileHover={reduce ? undefined : { y: -3 }}
      className={`rounded-3xl bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_12px_30px_rgb(0,0,0,0.07)] transition-shadow ${className}`}
    >
      <Tag className="p-4 h-full w-full text-right flex flex-col justify-between">{children}</Tag>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────────────────────
   StatusIsland  (stays in ExecShell header – API unchanged)
───────────────────────────────────────────────────────────── */
export function StatusIsland({ core, cores, setCore, lastDataDate, syncState }) {
  return (
    <div className="nav-island kok">
      <div className="nav-seg" role="tablist" aria-label="شرکت">
        {Object.entries(cores).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={core === k} className={core === k ? 'on' : ''} onClick={() => setCore(k)}>
            {core === k && <motion.span layoutId="navCore" className="nav-seg-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            <em>{label}</em>
          </button>
        ))}
      </div>
      <span className={`nav-status ${syncState === 'running' ? 'busy' : ''}`}>
        <i aria-hidden="true" />
        {lastDataDate ? `داده تا ${dayLabel(lastDataDate)}` : 'بدون داده'}
      </span>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   HeroMetricCard  — Apple dark-gradient hero (8-col)
   Layout: Top badges -> Big Revenue Number -> 3 stats grid
   Clean, no overlapping boxes or random wrappers
───────────────────────────────────────────────────────────── */
export function HeroMetricCard({ rows, period, o, growth, growthLabel }) {
  const gross    = o ? o.sum_rial_vat / 1e9 : null
  const promo    = o ? o.promo_total_rial / 1e9 : null
  const promoPct = o ? o.promo_percent : null

  return (
    <div className="lg:col-span-8 flex flex-col justify-between relative overflow-hidden rounded-[24px] sm:rounded-[28px] bg-gradient-to-br from-[#0A1128] via-[#102542] to-[#1D3557] text-white p-4 sm:p-7 shadow-[0_20px_50px_rgba(16,37,66,0.22)] min-h-[260px] sm:min-h-[300px] w-full max-w-full">
      {/* Top badges */}
      <div className="relative z-10 flex items-center justify-between flex-wrap gap-2">
        <span className="px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-medium bg-white/10 backdrop-blur-md border border-white/15">
          فروش خالص (پس از کسر پروموشن) · {period}
        </span>
        {growth != null && (
          <span className={`px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold tabular-nums ${growth >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-400/20 text-red-300'}`}>
            {growth >= 0 ? '▲' : '▼'} {pct(Math.abs(growth))} {growthLabel ?? ''}
          </span>
        )}
      </div>

      {/* Big Revenue Number */}
      <div className="relative z-10 my-4 sm:my-6">
        <div className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight tabular-nums break-all">
          {o ? fa(o.net_rial) : '—'} <span className="text-xs sm:text-base font-normal text-white/60 mr-1 sm:mr-2">ریال</span>
        </div>
      </div>

      {/* Bottom 3 stats */}
      <div className="relative z-10 grid grid-cols-3 gap-2 sm:gap-3 w-full">
        <div className="rounded-xl sm:rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 p-2.5 sm:p-3.5 min-w-0">
          <p className="text-[10px] sm:text-xs text-white/65 truncate">فروش ناخالص</p>
          <p className="text-xs sm:text-lg font-bold mt-1 tabular-nums truncate">{gross == null ? '—' : `${fa(gross)} م`}</p>
        </div>
        <div className="rounded-xl sm:rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 p-2.5 sm:p-3.5 min-w-0">
          <p className="text-[10px] sm:text-xs text-white/65 truncate">مجموع پروموشن</p>
          <p className="text-xs sm:text-lg font-bold mt-1 tabular-nums truncate">{promo == null ? '—' : `${fa(promo)} م`}</p>
        </div>
        <div className="rounded-xl sm:rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 p-2.5 sm:p-3.5 min-w-0">
          <p className="text-[10px] sm:text-xs text-white/65 truncate">درصد پروموشن</p>
          <p className="text-xs sm:text-lg font-bold mt-1 tabular-nums truncate">{promoPct == null ? '—' : pct(promoPct)}</p>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   ForecastRings  — Apple white-glass card (4-col)
   Activity Ring sits next to real Persian forecast numbers.
   Duplicate English fractions deleted completely!
───────────────────────────────────────────────────────────── */
export function ForecastRings({ pace }) {
  const d = pace.data?.available ? pace.data : null

  if (!d) return (
    <div className="lg:col-span-4 flex flex-col justify-between rounded-[24px] sm:rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4 sm:p-6 min-h-[260px] sm:min-h-[300px] items-center justify-center overflow-hidden w-full max-w-full">
      <p className="text-sm text-[#86868B]">{pace.loading ? 'در حال بارگذاری…' : 'داده‌ای برای برآورد وجود ندارد.'}</p>
    </div>
  )

  const done = d.remaining_working_days === 0
  const projected = done ? d.net_rial : d.projected_net_rial
  const daysPassed = d.elapsed_working_days || 0
  const totalDays = d.working_days || 1
  const daysRatio = Math.min(Math.max(daysPassed / totalDays, 0), 1)

  return (
    <div className="lg:col-span-4 flex flex-col justify-between rounded-[24px] sm:rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4 sm:p-6 overflow-hidden w-full max-w-full">
      <div>
        <h2 className="text-base font-bold text-[#1D1D1F]">پیش‌بینی پایان {monthLabel(d.year_month)}</h2>
      </div>

      <div className="flex items-center gap-5 my-4">
        {/* Apple Ring with Persian label */}
        <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" stroke="#E5E5EA" strokeWidth="10" fill="none" />
            <motion.circle
              cx="50"
              cy="50"
              r="40"
              stroke="#0071E3"
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
            <span className="text-sm font-extrabold text-[#1D1D1F] tabular-nums">
              {fa(daysPassed)} از {fa(totalDays)}
            </span>
            <span className="text-[10px] text-[#86868B]">روز کاری</span>
          </div>
        </div>

        {/* Real Persian Forecast Numbers */}
        <div className="space-y-1.5 flex-1 min-w-0">
          <p className="text-xs text-[#86868B]">ریال خالص برآوردی پایان ماه</p>
          <p className="text-xl font-extrabold text-[#1D1D1F] tabular-nums truncate">
            {fa(projected)}
          </p>
          <div className="pt-2 space-y-1 border-t border-black/[0.06] text-xs">
            <div className="flex justify-between">
              <span className="text-[#86868B]">ناخالص واقعی:</span>
              <strong className="text-[#1D1D1F] tabular-nums">{fa(d.sum_rial_vat)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#86868B]">روز باقی‌مانده:</span>
              <strong className="text-amber-600 tabular-nums">{fa(d.remaining_working_days)} روز</strong>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-[#86868B] leading-relaxed">
        {d.method}. این عدد پیش‌بینی است، نه فروش ثبت‌شده.
      </p>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   CalendarGlass  — Apple compact status pill bar
───────────────────────────────────────────────────────────── */
export function CalendarGlass({ cal }) {
  const share = cal ? Math.min(1, cal.days_passed / (cal.working_days || 1)) : 0
  return (
    <div className="w-full flex flex-wrap items-center justify-between gap-2 sm:gap-3 bg-white/80 backdrop-blur-2xl border border-black/[0.05] shadow-[0_4px_20px_rgb(0,0,0,0.04)] rounded-2xl sm:rounded-3xl p-3 sm:px-5 sm:py-3.5">
      <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#1D1D1F]">
        <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center select-none text-xs sm:text-sm">📅</span>
        <span className="truncate">{cal ? `${cal.weekday_name} ${fa(cal.day)} ${cal.month_name} ${fa(cal.year)}` : '—'}</span>
      </div>
      <div className="flex items-center gap-2 sm:gap-4 text-[11px] sm:text-xs">
        <span className="text-[#86868B]">روز کاری: <strong className="text-[#1D1D1F] font-semibold">{cal ? fa(cal.working_days) : '—'}</strong></span>
        <span className="text-[#86868B]">سپری‌شده: <strong className="text-[#0071E3] font-semibold">{cal ? fa(cal.days_passed) : '—'}</strong></span>
        <span className="text-[#86868B]">باقی‌مانده: <strong className="text-amber-600 font-semibold">{cal ? fa(cal.days_remaining) : '—'}</strong></span>
      </div>
      <div className="hidden sm:flex items-center gap-2 flex-1 min-w-[80px] max-w-[180px]">
        <div className="h-1.5 w-full bg-black/[0.06] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${share * 100}%` }}
            transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
            className="h-full rounded-full bg-[#0071E3]"
          />
        </div>
        <span className="text-xs font-medium text-[#0071E3] shrink-0">{pctN(share, 0)}</span>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   KpiSpotlight  — Strict 6x2 Apple Widget Grid for 12 KPIs
   Parent wrapper: grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 w-full
───────────────────────────────────────────────────────────── */
const TONE_COLORS = {
  blue:   'bg-blue-500/10 text-blue-600',
  violet: 'bg-violet-500/10 text-violet-600',
  amber:  'bg-amber-500/10 text-amber-600',
  teal:   'bg-teal-500/10 text-teal-600',
  sky:    'bg-sky-500/10 text-sky-600',
  pink:   'bg-pink-500/10 text-pink-600',
  red:    'bg-red-500/10 text-red-600',
}

export function KpiSpotlight({ items }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-4 w-full">
      {items.map((m, i) => {
        const Tag = m.onClick ? 'button' : 'div'
        return (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.03, ease: [0.23, 1, 0.32, 1] }}
            whileHover={{ y: -3 }}
            className="h-full"
          >
            <Tag
              type={m.onClick ? 'button' : undefined}
              onClick={m.onClick}
              className={`w-full h-full rounded-2xl sm:rounded-3xl bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-3 sm:p-4 flex flex-col justify-between hover:shadow-[0_12px_30px_rgb(0,0,0,0.07)] transition-shadow text-right${m.onClick ? ' cursor-pointer' : ''}`}
            >
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <span className="text-[11px] sm:text-xs font-medium text-[#86868B] leading-tight truncate">{m.label}</span>
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 ${TONE_COLORS[m.tone] ?? 'bg-blue-500/10 text-blue-600'}`}>
                  {m.icon ? <m.icon size={15} /> : null}
                </div>
              </div>
              <div>
                <div className="text-sm sm:text-base font-extrabold text-[#1D1D1F] tracking-tight tabular-nums truncate">{m.value}</div>
                <div className="text-[10px] sm:text-[11px] text-[#86868B] mt-0.5 sm:mt-1 truncate">{m.unit}</div>
              </div>
            </Tag>
          </motion.div>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   ShareTabsCard  — Apple glass card with Donut Chart + animated bars
───────────────────────────────────────────────────────────── */
export function ShareTabsCard({ by, setBy, options, slices, total, colors }) {
  return (
    <div className="rounded-[24px] sm:rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4 sm:p-6 h-full flex flex-col justify-between overflow-hidden w-full max-w-full">
      <div>
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="text-base font-bold text-[#1D1D1F]">سهم از فروش</h2>
          <span className="text-[11px] text-[#86868B] truncate">۸ مورد برتر و بقیه در «سایر»</span>
        </div>

        {/* Apple Segmented Control Bar */}
        <div className="flex items-center gap-1 p-1 bg-[#E8E8ED]/80 rounded-2xl flex-nowrap overflow-x-auto no-scrollbar max-w-full pb-1 mb-3" role="tablist" aria-label="بعد نمودار">
          {options.map(([k, label]) => {
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
                    layoutId="salesShareFilter"
                    className="absolute inset-0 rounded-xl bg-[#0071E3] shadow-sm shadow-blue-500/25"
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

        {/* Apple Donut Chart with Center Summary */}
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
                  <Cell key={s.name} fill={colors[i % colors.length]} />
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
      </div>

      {/* Breakdown list with animated bars */}
      <ul className="space-y-2 mt-3 pt-3 border-t border-black/[0.05] max-h-48 overflow-y-auto w-full px-1">
        {slices.map((s, i) => (
          <li key={s.name} className="flex items-center justify-between gap-2 text-xs w-full px-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colors[i % colors.length] }} />
              <span className="text-xs text-[#1D1D1F] font-medium truncate">{s.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-[#1D1D1F] tabular-nums">{pct(s.value / total)}</span>
              <span aria-hidden="true" className="w-12 sm:w-16 h-1.5 bg-black/[0.06] rounded-full overflow-hidden shrink-0">
                <motion.span
                  className="block h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(s.value / total) * 100}%` }}
                  transition={{ duration: 0.8, delay: i * 0.04, ease: [0.23, 1, 0.32, 1] }}
                  style={{ background: colors[i % colors.length] }}
                />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   CompareBento  — animated comparison row list
───────────────────────────────────────────────────────────── */
export function CompareBento({ c, b, items, Delta }) {
  return (
    <ul className="space-y-3">
      {items.map(([label, key], i) => (
        <motion.li
          key={key}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-center gap-2 text-xs"
        >
          <span className="text-[#86868B] flex-1">{label}</span>
          <span className="font-semibold text-[#1D1D1F] tabular-nums">{fa(c[key])}</span>
          <span className="text-[#86868B] tabular-nums">{fa(b[key])}</span>
          <Delta cur={c[key]} prev={b[key]} />
        </motion.li>
      ))}
    </ul>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { motion } from 'motion/react'
import { CircleDollarSign, Calendar, TrendingUp, Users, Award, BarChart3, Activity, FileText, Send, UserRound, UserCheck, Layers, Store, ShoppingBag, RotateCcw } from 'lucide-react'
import { postJson, useApi } from './api'
import { dayLabel, fa, fa2, monthLabel, monthName } from './format'
import { ChartTip, Kpi, Panel, Status, Table, Toggle, pct, rial } from './ui'
import { ReturnsProfileCard, returnsArg } from './ReturnsPage'

export { ReturnsPage } from './ReturnsPage'

const faDate = (k) => (/^\d{8}$/.test(String(k)) ? `${String(k).slice(0, 4)}/${String(k).slice(4, 6)}/${String(k).slice(6)}` : k)
const billions = (v) => v / 1e9

function Bars({ data, x, bars, tickFn, unit = 'میلیارد ریال', tall, onBar, active }) {
  return (
    <div className={`chart ${tall ? 'tall' : ''}`} role="img">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey={x} reversed tickFormatter={tickFn} tickLine={false} axisLine={false} interval={0} angle={data.length > 10 ? -35 : 0} textAnchor={data.length > 10 ? 'end' : 'middle'} height={data.length > 10 ? 70 : 30} />
          <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={64} />
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

/* ---------- تحلیل تعداد کالا (خالص از مرجوعی - Apple Bento) ---------- */
const pctChange = (v) => (v == null ? '—' : `${v > 0 ? '▲' : '▼'} ${fa(Math.abs(v * 100).toFixed(1))}٪`)

function QuantityMonthCompare({ p }) {
  const m = useApi('/quantity-monthly', p)
  const months = Array.isArray(m.data) ? m.data : []
  const last = months[months.length - 1]
  const prev = months[months.length - 2]
  const change = last?.change_percent
  const delta = last && prev ? last.net_qty - prev.net_qty : null
  const tone = change == null ? 'blue' : change < 0 ? 'red' : 'teal'

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
      <AppleKpiCard
        label={last ? `ماه جاری (${monthLabel(last.month)})` : 'ماه جاری'}
        value={last ? fa(last.net_qty) : '—'}
        unit="تعداد خالص کالا"
        icon={ShoppingBag}
        tone="blue"
      />
      <AppleKpiCard
        label={prev ? `ماه قبل (${monthLabel(prev.month)})` : 'ماه قبل'}
        value={prev ? fa(prev.net_qty) : '—'}
        unit="تعداد خالص کالا"
        icon={Calendar}
        tone="violet"
      />
      <AppleKpiCard
        label="تغییر نسبت به ماه قبل"
        value={pctChange(change)}
        unit={delta == null ? 'بدون داده پیشین' : `${delta > 0 ? 'افزایش' : 'کاهش'} ${fa(Math.abs(delta))} عدد`}
        icon={TrendingUp}
        tone={tone}
      />
    </div>
  )
}

function QuantityGrowth({ p }) {
  const m = useApi('/quantity-monthly', p)
  const data = (Array.isArray(m.data) ? m.data : []).map((x) => ({
    ...x,
    label: monthLabel(x.month),
    growth: x.change_percent == null ? null : x.change_percent * 100,
  }))
  return (
    <AppleCard
      title="روند رشد ماهانه تعداد"
      subtitle="تعداد خالص هر ماه و درصد تغییر نسبت به ماه قبل"
      badge="روند ماهانه"
    >
      <div className="h-80 w-full mt-2" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="appleQtyBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#A78BFA" />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#E5E5EA" strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#86868B', fontSize: 12 }} />
            <YAxis yAxisId="qty" orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={80} tick={{ fill: '#86868B', fontSize: 12 }} />
            <YAxis yAxisId="pct" orientation="left" tickFormatter={(v) => `${v}٪`} tickLine={false} axisLine={false} width={56} tick={{ fill: '#86868B', fontSize: 12 }} />
            <Tooltip content={<ChartTip unit="عدد" />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            <Legend />
            <Bar yAxisId="qty" dataKey="net_qty" name="تعداد خالص" fill="url(#appleQtyBar)" radius={[8, 8, 0, 0]} maxBarSize={36} />
            <Line yAxisId="pct" dataKey="growth" name="رشد ٪" stroke="#0071E3" strokeWidth={2.5} dot={{ r: 4, fill: '#0071E3' }} connectNulls={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </AppleCard>
  )
}

export const QuantityPage = ({ p }) => {
  const r = useApi('/quantity', { ...p, limit: 20 })
  const data = (Array.isArray(r.data) ? r.data : []).map((x) => ({ ...x, short: x.product }))
  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6">
      <QuantityMonthCompare p={p} />
      <QuantityGrowth p={p} />

      <AppleCard
        title="تحلیل تعداد کالا (۲۰ کالای برتر)"
        subtitle="بر اساس تعداد خالص (فروش منهای مرجوعی فروش، بدون پروموشن)"
        badge="۲۰ برتر"
      >
        <div className="h-[520px] w-full mt-2" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="appleQtyHBar" x1="1" y1="0" x2="0" y2="0">
                  <stop offset="0%" stopColor="#0071E3" />
                  <stop offset="100%" stopColor="#42A1EC" />
                </linearGradient>
              </defs>
              <CartesianGrid horizontal={false} stroke="#E5E5EA" strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} tick={{ fill: '#86868B', fontSize: 12 }} />
              <YAxis type="category" dataKey="short" width={220} tickLine={false} axisLine={false} interval={0} tick={{ fill: '#1D1D1F', fontSize: 11 }} />
              <Tooltip content={<ChartTip unit="عدد" />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
              <Bar dataKey="net_qty" name="تعداد خالص" fill="url(#appleQtyHBar)" radius={[0, 6, 6, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </AppleCard>

      <AppleCard
        title="جدول رتبه‌بندی تعداد کالا"
        subtitle="رتبه، تعداد خالص، فروش خالص، تعداد فاکتور و ریال به ازای هر واحد"
        badge={`${data.length} ردیف`}
      >
        <Table name="تعداد-کالا" rows={data} columns={[
          { label: 'کالا', render: (r) => <span className="font-semibold text-[#1D1D1F]">{r.product}</span>, value: (r) => r.product },
          { label: 'تعداد خالص', render: (r) => <span className="tabular-nums font-bold text-violet-700">{fa(r.net_qty)}</span>, value: (r) => r.net_qty },
          { label: 'فروش خالص (ریال)', render: (r) => <span className="tabular-nums font-medium text-[#1D1D1F]">{fa(r.net_rial)}</span>, value: (r) => r.net_rial },
          { label: 'فاکتور', render: (r) => <span className="tabular-nums">{fa(r.invoices)}</span>, value: (r) => r.invoices },
          { label: 'ریال به ازای واحد', render: (r) => <span className="tabular-nums text-[#86868B]">{fa(r.rial_per_unit)}</span>, value: (r) => r.rial_per_unit },
        ]} />
      </AppleCard>
    </div>
  )
}

/* ---------- کامپوننت کارت کی‌پی‌آی اپل بنتو ---------- */
function AppleKpiCard({ label, value, unit, icon: Icon, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-500/10 text-blue-600',
    teal: 'bg-teal-500/10 text-teal-600',
    amber: 'bg-amber-500/10 text-amber-600',
    violet: 'bg-violet-500/10 text-violet-600',
    pink: 'bg-pink-500/10 text-pink-600',
  }
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="rounded-3xl bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-5 flex flex-col justify-between hover:shadow-[0_12px_30px_rgb(0,0,0,0.07)] transition-shadow text-right"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[#86868B]">{label}</span>
        <div className={`w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 ${tones[tone] || tones.blue}`}>
          {Icon ? <Icon size={16} /> : null}
        </div>
      </div>
      <div>
        <div className="text-xl font-extrabold text-[#1D1D1F] tracking-tight tabular-nums truncate">{value}</div>
        <div className="text-[11px] text-[#86868B] mt-1 truncate">{unit}</div>
      </div>
    </motion.div>
  )
}

/* ---------- کامپوننت پوسته کارت اپل بنتو ---------- */
function AppleCard({ title, subtitle, badge, action, children, className = '' }) {
  return (
    <div className={`rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 ${className}`}>
      {(title || subtitle || badge || action) && (
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            {title && <h2 className="text-base font-bold text-[#1D1D1F]">{title}</h2>}
            {subtitle && <p className="text-xs text-[#86868B] mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {badge && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#0071E3]/10 text-[#0071E3]">
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
const PIE_OPTIONS = [['branch', 'شعبه'], ['region', 'منطقه'], ['brand', 'برند'], ['sales_type', 'کانال فروش'], ['group', 'لاین'], ['grade', 'گرید مشتری'], ['month', 'ماه']]

function SharePie({ p, defaultBy }) {
  const [by, setBy] = useState(defaultBy)
  const r = useApi('/breakdown', { ...p, by, limit: 40 })
  return (
    <div className="rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-[#1D1D1F]">سهم از فروش</h2>
          <span className="text-[11px] text-[#86868B]">۸ مورد برتر و بقیه در «سایر»</span>
        </div>

        {/* Apple Segmented Control Bar */}
        <div className="flex items-center gap-1 p-1 bg-[#E8E8ED]/80 rounded-2xl flex-wrap mb-3" role="tablist" aria-label="بعد نمودار">
          {PIE_OPTIONS.map(([k, label]) => {
            const active = by === k
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setBy(k)}
                className="relative px-3 py-1.5 rounded-xl text-xs font-medium transition-all select-none"
              >
                {active && (
                  <motion.span
                    layoutId={`pieShareFilter-${defaultBy}`}
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

/* ---------- روند ماهانه (Apple Bento Design) ---------- */
export function MonthlyTrendPage({ p }) {
  const { month: _m, start: _s, end: _e, ...q } = p
  const m = useApi('/monthly', q)
  return (
    <Status state={m}>{(rows) => {
      const d = rows.map((r) => ({ ...r, gross: billions(r.sum_rial_vat), net: billions(r.net_rial) }))
      const total = rows.reduce((s, r) => s + r.sum_rial_vat, 0)
      const best = rows.reduce((a, r) => (r.sum_rial_vat > (a?.sum_rial_vat ?? -Infinity) ? r : a), null)
      return (
        <div className="w-full max-w-[1600px] mx-auto space-y-6">
          {/* 4 Apple Bento KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
            <AppleKpiCard label="جمع فروش (Rial+Vat)" value={rial(total)} unit="ریال" icon={CircleDollarSign} tone="blue" />
            <AppleKpiCard label="تعداد ماه دارای فروش" value={fa(rows.length)} unit="ماه" icon={Calendar} tone="violet" />
            <AppleKpiCard label="میانگین فروش ماهانه" value={rows.length ? rial(total / rows.length) : '—'} unit="ریال" icon={TrendingUp} tone="teal" />
            <AppleKpiCard label="بهترین ماه" value={best ? monthName(best.year_month) : '—'} unit={best ? `${rial(best.sum_rial_vat)} ریال` : ''} icon={Award} tone="amber" />
          </div>

          {/* Bento Row: Monthly Sales Bar Chart (8 cols) + Share Donut (4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch w-full">
            <div className="lg:col-span-8 rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h2 className="text-base font-bold text-[#1D1D1F]">روند ماهانه فروش</h2>
                  <p className="text-xs text-[#86868B] mt-0.5">فروش ناخالص و ریال خالص · میلیارد ریال</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium">
                  <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-[#0071E3]" />ناخالص (Rial+Vat)</span>
                  <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-[#34C759]" />ریال خالص</span>
                </div>
              </div>
              <div className="h-72 w-full mt-2" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barGap={6}>
                    <defs>
                      <linearGradient id="appleGross" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0071E3" />
                        <stop offset="100%" stopColor="#42A1EC" />
                      </linearGradient>
                      <linearGradient id="appleNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34C759" />
                        <stop offset="100%" stopColor="#30D158" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#E5E5EA" strokeDasharray="3 3" />
                    <XAxis dataKey="year_month" reversed tickFormatter={monthName} tickLine={false} axisLine={false} tick={{ fill: '#86868B', fontSize: 12 }} />
                    <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} tick={{ fill: '#86868B', fontSize: 12 }} width={55} />
                    <Tooltip
                      formatter={(v, n) => [`${fa(v)} میلیارد ریال`, n]}
                      labelFormatter={monthLabel}
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
                      cursor={{ fill: 'rgba(0, 113, 227, 0.04)', radius: 10 }}
                    />
                    <Bar dataKey="gross" name="فروش ناخالص" fill="url(#appleGross)" radius={[8, 8, 2, 2]} maxBarSize={28} />
                    <Bar dataKey="net" name="ریال خالص" fill="url(#appleNet)" radius={[8, 8, 2, 2]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-4">
              <SharePie p={q} defaultBy="month" />
            </div>
          </div>

          {/* Invoices and Active Customers Chart */}
          <div className="rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-[#1D1D1F]">روند ماهانه تعداد فاکتور و مشتری فعال</h2>
                <p className="text-xs text-[#86868B] mt-0.5">تعداد فاکتورهای صادر شده و خریداران یکتا در هر ماه</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-[#FF9500]" />تعداد فاکتور</span>
                <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full bg-[#5AC8FA]" />مشتری فعال</span>
              </div>
            </div>
            <div className="h-64 w-full mt-2" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barGap={6}>
                  <defs>
                    <linearGradient id="appleInvoice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF9500" />
                      <stop offset="100%" stopColor="#FFB340" />
                    </linearGradient>
                    <linearGradient id="appleCust" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5AC8FA" />
                      <stop offset="100%" stopColor="#64D2FF" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#E5E5EA" strokeDasharray="3 3" />
                  <XAxis dataKey="year_month" reversed tickFormatter={monthName} tickLine={false} axisLine={false} tick={{ fill: '#86868B', fontSize: 12 }} />
                  <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} tick={{ fill: '#86868B', fontSize: 12 }} width={55} />
                  <Tooltip
                    formatter={(v, n) => [`${fa(v)}`, n]}
                    labelFormatter={monthLabel}
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
                    cursor={{ fill: 'rgba(0,0,0,0.03)', radius: 10 }}
                  />
                  <Bar dataKey="invoice_count" name="تعداد فاکتور" fill="url(#appleInvoice)" radius={[8, 8, 2, 2]} maxBarSize={28} />
                  <Bar dataKey="active_customers" name="مشتری فعال" fill="url(#appleCust)" radius={[8, 8, 2, 2]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Table Card */}
          <div className="rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-[#1D1D1F]">جدول خلاصهٔ ماهانه</h2>
                <p className="text-xs text-[#86868B] mt-0.5">جزئیات آماری فروش، فاکتورها، پروموشن و مشتریان به تفکیک ماه</p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#0071E3]/10 text-[#0071E3]">
                {fa(rows.length)} ماه ثبت‌شده
              </span>
            </div>
            <Table name="جدول-ماهانه" rows={rows} columns={[
              { label: 'ماه', render: (r) => monthName(r.year_month), value: (r) => r.year_month },
              { label: 'Sum of Rial+Vat', render: (r) => rial(r.sum_rial_vat), value: (r) => r.sum_rial_vat },
              { label: 'ریال خالص', render: (r) => rial(r.net_rial), value: (r) => r.net_rial },
              { label: 'تعداد فاکتور', render: (r) => fa(r.invoice_count), value: (r) => r.invoice_count },
              { label: 'درصد رشد فاکتور', render: (r) => pct(r.invoice_growth, 2), value: (r) => (r.invoice_growth == null ? '' : r.invoice_growth * 100), unit: '٪' },
              { label: 'مشتری فعال', render: (r) => fa(r.active_customers), value: (r) => r.active_customers },
              { label: 'درصد پروموشن کل', render: (r) => pct(r.promo_percent, 2), value: (r) => r.promo_percent * 100, unit: '٪' },
            ]} />
          </div>
        </div>
      )
    }}</Status>
  )
}

/* ---------- روند روزانه (Apple Bento Design) ---------- */
export function TrendPage({ p }) {
  const t = useApi('/trend', p)
  return (
    <Status state={t}>{(rows) => {
      const d = rows.map((r) => ({ ...r, gross: billions(r.sum_rial_vat) }))
      const total = rows.reduce((s, r) => s + r.sum_rial_vat, 0)
      const best = rows.reduce((a, r) => (r.sum_rial_vat > (a?.sum_rial_vat ?? -Infinity) ? r : a), null)
      return (
        <div className="w-full max-w-[1600px] mx-auto space-y-6">
          {/* 4 Apple Bento KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
            <AppleKpiCard label="جمع فروش دوره" value={rial(total)} unit="ریال" icon={CircleDollarSign} tone="blue" />
            <AppleKpiCard label="تعداد روز دارای فروش" value={fa(rows.length)} unit="روز" icon={Calendar} tone="violet" />
            <AppleKpiCard label="میانگین فروش روزانه" value={rows.length ? rial(total / rows.length) : '—'} unit="ریال" icon={TrendingUp} tone="teal" />
            <AppleKpiCard label="بهترین روز فروش" value={best ? dayLabel(best.date) : '—'} unit={best ? `${rial(best.sum_rial_vat)} ریال` : ''} icon={Award} tone="amber" />
          </div>

          {/* Bento Row: Daily Sales Area Chart (8 cols) + Share Donut (4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch w-full">
            <div className="lg:col-span-8 rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h2 className="text-base font-bold text-[#1D1D1F]">روند روزانه فروش</h2>
                  <p className="text-xs text-[#86868B] mt-0.5">فروش ناخالص روزانه (Rial+Vat) · میلیارد ریال</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#0071E3]/10 text-[#0071E3]">
                  Rial+Vat
                </span>
              </div>
              <div className="h-72 w-full mt-2" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={d} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="appleDailySales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0071E3" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#0071E3" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#E5E5EA" strokeDasharray="3 3" />
                    <XAxis dataKey="date" reversed tickFormatter={dayLabel} tickLine={false} axisLine={false} minTickGap={28} tick={{ fill: '#86868B', fontSize: 12 }} />
                    <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={55} tick={{ fill: '#86868B', fontSize: 12 }} />
                    <Tooltip
                      content={<ChartTip labelFn={dayLabel} unit="میلیارد ریال" />}
                    />
                    <Area
                      type="monotone"
                      dataKey="gross"
                      name="فروش ناخالص"
                      stroke="#0071E3"
                      strokeWidth={2.5}
                      fill="url(#appleDailySales)"
                      activeDot={{ r: 6, fill: '#FFFFFF', stroke: '#0071E3', strokeWidth: 2.5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-4">
              <SharePie p={p} defaultBy="branch" />
            </div>
          </div>

          {/* Active Customers Daily Chart */}
          <div className="rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-[#1D1D1F]">تعداد مشتری فعال روزانه</h2>
                <p className="text-xs text-[#86868B] mt-0.5">مشتریان یکتا با ثبت خرید در هر روز</p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#34C759]/10 text-[#34C759]">
                مشتری یکتا
              </span>
            </div>
            <div className="h-64 w-full mt-2" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={d} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="appleDailyCustomers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34C759" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#34C759" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#E5E5EA" strokeDasharray="3 3" />
                  <XAxis dataKey="date" reversed tickFormatter={dayLabel} tickLine={false} axisLine={false} minTickGap={28} tick={{ fill: '#86868B', fontSize: 12 }} />
                  <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={55} tick={{ fill: '#86868B', fontSize: 12 }} />
                  <Tooltip
                    content={<ChartTip labelFn={dayLabel} unit="مشتری" />}
                  />
                  <Area
                    type="monotone"
                    dataKey="customers"
                    name="مشتری فعال"
                    stroke="#34C759"
                    strokeWidth={2.5}
                    fill="url(#appleDailyCustomers)"
                    activeDot={{ r: 6, fill: '#FFFFFF', stroke: '#34C759', strokeWidth: 2.5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )
    }}</Status>
  )
}

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

const DIM_LABELS = { brand: 'برند', group: 'لاین', product: 'کالا' }

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
                  by === k ? 'bg-[#0071E3] text-white shadow-sm' : 'text-[#1D1D1F] hover:bg-black/[0.05]'
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
        <div className="rounded-[22px] bg-blue-500/5 border border-blue-500/15 p-3.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setSel(null)}
              className="px-3.5 py-1.5 rounded-xl bg-white border border-black/10 text-xs font-bold text-[#1D1D1F] hover:bg-black/[0.03] transition-all shadow-sm"
            >
              ← بازگشت به همهٔ {DIM_LABELS[sel.by]}‌ها
            </button>
            <span className="text-xs font-extrabold text-[#0071E3]">
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
                      activeChild === k ? 'bg-[#0071E3] text-white' : 'text-[#1D1D1F] hover:bg-black/[0.04]'
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
              className="px-3.5 py-1.5 rounded-xl bg-[#0071E3] text-white text-xs font-bold hover:bg-[#0077ED] transition-all shadow-sm"
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
                        <stop offset="0%" stopColor="#0071E3" />
                        <stop offset="100%" stopColor="#42A1EC" />
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

export const BranchRegionPage = ({ p, openProfile }) => (
  <BreakdownPage p={p} defaultBy="branch" title="فروش" labelHead="مورد" openProfile={openProfile}
    options={[['branch', 'شعبه'], ['region', 'منطقه'], ['state', 'منطقه شهرداری'], ['city', 'شهر'], ['visitor', 'ویزیتور'], ['grade', 'گرید مشتری']]} />
)

export const ProductBrandPage = ({ p, openProfile }) => (
  <BreakdownPage p={p} defaultBy="brand" title="فروش" labelHead="مورد" openProfile={openProfile} drill={{ brand: ['group', 'product'], group: ['product', 'brand'] }}
    options={[['brand', 'برند'], ['product', 'کالا'], ['group', 'لاین'], ['sales_type', 'نوع فروش']]} />
)

/* ---------- پارتو (Apple Bento Design) ---------- */
const PARETO_NAMES = { customer: 'مشتری', product: 'کالا', visitor: 'ویزیتور', branch: 'شعبه', day: 'روز' }

export function ParetoPage({ p, openCustomer, openVisitor, openProfile }) {
  const [by, setBy] = useState('customer')
  const [th, setTh] = useState('0.8')
  const r = useApi('/pareto', { ...p, by, threshold: th })
  const rowOpen = by === 'customer' ? (x) => openCustomer(x.code) : by === 'visitor' ? (x) => openVisitor(x.code)
    : by === 'branch' ? (x) => openProfile('branch', x.code) : by === 'product' ? (x) => openProfile('product', x.name) : undefined
  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6">
      {/* Apple Floating Filter Bar */}
      <div className="rounded-[24px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-[#86868B]">بُعد پارتو:</span>
          <div className="flex items-center gap-1 p-1 bg-[#E8E8ED]/80 rounded-2xl flex-wrap">
            {Object.entries(PARETO_NAMES).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setBy(k)}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  by === k ? 'bg-[#0071E3] text-white shadow-sm' : 'text-[#1D1D1F] hover:bg-black/[0.05]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#86868B]">آستانه پارتو:</span>
          <div className="flex items-center gap-1 p-1 bg-[#E8E8ED]/80 rounded-2xl">
            {['0.5', '0.7', '0.8', '0.9'].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setTh(v)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  th === v ? 'bg-[#0071E3] text-white shadow-sm' : 'text-[#1D1D1F] hover:bg-black/[0.05]'
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
          {/* 4 Apple Bento KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
            <AppleKpiCard
              label="جمع فروش عادی"
              value={rial(j.total_rial)}
              unit="ریال · بدون پروموشن و مرجوعی"
              icon={CircleDollarSign}
              tone="blue"
            />
            <AppleKpiCard
              label={`تعداد کل (${PARETO_NAMES[by]})`}
              value={fa(j.count)}
              unit={`کل ردیف‌های ${PARETO_NAMES[by]}`}
              icon={Users}
              tone="violet"
            />
            <AppleKpiCard
              label={`تعداد پارتو (تا ${pct(j.threshold, 0)} فروش)`}
              value={fa(j.pareto_count)}
              unit={`${PARETO_NAMES[by]}‌های سازندهٔ هسته فروش`}
              icon={Award}
              tone="teal"
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
            subtitle={rowOpen ? `برای دیدن پروفایل، روی ${PARETO_NAMES[by]} کلیک کنید · ردیف‌های رنگی شامل قانون پارتو هستند` : 'فقط فروش عادی؛ پروموشن و مرجوعی حذف است'}
            badge={`${j.items?.length ?? 0} ردیف`}
          >
            <Table
              name={`پارتو-${by}`}
              rows={j.items}
              highlight={(x) => x.rank <= j.pareto_count}
              onRow={rowOpen}
              columns={[
                { label: 'رتبه', render: (x) => fa(x.rank), value: (x) => x.rank },
                ...(by === 'day' || by === 'branch' ? [] : [{ label: 'کد', render: (x) => x.code, value: (x) => String(x.code) }]),
                { label: PARETO_NAMES[by], render: (x) => x.name, value: (x) => String(x.name ?? '') },
                { label: 'فروش (ریال)', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial },
                { label: 'سهم فروش', render: (x) => pct(x.share, 2), value: (x) => x.share * 100, unit: '٪' },
                { label: 'سهم تجمعی', render: (x) => pct(x.cum_share, 1), value: (x) => x.cum_share * 100, unit: '٪' },
              ]}
            />
          </AppleCard>
        </>
      )}</Status>
    </div>
  )
}

/* ---------- مشتریان غیرفعال و بالقوه (Apple Bento Design) ---------- */
const INACTIVE_PAGE_SIZE = 50
const INACTIVE_DAYS = [['30', '۳۰ روز'], ['45', '۴۵ روز'], ['60', '۶۰ روز'], ['90', '۹۰ روز']]

function ProfileLink({ onClick, children }) {
  return (
    <button
      type="button"
      className="text-[#0071E3] hover:underline font-semibold text-right transition-colors"
      onClick={(e) => { e.stopPropagation(); onClick() }}
    >
      {children}
    </button>
  )
}

export function PotentialCustomersPage({ p, openCustomer, openVisitor }) {
  const [days, setDays] = useState('60')
  const { month: _m, start: _s, end: _e, v: _v, ...query } = p
  const r = useApi('/potential-customers', { ...query, days, v: p.v })
  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6">
      {/* Apple Floating Filter Bar */}
      <div className="rounded-[24px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-[#86868B]">بازهٔ بررسی:</span>
          <div className="flex items-center gap-1 p-1 bg-[#E8E8ED]/80 rounded-2xl flex-wrap">
            {INACTIVE_DAYS.map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setDays(v)}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  days === v ? 'bg-[#0071E3] text-white shadow-sm' : 'text-[#1D1D1F] hover:bg-black/[0.05]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Status state={r}>{(j) => {
        if (!j.available) return <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-xs text-amber-800">{j.reason}</div>
        const low = j.low_frequency
        const lapsed = j.lapsed
        const rows = (items) => items.map((x) => ({ ...x }))
        return (
          <>
            {/* 4 Apple Bento KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
              <AppleKpiCard
                label="مشتری در حال بازگشت"
                value={fa(lapsed.count)}
                unit={`خرید بین ${faDate(j.lapse_start.replace(/\//g, ''))} تا قبل از بازه`}
                icon={RotateCcw}
                tone="blue"
              />
              <AppleKpiCard
                label="فروش قبلی بازگشتی‌ها"
                value={rial(lapsed.sales_rial)}
                unit="ریال · فروش عادی"
                icon={CircleDollarSign}
                tone="teal"
              />
              <AppleKpiCard
                label="مشتری کم‌خرید فعال"
                value={fa(low.count)}
                unit={`تا ${fa(j.max_invoices)} فاکتور در بازهٔ بررسی`}
                icon={Users}
                tone="amber"
              />
              <AppleKpiCard
                label="فروش این گروه در بازه"
                value={rial(low.sales_rial)}
                unit="ریال · فروش عادی در بازه"
                icon={ShoppingBag}
                tone="violet"
              />
            </div>

            <AppleCard
              title="مشتریان در حال بازگشت"
              subtitle="آخرین خرید قبل از بازه، ولی در بازهٔ اخیر‌تر (پیش از این بازه) · با کلیک روی ردیف، پروفایل باز می‌شود"
              badge={`${lapsed.items?.length ?? 0} مشتری`}
            >
              <Table name="مشتریان-در-حال-بازگشت" rows={rows(lapsed.items)} pageSize={INACTIVE_PAGE_SIZE} onRow={(x) => openCustomer(x.code)} columns={[
                { label: 'رتبه', render: (x) => fa(x.rank), value: (x) => x.rank },
                { label: 'کد مشتری', render: (x) => x.code, value: (x) => String(x.code) },
                { label: 'مشتری', render: (x) => <ProfileLink onClick={() => openCustomer(x.code)}>{x.name ?? x.code}</ProfileLink>, value: (x) => String(x.name ?? '') },
                { label: 'ویزیتور', render: (x) => (x.visitor_code ? <ProfileLink onClick={() => openVisitor(x.visitor_code)}>{x.visitor ?? x.visitor_code}</ProfileLink> : '—'), value: (x) => String(x.visitor ?? '') },
                { label: 'شعبه', render: (x) => x.branch ?? '—', value: (x) => String(x.branch ?? '') },
                { label: 'آخرین خرید', render: (x) => x.last_purchase, value: (x) => x.last_purchase },
                { label: 'روز بدون خرید', render: (x) => fa(x.days_since), value: (x) => x.days_since },
                { label: 'تعداد فاکتور', render: (x) => fa(x.invoices), value: (x) => x.invoices },
                { label: 'فروش قبلی (ریال)', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial },
              ]} />
            </AppleCard>

            <AppleCard
              title="مشتریان کم‌خرید فعال"
              subtitle={`خرید در بازه با حداکثر ${fa(j.max_invoices)} فاکتور · با کلیک روی ردیف، پروفایل باز می‌شود`}
              badge={`${low.items?.length ?? 0} مشتری`}
            >
              <Table name="مشتریان-کم-خرید" rows={rows(low.items)} pageSize={INACTIVE_PAGE_SIZE} onRow={(x) => openCustomer(x.code)} columns={[
                { label: 'رتبه', render: (x) => fa(x.rank), value: (x) => x.rank },
                { label: 'کد مشتری', render: (x) => x.code, value: (x) => String(x.code) },
                { label: 'مشتری', render: (x) => <ProfileLink onClick={() => openCustomer(x.code)}>{x.name ?? x.code}</ProfileLink>, value: (x) => String(x.name ?? '') },
                { label: 'ویزیتور', render: (x) => (x.visitor_code ? <ProfileLink onClick={() => openVisitor(x.visitor_code)}>{x.visitor ?? x.visitor_code}</ProfileLink> : '—'), value: (x) => String(x.visitor ?? '') },
                { label: 'شعبه', render: (x) => x.branch ?? '—', value: (x) => String(x.branch ?? '') },
                { label: 'فاکتور در بازه', render: (x) => fa(x.window_invoices), value: (x) => x.window_invoices },
                { label: 'فروش در بازه (ریال)', render: (x) => rial(x.window_sales_rial), value: (x) => x.window_sales_rial },
                { label: 'آخرین خرید', render: (x) => x.last_purchase, value: (x) => x.last_purchase },
                { label: 'فروش کل (ریال)', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial },
              ]} />
            </AppleCard>
          </>
        )
      }}</Status>
    </div>
  )
}

export function InactiveCustomersPage({ p, openCustomer, openVisitor }) {
  const [days, setDays] = useState('60')
  const [selVisitor, setSelVisitor] = useState(null)
  const listRef = useRef(null)
  useEffect(() => {
    if (selVisitor !== null) listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selVisitor])
  const { month: _m, start: _s, end: _e, v: _v, ...query } = p
  const r = useApi('/inactive-customers', { ...query, days, v: p.v })
  const exportQs = new URLSearchParams(Object.entries({ ...query, days }).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v ? [[k, v]] : []))).toString()

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6">
      {/* Apple Floating Filter Bar */}
      <div className="rounded-[24px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-[#86868B]">بازه بدون خرید:</span>
          <div className="flex items-center gap-1 p-1 bg-[#E8E8ED]/80 rounded-2xl flex-wrap">
            {INACTIVE_DAYS.map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setDays(v)}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  days === v ? 'bg-[#0071E3] text-white shadow-sm' : 'text-[#1D1D1F] hover:bg-black/[0.05]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <a
          className="px-4 py-2 rounded-xl bg-white border border-black/10 text-xs font-bold text-[#1D1D1F] hover:bg-black/[0.03] transition-all shadow-sm flex items-center gap-1.5"
          href={`/api/inactive-customers/export?${exportQs}`}
          download
        >
          <span>📥 خروجی Excel</span>
        </a>
      </div>

      <Status state={r}>{(j) => {
        if (!j.available) return <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-xs text-amber-800">{j.reason}</div>
        return (
          <>
            {/* 4 Apple Bento KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
              <AppleKpiCard
                label="مشتری غیرفعال"
                value={fa(j.inactive_customers)}
                unit={`از ${fa(j.total_customers)} مشتری دارای سابقه`}
                icon={Users}
                tone="red"
              />
              <AppleKpiCard
                label="درصد غیرفعال"
                value={pct(j.inactive_percent, 1)}
                unit="از کل مشتریان دارای سابقه"
                icon={TrendingUp}
                tone="amber"
              />
              <AppleKpiCard
                label="فروش قبلی این مشتریان"
                value={rial(j.lost_sales_rial)}
                unit="ریال · فروش عادی تا قبل از بازه"
                icon={CircleDollarSign}
                tone="blue"
              />
              <AppleKpiCard
                label="بازهٔ بررسی"
                value={`${fa(j.days)} روز`}
                unit={`${faDate(j.window_start.replace(/\//g, ''))} تا ${faDate(j.as_of.replace(/\//g, ''))}`}
                icon={Calendar}
                tone="violet"
              />
            </div>

            {/* Visitor Breakdown Table Bento */}
            <AppleCard
              title="ویزیتورها با بیشترین مشتری غیرفعال"
              subtitle="ویزیتور = آخرین ویزیتور خرید مشتری · برای فیلتر مشتریان، روی تعداد کلیک کنید"
              badge={`${j.by_visitor?.length ?? 0} ویزیتور`}
            >
              <Table name="غیرفعال-ویزیتور" rows={j.by_visitor} pageSize={INACTIVE_PAGE_SIZE} onRow={(x) => x.code && openVisitor(x.code)} columns={[
                { label: 'کد', render: (x) => x.code ?? '—', value: (x) => String(x.code ?? '') },
                { label: 'ویزیتور', render: (x) => x.name ?? '—', value: (x) => String(x.name ?? '') },
                { label: 'مشتری غیرفعال', render: (x) => <ProfileLink onClick={() => setSelVisitor(x.code ?? '')}>{fa(x.customers)}</ProfileLink>, value: (x) => x.customers },
                { label: 'فروش قبلی (ریال)', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial },
              ]} />
            </AppleCard>

            {/* Selected Visitor Inactive List */}
            {selVisitor !== null && (() => {
              const v = j.by_visitor.find((x) => String(x.code ?? '') === selVisitor)
              if (!v) return null
              return (
                <div ref={listRef}>
                  <AppleCard
                    title={`مشتریان غیرفعال ویزیتور: ${v.name ?? v.code ?? ''}`}
                    subtitle={`${fa(v.customers)} مشتری · با کلیک روی ردیف، پروفایل مشتری باز می‌شود`}
                    badge="فیلتر ویزیتور"
                    action={
                      <button
                        type="button"
                        onClick={() => setSelVisitor(null)}
                        className="px-3 py-1 rounded-xl bg-black/[0.05] text-xs font-semibold hover:bg-black/[0.1] transition-colors"
                      >
                        بستن فیلتر ✕
                      </button>
                    }
                  >
                    <Table name={`غیرفعال-ویزیتور-${selVisitor || 'بدون-کد'}`} rows={v.items} pageSize={INACTIVE_PAGE_SIZE} onRow={(x) => openCustomer(x.code)} columns={[
                      { label: 'رتبه', render: (x) => fa(x.rank), value: (x) => x.rank },
                      { label: 'کد مشتری', render: (x) => x.code, value: (x) => String(x.code) },
                      { label: 'مشتری', render: (x) => <ProfileLink onClick={() => openCustomer(x.code)}>{x.name ?? x.code}</ProfileLink>, value: (x) => String(x.name ?? '') },
                      { label: 'شعبه', render: (x) => x.branch ?? '—', value: (x) => String(x.branch ?? '') },
                      { label: 'روز بدون خرید', render: (x) => fa(x.days_since), value: (x) => x.days_since },
                      { label: 'تعداد فاکتور', render: (x) => fa(x.invoices), value: (x) => x.invoices },
                      { label: 'فروش قبلی (ریال)', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial },
                    ]} />
                  </AppleCard>
                </div>
              )
            })()}

            {/* Master Inactive Customers Table Bento */}
            <AppleCard
              title="فهرست جامع مشتریان غیرفعال"
              subtitle="مرتب‌شده بر اساس بیشترین فروش قبلی · با کلیک روی ردیف، پروفایل مشتری باز می‌شود"
              badge={`${j.items?.length ?? 0} مشتری`}
            >
              <Table name={`مشتریان-غیرفعال-${days}روز`} rows={j.items} pageSize={INACTIVE_PAGE_SIZE} onRow={(x) => openCustomer(x.code)} columns={[
                { label: 'رتبه', render: (x) => fa(x.rank), value: (x) => x.rank },
                { label: 'کد مشتری', render: (x) => x.code, value: (x) => String(x.code) },
                { label: 'مشتری', render: (x) => <ProfileLink onClick={() => openCustomer(x.code)}>{x.name ?? x.code}</ProfileLink>, value: (x) => String(x.name ?? '') },
                { label: 'ویزیتور', render: (x) => (x.visitor_code ? <ProfileLink onClick={() => openVisitor(x.visitor_code)}>{x.visitor ?? x.visitor_code}</ProfileLink> : '—'), value: (x) => String(x.visitor ?? '') },
                { label: 'شعبه', render: (x) => x.branch ?? '—', value: (x) => String(x.branch ?? '') },
                { label: 'شهر', render: (x) => x.city ?? '—', value: (x) => String(x.city ?? '') },
                { label: 'گرید', render: (x) => x.grade ?? '—', value: (x) => String(x.grade ?? '') },
                { label: 'آخرین خرید', render: (x) => x.last_purchase, value: (x) => x.last_purchase },
                { label: 'روز بدون خرید', render: (x) => fa(x.days_since), value: (x) => x.days_since },
                { label: 'تعداد فاکتور', render: (x) => fa(x.invoices), value: (x) => x.invoices },
                { label: 'فروش قبلی (ریال)', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial },
                { label: 'میانگین فاکتور (ریال)', render: (x) => (x.avg_invoice_rial == null ? '—' : rial(x.avg_invoice_rial)), value: (x) => x.avg_invoice_rial },
                { label: 'سهم از فروش قبلی', render: (x) => pct(x.share, 1), value: (x) => x.share * 100, unit: '٪' },
              ]} />
            </AppleCard>
          </>
        )
      }}</Status>
    </div>
  )
}

/* ---------- تحلیل فاکتور (Apple Bento Design) ---------- */
function InvoiceCompare({ p }) {
  const r = useApi('/invoice-compare', { ...p, day: p.end ? p.end.replaceAll('-', '/') : undefined })
  const row = (label, key, fmt) => {
    const ch = r.data?.change?.[key]
    return (
      <tr key={key} className="border-b border-black/[0.04] hover:bg-black/[0.02] transition-colors">
        <td className="py-3 px-4 text-xs font-semibold text-[#1D1D1F]">{label}</td>
        <td className="py-3 px-4 text-xs text-[#1D1D1F] tabular-nums font-bold">{r.data ? fmt(r.data.current[key]) : '—'}</td>
        <td className="py-3 px-4 text-xs text-[#86868B] tabular-nums">{r.data ? fmt(r.data.previous[key]) : '—'}</td>
        <td className="py-3 px-4 text-xs font-bold tabular-nums">
          {ch == null ? (
            '—'
          ) : (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              ch >= 0 ? 'bg-emerald-500/10 text-emerald-700' : 'bg-rose-500/10 text-rose-700'
            }`}>
              {ch >= 0 ? '+' : ''}{pct(ch, 1)}
            </span>
          )}
        </td>
      </tr>
    )
  }
  if (!r.data || !r.data.available) return null
  return (
    <AppleCard
      title="مقایسه با همان روز ماه قبل"
      subtitle={`از ابتدای ماه تا ${r.data.day} در برابر همان بازه در ماه قبل`}
      badge={`این ماه: ${fa(r.data.current.to % 100)} روز`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-black/[0.06] text-xs text-[#86868B]">
              <th className="py-2.5 px-4 font-semibold">شاخص</th>
              <th className="py-2.5 px-4 font-semibold">{`این ماه (${fa(r.data.current.to % 100)} روز)`}</th>
              <th className="py-2.5 px-4 font-semibold">ماه قبل</th>
              <th className="py-2.5 px-4 font-semibold">تغییر</th>
            </tr>
          </thead>
          <tbody>
            {row('تعداد فاکتور', 'invoices', (v) => fa(v))}
            {row('جمع فروش فاکتورها (ریال)', 'sales_rial', (v) => rial(v))}
            {row('میانگین هر فاکتور (ریال)', 'avg_invoice_rial', (v) => rial(v))}
          </tbody>
        </table>
      </div>
    </AppleCard>
  )
}

export function TicketsPage({ isAdmin }) {
  const [openId, setOpenId] = useState(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [reply, setReply] = useState('')
  const [err, setErr] = useState('')
  const [tick, setTick] = useState(0)
  const list = useApi('/tickets', { v: tick })
  const one = useApi(openId ? `/tickets/${openId}` : null, { v: tick })
  const refresh = () => setTick((n) => n + 1)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 20000)
    return () => clearInterval(t)
  }, [])
  const setStatus = async (action) => {
    setErr('')
    try {
      await postJson(`/tickets/${openId}/status`, { action })
      refresh()
    } catch (ex) { setErr(ex?.message || 'تغییر وضعیت انجام نشد') }
  }
  const send = async (e) => {
    e.preventDefault()
    setErr('')
    try {
      await postJson('/tickets', { subject: subject.trim(), body: body.trim() })
      setSubject(''); setBody(''); refresh()
    } catch (ex) { setErr(ex?.message || 'ثبت تیکت انجام نشد') }
  }
  const sendReply = async (e) => {
    e.preventDefault()
    setErr('')
    try {
      await postJson(`/tickets/${openId}/messages`, { body: reply.trim() })
      setReply(''); refresh()
    } catch (ex) { setErr(ex?.message || 'ارسال پاسخ انجام نشد') }
  }
  const statusLabel = { open: 'باز', answered: 'پاسخ داده شده', closed: 'بسته' }
  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6">
      {err && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 px-5 py-3 text-sm flex items-center justify-between">
          <span>{err}</span>
          <button type="button" onClick={() => setErr('')} className="text-xs font-semibold hover:underline">بستن</button>
        </div>
      )}

      {/* New Ticket Form (User view) */}
      {!isAdmin && (
        <AppleCard
          title="ثبت تیکت جدید"
          subtitle="پیام و درخواست پشتیبانی شما برای مدیر سامانه ارسال می‌شود"
          badge="پشتیبانی"
        >
          <form className="space-y-4" onSubmit={send}>
            <div>
              <label className="block text-xs font-semibold text-[#86868B] mb-1.5">موضوع تیکت</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="عنوان مشکل یا پرسش خود را بنویسید..."
                minLength={3}
                maxLength={120}
                required
                className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-2xl px-4 py-3 text-sm text-[#1D1D1F] placeholder-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/25 focus:border-[#0071E3] transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#86868B] mb-1.5">شرح درخواست یا مشکل</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="توضیحات کامل درخواست خود را بنویسید..."
                maxLength={4000}
                rows={4}
                required
                className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-2xl p-4 text-sm text-[#1D1D1F] placeholder-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/25 focus:border-[#0071E3] transition-all resize-y"
              />
            </div>
            <div className="flex justify-start">
              <button
                type="submit"
                className="inline-flex items-center gap-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-sm font-semibold px-6 py-2.5 rounded-2xl shadow-sm shadow-blue-500/25 active:scale-[0.98] transition-all"
              >
                <Send size={15} />
                <span>ثبت تیکت</span>
              </button>
            </div>
          </form>
        </AppleCard>
      )}

      {/* Bento Grid: Master-Detail Tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start w-full">
        {/* Ticket List */}
        <div className={`${openId ? 'lg:col-span-5' : 'lg:col-span-12'} w-full`}>
          <AppleCard
            title={isAdmin ? 'همه تیکت‌ها' : 'تیکت‌های من'}
            subtitle="فهرست تیکت‌های پشتیبانی"
            badge={list.data ? `${fa(list.data.tickets.length)} تیکت` : 'در حال بارگذاری'}
          >
            {!list.data && !list.error && <p className="text-sm text-[#86868B] py-6 text-center">در حال بارگذاری…</p>}
            {list.data && list.data.tickets.length === 0 && (
              <p className="text-sm text-[#86868B] py-8 text-center">تیکتی ثبت نشده است.</p>
            )}
            {list.data && list.data.tickets.length > 0 && (
              <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                {list.data.tickets.map((t) => {
                  const active = openId === t.id
                  return (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setOpenId(t.id)}
                      className={`w-full text-right p-4 rounded-2xl border transition-all flex flex-col gap-2 ${
                        active
                          ? 'bg-[#0071E3]/10 border-[#0071E3]/30 shadow-sm'
                          : 'bg-white/60 hover:bg-white border-black/[0.04] hover:border-black/[0.08]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-[#1D1D1F] truncate">{t.subject}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
                          t.status === 'open'
                            ? 'bg-[#0071E3]/15 text-[#0071E3]'
                            : t.status === 'answered'
                            ? 'bg-emerald-500/15 text-emerald-700'
                            : 'bg-black/[0.06] text-[#86868B]'
                        }`}>
                          {statusLabel[t.status] ?? t.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-[#86868B]">
                        <span>{isAdmin ? `${t.owner ?? ''} · ` : ''}{t.updated_at?.slice(0, 16).replace('T', ' ')}</span>
                        {active && <span className="text-[#0071E3] font-medium text-[11px]">انتخاب‌شده</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </AppleCard>
        </div>

        {/* Selected Ticket Conversation Thread */}
        {openId && one.data && (
          <div className="lg:col-span-7 w-full">
            <AppleCard
              title={`تیکت: ${one.data.subject}`}
              subtitle={isAdmin ? `مالک: ${one.data.owner ?? ''}` : 'گفت‌وگو با پشتیبانی'}
              badge={statusLabel[one.data.status] ?? one.data.status}
              action={
                isAdmin && (
                  <div className="flex items-center gap-2">
                    {one.data.status === 'closed' ? (
                      <button
                        type="button"
                        onClick={() => setStatus('reopen')}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 transition-colors"
                      >
                        باز کردن تیکت
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setStatus('close')}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 transition-colors"
                      >
                        بستن تیکت
                      </button>
                    )}
                  </div>
                )
              }
            >
              {isAdmin && (
                <div className="mb-4 text-xs text-[#86868B] bg-[#F5F5F7] px-3.5 py-2 rounded-xl border border-black/[0.04]">
                  تیکت‌های بسته‌شده پس از ۷ روز از سرور حذف می‌شوند.
                </div>
              )}

              {/* Message thread */}
              <div className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1 mb-5">
                {one.data.messages.map((m, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-2xl border text-right space-y-1.5 ${
                      m.is_admin
                        ? 'bg-[#0071E3]/10 border-[#0071E3]/20 mr-4'
                        : 'bg-[#F5F5F7] border-black/[0.04] ml-4'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-[#86868B]">
                      <span className="font-semibold text-[#1D1D1F]">
                        {m.is_admin ? '🛡️ پشتیبانی' : `👤 ${m.author}`}
                      </span>
                      <span dir="ltr">{m.created_at?.slice(0, 16).replace('T', ' ')}</span>
                    </div>
                    <p className="text-sm text-[#1D1D1F] leading-relaxed whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))}
              </div>

              {/* Reply box */}
              {one.data.status === 'closed' && !isAdmin ? (
                <div className="p-4 rounded-2xl bg-black/[0.04] text-center text-xs text-[#86868B]">
                  این تیکت بسته شده است. برای پیگیری، تیکت جدید ثبت کنید.
                </div>
              ) : (
                <form className="space-y-3 pt-2 border-t border-black/[0.05]" onSubmit={sendReply}>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="پاسخ خود را بنویسید..."
                    maxLength={4000}
                    rows={3}
                    required
                    className="w-full bg-[#F5F5F7] border border-black/[0.06] rounded-2xl p-4 text-sm text-[#1D1D1F] placeholder-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/25 focus:border-[#0071E3] transition-all resize-y"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-sm shadow-blue-500/25 active:scale-[0.98] transition-all"
                    >
                      <Send size={14} />
                      <span>ارسال پاسخ</span>
                    </button>
                  </div>
                </form>
              )}
            </AppleCard>
          </div>
        )}
      </div>
    </div>
  )
}

function InvoiceLinesSection({ p }) {
  const r = useApi('/invoice-lines', p)
  return (
    <Status state={r}>{(j) => {
      const buckets = j.buckets.map((b) => ({ ...b, label: b.open_ended ? `${fa(b.lines)}+` : fa(b.lines) }))
      return (
        <div className="space-y-6">
          {/* 3 Apple Bento KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            <AppleKpiCard label="تعداد سطر فاکتور" value={fa(j.total_lines)} unit="سطر · بدون پروموشن و مرجوعی" icon={FileText} tone="violet" />
            <AppleKpiCard label="میانگین سطر هر فاکتور" value={fa2(j.avg_lines_per_invoice)} unit="سطر در فاکتور" icon={BarChart3} tone="teal" />
            <AppleKpiCard label="میانگین ریال هر سطر" value={j.avg_rial_per_line == null ? '—' : rial(j.avg_rial_per_line)} unit="ریال" icon={CircleDollarSign} tone="amber" />
          </div>

          {/* Distribution Chart Bento */}
          <AppleCard
            title="توزیع فاکتورها بر حسب تعداد سطر"
            subtitle="محور افقی: تعداد سطر در فاکتور · عمودی: تعداد فاکتور"
            badge="توزیع سطر"
          >
            <div className="h-72 w-full mt-2" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buckets} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="appleLinesBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF9500" />
                      <stop offset="100%" stopColor="#FFB340" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#E5E5EA" strokeDasharray="3 3" />
                  <XAxis dataKey="label" reversed tickLine={false} axisLine={false} tick={{ fill: '#86868B', fontSize: 12 }} />
                  <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={55} tick={{ fill: '#86868B', fontSize: 12 }} />
                  <Tooltip content={<ChartTip unit="فاکتور" />} />
                  <Bar dataKey="invoices" name="تعداد فاکتور" fill="url(#appleLinesBar)" radius={[8, 8, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </AppleCard>

          {/* Tables Row: Line Distribution Table + Monthly Trend Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full items-start">
            <AppleCard title="جدول سطر فاکتور" subtitle="فقط فروش عادی؛ آخرین ردیف یعنی ۱۰ سطر یا بیشتر">
              <Table name="توزیع-سطر-فاکتور" rows={buckets} columns={[
                { label: 'تعداد سطر در فاکتور', render: (b) => b.label, value: (b) => b.lines },
                { label: 'تعداد فاکتور', render: (b) => fa(b.invoices), value: (b) => b.invoices },
                { label: 'جمع سطرها', render: (b) => fa(b.line_count), value: (b) => b.line_count },
                { label: 'سهم از فاکتورها', render: (b) => pct(b.invoice_share, 1), value: (b) => b.invoice_share * 100, unit: '٪' },
                { label: 'سهم تجمعی فاکتور', render: (b) => pct(b.cum_invoice_share, 1), value: (b) => b.cum_invoice_share * 100, unit: '٪' },
              ]} />
            </AppleCard>

            <AppleCard title="روند ماهانه سطر فاکتور" subtitle="میانگین سطر هر فاکتور در هر ماه">
              <Table name="سطر-فاکتور-ماهانه" rows={j.months} columns={[
                { label: 'ماه', render: (m) => monthLabel(m.year_month), value: (m) => m.year_month },
                { label: 'تعداد فاکتور', render: (m) => fa(m.invoices), value: (m) => m.invoices },
                { label: 'تعداد سطر', render: (m) => fa(m.lines), value: (m) => m.lines },
                { label: 'میانگین سطر هر فاکتور', render: (m) => fa2(m.avg_lines_per_invoice), value: (m) => m.avg_lines_per_invoice ?? 0 },
                { label: 'فروش عادی (ریال)', render: (m) => rial(m.sales_rial), value: (m) => m.sales_rial },
              ]} />
            </AppleCard>
          </div>
        </div>
      )
    }}</Status>
  )
}

export function InvoicePage({ p }) {
  const [step, setStep] = useState('10000000')
  const r = useApi('/invoice-bands', { ...p, step })
  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6">
      <Status state={r}>{(j) => {
        return (
          <>
            {/* Top 3 Apple Bento KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
              <AppleKpiCard label="تعداد فاکتور فروش" value={fa(j.total_invoices)} unit="فقره" icon={FileText} tone="blue" />
              <AppleKpiCard label="جمع فروش فاکتورها" value={rial(j.total_rial)} unit="ریال" icon={CircleDollarSign} tone="teal" />
              <AppleKpiCard label="میانگین هر فاکتور" value={j.total_invoices ? rial(j.total_rial / j.total_invoices) : '—'} unit="ریال" icon={TrendingUp} tone="amber" />
            </div>

            <InvoiceCompare p={p} />
            <InvoiceLinesSection p={p} />

            {/* Invoice Bands Section */}
            <AppleCard
              title="جدول بازه‌های فاکتور"
              subtitle="فقط فروش عادی؛ فاکتورهای با جمع منفی حذف است"
              badge="بازه مبالغ"
              action={
                <div className="flex items-center gap-1.5 p-1 bg-[#E8E8ED]/80 rounded-2xl flex-wrap">
                  <span className="text-[11px] text-[#86868B] px-2 font-medium">عرض بازه:</span>
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
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        step === v ? 'bg-[#0071E3] text-white shadow-sm' : 'text-[#1D1D1F] hover:bg-black/[0.05]'
                      }`}
                    >
                      {l} ریال
                    </button>
                  ))}
                </div>
              }
            >
              <Table name="بازه-فاکتور" rows={j.bands} pageSize={50} columns={[
                { label: 'از (ریال)', render: (b) => rial(b.from_rial), value: (b) => b.from_rial },
                { label: 'تا (ریال)', render: (b) => rial(b.to_rial), value: (b) => b.to_rial },
                { label: 'تعداد فاکتور', render: (b) => fa(b.invoices), value: (b) => b.invoices },
                { label: 'سهم از فاکتورها', render: (b) => pct(b.invoice_share, 1), value: (b) => b.invoice_share * 100, unit: '٪' },
                { label: 'سهم تجمعی فاکتور', render: (b) => pct(b.cum_invoice_share, 1), value: (b) => b.cum_invoice_share * 100, unit: '٪' },
                { label: 'فروش (ریال)', render: (b) => rial(b.sales_rial), value: (b) => b.sales_rial },
                { label: 'سهم از فروش', render: (b) => pct(b.sales_share, 1), value: (b) => b.sales_share * 100, unit: '٪' },
                { label: 'سهم تجمعی فروش', render: (b) => pct(b.cum_sales_share, 1), value: (b) => b.cum_sales_share * 100, unit: '٪' },
              ]} />
            </AppleCard>
          </>
        )
      }}</Status>
    </div>
  )
}

/* ---------- پروفایل مشتری (Apple Bento Design) ---------- */
export function CustomerPage({ core, code, setCode, openReturns }) {
  const [draft, setDraft] = useState(code ?? '')
  const reasonFilter = new URLSearchParams(location.hash.split('?')[1] || '').get('reason') || undefined
  const r = useApi(`/customer/${encodeURIComponent(code ?? '')}`, { core, reason: reasonFilter }, Boolean(code))
  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6">
      {/* Apple Floating Glass Search Bar */}
      <form
        className="rounded-[24px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-4 flex items-center justify-between gap-4 flex-wrap"
        onSubmit={(e) => { e.preventDefault(); setCode(draft.trim()) }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-[#86868B]">کد مشتری:</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="مثلاً Gol100101"
            dir="ltr"
            className="bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-4 py-2 text-sm text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/25 focus:border-[#0071E3] transition-all w-60"
          />
          <button
            type="submit"
            className="bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-sm shadow-blue-500/25 active:scale-[0.98] transition-all"
          >
            نمایش پروفایل
          </button>
        </div>
        {code && (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#0071E3]/10 text-[#0071E3]" dir="ltr">
            کد فعال: {code}
          </span>
        )}
      </form>

      {!code && (
        <AppleCard>
          <div className="text-center py-10 space-y-2">
            <UserRound className="mx-auto text-[#86868B]" size={36} />
            <h3 className="text-sm font-bold text-[#1D1D1F]">کد مشتری را وارد کنید</h3>
            <p className="text-xs text-[#86868B]">یا از جدول پارتو یک مشتری را انتخاب نمایید تا پروفایل کامل نمایش داده شود.</p>
          </div>
        </AppleCard>
      )}

      {code && r.error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 px-5 py-4 text-sm font-semibold text-center">
          مشتری با این کد پیدا نشد.
        </div>
      )}

      {code && !r.error && (
        <Status state={r}>{(j) => {
          const total = j.months.reduce((s, m) => s + m.sales_rial, 0)
          const invoices = j.months.reduce((s, m) => s + m.invoices, 0)
          const d = j.months.map((m) => ({ ...m, gross: billions(m.sales_rial) }))
          return (
            <div className="space-y-6">
              {/* Customer Header Bento Widget */}
              <AppleCard title={j.name ?? 'اطلاعات مشتری'} subtitle={j.sales_point ?? ''} badge={`گرید ${j.grade ?? '—'}`}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-2">
                  <div className="bg-[#F5F5F7] p-3.5 rounded-2xl border border-black/[0.03]">
                    <span className="text-[11px] text-[#86868B] block mb-1">نام مشتری</span>
                    <b className="text-sm font-bold text-[#1D1D1F] truncate block">{j.name ?? '—'}</b>
                  </div>
                  <div className="bg-[#F5F5F7] p-3.5 rounded-2xl border border-black/[0.03]">
                    <span className="text-[11px] text-[#86868B] block mb-1">نام فروشگاه</span>
                    <b className="text-sm font-bold text-[#1D1D1F] truncate block">{j.sales_point ?? '—'}</b>
                  </div>
                  <div className="bg-[#F5F5F7] p-3.5 rounded-2xl border border-black/[0.03]">
                    <span className="text-[11px] text-[#86868B] block mb-1">شعبه</span>
                    <b className="text-sm font-bold text-[#1D1D1F] truncate block">{j.branch ?? '—'}</b>
                  </div>
                  <div className="bg-[#F5F5F7] p-3.5 rounded-2xl border border-black/[0.03]">
                    <span className="text-[11px] text-[#86868B] block mb-1">ویزیتور</span>
                    <b className="text-sm font-bold text-[#1D1D1F] truncate block">{j.visitor ?? '—'}</b>
                  </div>
                  <div className="bg-[#F5F5F7] p-3.5 rounded-2xl border border-black/[0.03]">
                    <span className="text-[11px] text-[#86868B] block mb-1">گرید</span>
                    <b className="text-sm font-bold text-[#1D1D1F] truncate block">{j.grade ?? '—'}</b>
                  </div>
                  <div className="bg-[#F5F5F7] p-3.5 rounded-2xl border border-black/[0.03]">
                    <span className="text-[11px] text-[#86868B] block mb-1">منطقه / شهر</span>
                    <b className="text-sm font-bold text-[#1D1D1F] truncate block">{[j.region, j.city].filter(Boolean).join(' / ') || '—'}</b>
                  </div>
                </div>
              </AppleCard>

              {/* 3 Apple Bento KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                <AppleKpiCard label="جمع فروش (ریال)" value={rial(total)} unit="فروش عادی" icon={CircleDollarSign} tone="blue" />
                <AppleKpiCard label="تعداد فاکتور" value={fa(invoices)} unit="فقره" icon={FileText} tone="violet" />
                <AppleKpiCard label="تاریخ آخرین خرید" value={j.last_purchase ?? '—'} unit="" icon={Calendar} tone="teal" />
              </div>

              {/* Monthly Pattern Bar Chart Bento */}
              <AppleCard
                title="الگوی ماهانه خرید مشتری"
                subtitle="فروش ناخالص به میلیارد ریال"
                badge="روند ماهانه"
              >
                <div className="h-72 w-full mt-2" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="appleCustMonthly" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0071E3" />
                          <stop offset="100%" stopColor="#42A1EC" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#E5E5EA" strokeDasharray="3 3" />
                      <XAxis dataKey="year_month" reversed tickFormatter={monthName} tickLine={false} axisLine={false} tick={{ fill: '#86868B', fontSize: 12 }} />
                      <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={55} tick={{ fill: '#86868B', fontSize: 12 }} />
                      <Tooltip content={<ChartTip labelFn={monthName} unit="میلیارد ریال" />} />
                      <Bar dataKey="gross" name="فروش" fill="url(#appleCustMonthly)" radius={[8, 8, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </AppleCard>

              {/* Products & Brands Bento Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full items-start">
                <AppleCard title="کالاهای خریداری‌شده" subtitle="۱۵ کالای برتر بر اساس مبلغ فروش">
                  <Table name="کالاهای-مشتری" rows={j.products} columns={[
                    { label: 'کالا', render: (x) => x.name, value: (x) => String(x.name ?? '') },
                    { label: 'فروش (ریال)', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial },
                    { label: 'تعداد', render: (x) => fa(x.qty), value: (x) => x.qty }
                  ]} />
                </AppleCard>

                <AppleCard title="برندها" subtitle="مبلغ فروش تفکیک‌شده به برند">
                  <Table name="برندهای-مشتری" rows={j.brands} columns={[
                    { label: 'برند', render: (x) => x.name, value: (x) => String(x.name ?? '') },
                    { label: 'فروش (ریال)', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial }
                  ]} />
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
const PROFILE_SPLITS = { branch: 'شعبه', brand: 'برند', group: 'لاین', grade: 'گرید مشتری', sales_type: 'کانال فروش', region: 'منطقه' }

export function GrowthPage({ p }) {
  const [kind, setKind] = useState('month')
  const { month: _month, start: _start, end: _end, ...query } = p
  const r = useApi('/growth', { ...query, kind })
  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6">
      <Status state={r}>{(j) => {
        const periods = j.periods ?? []
        const last = periods[periods.length - 1]
        const chart = periods.map((x) => ({ label: x.label, current: billions(x.sales_rial), previous: x.compare ? billions(x.compare.sales_rial) : null }))
        return (
          <>
            {/* Apple Floating Control Bar */}
            <div className="rounded-[24px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold text-[#86868B]">نوع دوره تحلیلی:</span>
                <div className="flex items-center gap-1 p-1 bg-[#E8E8ED]/80 rounded-2xl flex-wrap">
                  {Object.entries(GROWTH_LABELS).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        kind === k ? 'bg-[#0071E3] text-white shadow-sm' : 'text-[#1D1D1F] hover:bg-black/[0.05]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {j.last_date && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#0071E3]/10 text-[#0071E3]">
                  داده تا {j.last_date}
                </span>
              )}
            </div>

            {!periods.length ? (
              <AppleCard>
                <div className="text-center py-12 text-[#86868B] text-sm">دوره‌ای برای مقایسه وجود ندارد.</div>
              </AppleCard>
            ) : (
              <>
                {/* 4 Top KPI Cards from Latest Period */}
                {last && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
                    <AppleKpiCard
                      label={`فروش این دوره (${last.label})`}
                      value={rial(last.sales_rial)}
                      unit="ریال · فروش عادی"
                      icon={CircleDollarSign}
                      tone="blue"
                    />
                    <AppleKpiCard
                      label={`فروش دوره قبل (${last.compare?.label ?? '—'})`}
                      value={last.compare ? rial(last.compare.sales_rial) : '—'}
                      unit="ریال · دوره مقایسه"
                      icon={RotateCcw}
                      tone="violet"
                    />
                    <AppleKpiCard
                      label="درصد رشد فروش"
                      value={last.compare?.growth?.sales_rial == null ? '—' : pct(last.compare.growth.sales_rial, 1)}
                      unit={last.compare ? (last.compare.delta.sales_rial >= 0 ? `+${rial(last.compare.delta.sales_rial)} ریال` : `${rial(last.compare.delta.sales_rial)} ریال`) : ''}
                      icon={TrendingUp}
                      tone={(last.compare?.growth?.sales_rial ?? 0) >= 0 ? 'teal' : 'red'}
                    />
                    <AppleKpiCard
                      label="فاکتور و مشتریان"
                      value={fa(last.invoice_count)}
                      unit={`فقره فاکتور · ${fa(last.active_customers)} مشتری فعال`}
                      icon={FileText}
                      tone="amber"
                    />
                  </div>
                )}

                {/* Growth Trend Comparison Bar Chart Bento */}
                <AppleCard
                  title={`روند ${GROWTH_LABELS[kind]} فروش`}
                  subtitle="مقایسه فروش عادی این دوره در برابر دورهٔ قبل · میلیارد ریال"
                  badge={GROWTH_LABELS[kind]}
                >
                  <div className="h-80 w-full mt-2" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chart} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barGap={6}>
                        <defs>
                          <linearGradient id="appleGrowthCurrent" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0071E3" />
                            <stop offset="100%" stopColor="#42A1EC" />
                          </linearGradient>
                          <linearGradient id="appleGrowthPrev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#34C759" />
                            <stop offset="100%" stopColor="#30D158" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="#E5E5EA" strokeDasharray="3 3" />
                        <XAxis dataKey="label" reversed tickLine={false} axisLine={false} tick={{ fill: '#86868B', fontSize: 12 }} />
                        <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={55} tick={{ fill: '#86868B', fontSize: 12 }} />
                        <Tooltip content={<ChartTip unit="میلیارد ریال" />} />
                        <Legend />
                        <Bar dataKey="current" name="این دوره" fill="url(#appleGrowthCurrent)" radius={[8, 8, 0, 0]} maxBarSize={32} />
                        <Bar dataKey="previous" name="دورهٔ قبل" fill="url(#appleGrowthPrev)" radius={[8, 8, 0, 0]} maxBarSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </AppleCard>

                {/* Growth Table Bento */}
                <AppleCard
                  title="جدول رشد و افت"
                  subtitle="دورهٔ ناقص با هم‌بازهٔ قبلی مقایسه می‌شود · مبالغ به ریال"
                  badge={`${periods.length} دوره`}
                >
                  <Table name={`رشد-${kind}`} rows={periods} columns={[
                    { label: 'دوره', render: (x) => <b className="font-bold text-[#1D1D1F]">{x.label}{x.complete ? '' : ' (ناقص)'}</b>, value: (x) => x.key },
                    { label: 'بازه', render: (x) => <span className="text-xs text-[#86868B]">{x.start} تا {x.end}</span>, value: (x) => x.start },
                    {
                      label: 'وضعیت',
                      render: (x) => (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          x.complete ? 'bg-emerald-500/10 text-emerald-700' : x.full_coverage ? 'bg-amber-500/10 text-amber-700' : 'bg-black/[0.06] text-[#86868B]'
                        }`}>
                          {x.complete ? 'کامل' : x.full_coverage ? 'ناقص' : 'پوشش ناقص'}
                        </span>
                      ),
                      value: (x) => x.complete ? 2 : x.full_coverage ? 1 : 0
                    },
                    { label: 'فروش عادی', render: (x) => <span className="tabular-nums font-bold text-[#1D1D1F]">{rial(x.sales_rial)}</span>, value: (x) => x.sales_rial },
                    { label: 'ریال خالص', render: (x) => <span className="tabular-nums font-medium text-[#86868B]">{rial(x.net_rial)}</span>, value: (x) => x.net_rial },
                    { label: 'فاکتور', render: (x) => <span className="tabular-nums">{fa(x.invoice_count)}</span>, value: (x) => x.invoice_count },
                    { label: 'مشتری فعال', render: (x) => <span className="tabular-nums">{fa(x.active_customers)}</span>, value: (x) => x.active_customers },
                    { label: 'بازهٔ مقایسه', render: (x) => x.compare ? `${x.compare.label}: ${x.compare.start} تا ${x.compare.end}` : '—', value: (x) => x.compare?.start ?? '' },
                    {
                      label: 'رشد فروش',
                      render: (x) => {
                        const g = x.compare?.growth?.sales_rial
                        if (g == null) return '—'
                        return (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums ${
                            g >= 0 ? 'bg-emerald-500/10 text-emerald-700' : 'bg-rose-500/10 text-rose-700'
                          }`}>
                            {g >= 0 ? '+' : ''}{pct(g, 1)}
                          </span>
                        )
                      },
                      value: (x) => x.compare?.growth?.sales_rial ?? -Infinity,
                      unit: '٪'
                    },
                    {
                      label: 'اختلاف فروش',
                      render: (x) => {
                        if (!x.compare) return '—'
                        const delta = x.compare.delta.sales_rial
                        return (
                          <span className={`tabular-nums font-bold ${delta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`} dir="ltr">
                            {delta >= 0 ? '+' : ''}{rial(delta)}
                          </span>
                        )
                      },
                      value: (x) => x.compare?.delta?.sales_rial ?? 0
                    },
                  ]} />
                </AppleCard>

                {/* Latest period comparison summary banner */}
                {last?.compare && (
                  <div className="rounded-2xl bg-white/85 backdrop-blur-xl border border-black/[0.04] p-4 text-xs text-[#1D1D1F] flex items-center justify-between flex-wrap gap-2 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
                    <span>
                      آخرین دوره: <b className="font-bold">{rial(last.sales_rial)} ریال</b> در برابر {last.compare.label} ({last.compare.start} تا {last.compare.end}؛ {fa(last.compare.sales_days)} روز دارای فروش)
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      (last.compare.growth.sales_rial ?? 0) >= 0 ? 'bg-emerald-500/10 text-emerald-700' : 'bg-rose-500/10 text-rose-700'
                    }`}>
                      رشد فروش: {pct(last.compare.growth.sales_rial, 1)}
                    </span>
                  </div>
                )}
              </>
            )}
          </>
        )
      }}</Status>
    </div>
  )
}

function ProfileCommon({ j, back, openCustomer, openVisitor }) {
  const months = (j.months ?? []).map((m) => ({ ...m, gross: billions(m.sales_rial) }))
  const days = (j.days ?? []).map((d) => ({ ...d, gross: billions(d.sales_rial) }))
  return (
    <div className="w-full max-w-[1600px] mx-auto px-6 space-y-6">
      {/* Apple Glass Hero Header */}
      <div className="rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0071E3] to-[#42A1EC] flex items-center justify-center text-white font-black text-lg shadow-sm shadow-blue-500/30">
            {PROFILE_LABELS_FULL[j.by]?.[0] ?? 'پ'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#0071E3]/10 text-[#0071E3]">
                پروفایل {PROFILE_LABELS_FULL[j.by]}
              </span>
              <h1 className="text-xl font-extrabold text-[#1D1D1F] tracking-tight">{j.key}</h1>
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-xs text-[#86868B] flex-wrap">
              <span>سهم از فروش هسته: <b className="text-[#1D1D1F] font-bold">{pct(j.share, 2)}</b></span>
              <span>•</span>
              <span>اولین فروش دوره: <b className="text-[#1D1D1F]">{j.first_sale ?? '—'}</b></span>
              <span>•</span>
              <span>آخرین فروش دوره: <b className="text-[#1D1D1F]">{j.last_sale ?? '—'}</b></span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={back}
          className="px-4 py-2 rounded-2xl bg-black/[0.05] hover:bg-black/[0.09] text-[#1D1D1F] text-xs font-bold transition-all flex items-center gap-1.5"
        >
          <span>← بازگشت</span>
        </button>
      </div>

      {/* 10 Apple Bento KPI Cards in 2 Symmetrical Rows of 5 */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 w-full">
        <AppleKpiCard label="فروش عادی" value={rial(j.sales_rial)} unit="ریال" icon={CircleDollarSign} tone="blue" />
        <AppleKpiCard label="ریال خالص" value={rial(j.net_rial)} unit="خالص از پروموشن" icon={Award} tone="teal" />
        <AppleKpiCard label="فاکتور فروش" value={fa(j.sales_invoices)} unit="فقره فاکتور" icon={FileText} tone="violet" />
        <AppleKpiCard label="مشتری خریدار" value={fa(j.buying_customers)} unit="مشتری یکتا" icon={Users} tone="blue" />
        <AppleKpiCard label="روز دارای فروش" value={fa(j.active_days)} unit="روز فعال" icon={Calendar} tone="green" />
        <AppleKpiCard label="سطر فاکتور" value={fa(j.sales_lines)} unit={`میانگین ${fa2(j.avg_lines_per_invoice)} سطر در فاکتور`} icon={Layers} tone="amber" />
        <AppleKpiCard label="میانگین هر فاکتور" value={j.avg_invoice_rial == null ? '—' : rial(j.avg_invoice_rial)} unit="ریال" icon={CircleDollarSign} tone="violet" />
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
                  <linearGradient id="appleProfileMonthlyBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0071E3" />
                    <stop offset="100%" stopColor="#42A1EC" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#E5E5EA" strokeDasharray="3 3" />
                <XAxis dataKey="year_month" reversed tickFormatter={monthName} tickLine={false} axisLine={false} tick={{ fill: '#86868B', fontSize: 12 }} />
                <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={55} tick={{ fill: '#86868B', fontSize: 12 }} />
                <Tooltip content={<ChartTip labelFn={monthName} unit="میلیارد ریال" />} />
                <Bar dataKey="gross" name="فروش عادی" fill="url(#appleProfileMonthlyBar)" radius={[8, 8, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AppleCard>

        <AppleCard title="روند روزانه" subtitle="فروش عادی به میلیارد ریال" badge="روزانه">
          {!days.length ? (
            <div className="text-center py-12 text-[#86868B] text-xs">در این بازه فروشی ثبت نشده است.</div>
          ) : (
            <div className="h-72 w-full mt-2" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={days} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="appleProfileDailyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF9500" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#FF9500" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#E5E5EA" strokeDasharray="3 3" />
                  <XAxis dataKey="date" reversed tickFormatter={dayLabel} tickLine={false} axisLine={false} tick={{ fill: '#86868B', fontSize: 11 }} />
                  <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={55} tick={{ fill: '#86868B', fontSize: 12 }} />
                  <Tooltip content={<ChartTip labelFn={dayLabel} unit="میلیارد ریال" />} />
                  <Area type="monotone" dataKey="gross" name="فروش عادی" stroke="#FF9500" strokeWidth={2.5} fill="url(#appleProfileDailyGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </AppleCard>
      </div>

      {/* 5 Donut Charts in 3 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 w-full items-stretch">
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
            { label: 'نام', render: (x) => <span className="font-semibold text-[#1D1D1F]">{x.name ?? '—'}</span>, value: (x) => String(x.name ?? '') },
            { label: 'فروش', render: (x) => <span className="tabular-nums font-bold text-[#0071E3]">{rial(x.sales_rial)}</span>, value: (x) => x.sales_rial },
            { label: 'مشتری', render: (x) => <span className="tabular-nums">{fa(x.customers)}</span>, value: (x) => x.customers },
          ]} />
        </AppleCard>

        <AppleCard title="مشتریان برتر" subtitle="برای دیدن پروفایل روی ردیف کلیک کنید">
          <Table name={`مشتری-${j.key}`} rows={j.customers ?? []} onRow={(x) => openCustomer(x.code)} columns={[
            { label: 'کد', render: (x) => x.code, value: (x) => String(x.code) },
            { label: 'نام مشتری', render: (x) => <span className="font-semibold text-[#1D1D1F]">{x.name ?? '—'}</span>, value: (x) => String(x.name ?? '') },
            { label: 'فروش', render: (x) => <span className="tabular-nums font-bold text-[#0071E3]">{rial(x.sales_rial)}</span>, value: (x) => x.sales_rial },
            { label: 'فاکتور', render: (x) => <span className="tabular-nums">{fa(x.invoices)}</span>, value: (x) => x.invoices },
          ]} />
        </AppleCard>
      </div>

      {j.products?.length > 0 && (
        <AppleCard title="کالاهای برتر" subtitle="۱۵ کالای پرفروش" badge="کالاها">
          <Table name={`کالا-${j.key}`} rows={j.products} columns={[
            { label: 'کالا', render: (x) => <span className="font-semibold text-[#1D1D1F]">{x.name}</span>, value: (x) => String(x.name ?? '') },
            { label: 'فروش', render: (x) => <span className="tabular-nums font-bold text-[#0071E3]">{rial(x.sales_rial)}</span>, value: (x) => x.sales_rial },
            { label: 'تعداد', render: (x) => <span className="tabular-nums">{fa(x.qty)}</span>, value: (x) => x.qty },
          ]} />
        </AppleCard>
      )}
    </div>
  )
}

function ProfileDirectory({ p, openProfile }) {
  const [by, setBy] = useState('branch')
  const r = useApi('/breakdown', { ...p, by, limit: 100 })
  const labels = { branch: 'شعبه', brand: 'برند', group: 'لاین', product: 'کالا' }

  return (
    <div className="w-full max-w-[1600px] mx-auto px-6 space-y-6">
      {/* Apple Floating Filter Bar */}
      <div className="rounded-[24px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-[#86868B]">نوع پروفایل:</span>
          <div className="flex items-center gap-1 p-1 bg-[#E8E8ED]/80 rounded-2xl flex-wrap">
            {Object.entries(labels).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setBy(k)}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  by === k ? 'bg-[#0071E3] text-white shadow-sm' : 'text-[#1D1D1F] hover:bg-black/[0.05]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs text-[#86868B] font-medium hidden sm:inline">
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
              { label: labels[by], render: (x) => <span className="font-semibold text-[#1D1D1F]">{String(x.key)}</span>, value: (x) => String(x.key) },
              { label: 'فروش عادی', render: (x) => <span className="tabular-nums font-bold text-[#0071E3]">{rial(x.sales_rial)}</span>, value: (x) => x.sales_rial },
              { label: 'ریال خالص', render: (x) => <span className="tabular-nums font-medium text-[#86868B]">{rial(x.net_rial)}</span>, value: (x) => x.net_rial },
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
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 text-xs text-rose-800 flex items-center justify-between">
          <span>مورد یافت نشد.</span>
          <button className="px-3 py-1 rounded-xl bg-white border border-rose-200 text-rose-700 font-bold" type="button" onClick={back}>بازگشت</button>
        </div>
      </div>
    )
  }
  return <Status state={r}>{(j) => <ProfileCommon j={j} back={back} openCustomer={openCustomer} openVisitor={openVisitor} />}</Status>
}

/* ---------- پروفایل ویزیتور (Apple Bento Design) ---------- */
function SplitPie({ title, rows }) {
  const top = rows.slice(0, 8).map((x) => ({ name: String(x.name), value: x.sales_rial }))
  const rest = rows.slice(8).reduce((s, x) => s + x.sales_rial, 0)
  if (rest > 0) top.push({ name: 'سایر', value: rest })
  const total = top.reduce((s, x) => s + x.value, 0)
  return (
    <AppleCard title={title} subtitle="فقط فروش عادی" className="h-full flex flex-col justify-between">
      {!top.length ? (
        <div className="text-center py-12 text-xs text-[#86868B]">داده‌ای برای این فیلترها وجود ندارد.</div>
      ) : (
        <div className="flex flex-col lg:flex-row items-center justify-between gap-5 mt-2 flex-1">
          {/* Donut Chart */}
          <div className="w-[160px] h-[160px] shrink-0 relative" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={top}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="56%"
                  outerRadius="86%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {top.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [`${fa(v)} ریال (${pct(v / total, 1)})`, n]} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend List */}
          <ul className="flex-1 min-w-0 w-full space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {top.map((s, i) => (
              <li key={s.name} className="flex items-center justify-between gap-2 text-xs py-0.5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="text-[#1D1D1F] font-medium truncate text-[12px]" title={s.name}>
                    {s.name}
                  </span>
                </div>
                <span className="text-[#1D1D1F] font-bold tabular-nums text-[12px] shrink-0">
                  {pct(s.value / total, 1)}
                </span>
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
  const r = useApi('/visitors', p)
  const ov = useApi('/overview', p)
  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6">
      <Status state={r}>{(j) => {
        const rows = j.visitors ?? []
        const sales = rows.reduce((s, x) => s + x.sales_rial, 0)
        const unassigned = ov.data ? ov.data.sum_rial_vat - rows.reduce((s, x) => s + x.sum_rial_vat, 0) : null
        const top = rows.slice(0, 15).map((x) => ({ ...x, label: `${x.name ?? ''} (${x.code})`, gross: billions(x.sales_rial) }))
        return (
          <>
            {/* 5 Apple Bento KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 w-full">
              <AppleKpiCard label="تعداد ویزیتور دارای فروش" value={fa(rows.length)} unit="کد ویزیتور" icon={UserCheck} tone="blue" />
              <AppleKpiCard label="جمع فروش عادی" value={rial(sales)} unit="ریال" icon={CircleDollarSign} tone="teal" />
              <AppleKpiCard label="میانگین فروش هر ویزیتور" value={rows.length ? rial(sales / rows.length) : '—'} unit="ریال" icon={TrendingUp} tone="violet" />
              <AppleKpiCard label="خرید پرسنلی" value={rial(j.personnel_rial ?? 0)} unit={`${fa(j.personnel_visitors ?? 0)} ویزیتور`} icon={Award} tone="amber" />
              <AppleKpiCard label="Rial+Vat بدون کد ویزیتور" value={unassigned == null ? '…' : rial(unassigned)} unit="ریال" icon={FileText} tone="pink" />
            </div>

            {/* Top Visitors Chart Bento */}
            <AppleCard title="ویزیتورهای برتر — ۱۵ مورد" subtitle="فروش عادی به میلیارد ریال" badge="۱۵ ویزیتور برتر">
              <div className="h-80 w-full mt-2" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top} margin={{ top: 8, right: 8, left: 8, bottom: 20 }}>
                    <defs>
                      <linearGradient id="appleVisitorTopBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0071E3" />
                        <stop offset="100%" stopColor="#42A1EC" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#E5E5EA" strokeDasharray="3 3" />
                    <XAxis dataKey="label" reversed tickLine={false} axisLine={false} interval={0} angle={-25} textAnchor="end" height={60} tick={{ fill: '#86868B', fontSize: 11 }} />
                    <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={55} tick={{ fill: '#86868B', fontSize: 12 }} />
                    <Tooltip content={<ChartTip unit="میلیارد ریال" />} />
                    <Bar dataKey="gross" name="فروش عادی" fill="url(#appleVisitorTopBar)" radius={[8, 8, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </AppleCard>

            {/* Visitors Table Bento */}
            <AppleCard title="جدول ویزیتورها" subtitle="هر کد ویزیتور یک ردیف است؛ برای دیدن پروفایل روی ردیف کلیک کنید">
              <Table name="جدول-ویزیتورها" rows={rows} onRow={(x) => openVisitor(x.code)} columns={[
                { label: 'رتبه', render: (x) => fa(x.rank), value: (x) => x.rank },
                { label: 'کد', render: (x) => x.code, value: (x) => String(x.code) },
                { label: 'نام ویزیتور', render: (x) => x.name ?? '—', value: (x) => String(x.name ?? '') },
                { label: 'تعداد شعبه', render: (x) => fa(x.branch_count), value: (x) => x.branch_count },
                { label: 'فروش عادی (ریال)', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial },
                { label: 'ریال خالص', render: (x) => rial(x.net_rial), value: (x) => x.net_rial },
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
  const r = useApi(`/visitor/${encodeURIComponent(code)}`, p)
  if (r.error) {
    return (
      <div className="w-full max-w-[1600px] mx-auto p-6">
        <div className="rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 p-5 text-sm flex items-center justify-between">
          <span>ویزیتوری با این کد در این هسته فروش پیدا نشد.</span>
          <button type="button" className="px-4 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-semibold" onClick={back}>
            بازگشت به فهرست
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6">
      <Status state={r}>{(j) => {
        const months = j.months.map((m) => ({ ...m, gross: billions(m.sales_rial) }))
        const days = j.days.map((d) => ({ ...d, gross: billions(d.sales_rial) }))
        const multi = j.names.length > 1 || j.all_branches.length > 1
        return (
          <>
            {/* Header Bento Card */}
            <AppleCard
              title={j.name ?? 'پروفایل ویزیتور'}
              subtitle={`کد ویزیتور: ${j.code}`}
              badge={j.rank ? `رتبه ${fa(j.rank)} از ${fa(j.visitor_count)}` : ''}
              action={
                <button
                  type="button"
                  onClick={back}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-black/[0.05] hover:bg-black/[0.08] text-[#1D1D1F] transition-colors"
                >
                  بازگشت به فهرست
                </button>
              }
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="bg-[#F5F5F7] p-3.5 rounded-2xl border border-black/[0.03]">
                  <span className="text-[11px] text-[#86868B] block mb-1">شعبه‌ها</span>
                  <b className="text-sm font-bold text-[#1D1D1F] truncate block">{j.all_branches.join('، ') || '—'}</b>
                </div>
                <div className="bg-[#F5F5F7] p-3.5 rounded-2xl border border-black/[0.03]">
                  <span className="text-[11px] text-[#86868B] block mb-1">کد ویزیتور</span>
                  <b className="text-sm font-bold text-[#1D1D1F] block" dir="ltr">{j.code}</b>
                </div>
                <div className="bg-[#F5F5F7] p-3.5 rounded-2xl border border-black/[0.03]">
                  <span className="text-[11px] text-[#86868B] block mb-1">اولین فروش دوره</span>
                  <b className="text-sm font-bold text-[#1D1D1F] block">{j.first_sale ?? '—'}</b>
                </div>
                <div className="bg-[#F5F5F7] p-3.5 rounded-2xl border border-black/[0.03]">
                  <span className="text-[11px] text-[#86868B] block mb-1">آخرین فروش دوره</span>
                  <b className="text-sm font-bold text-[#1D1D1F] block">{j.last_sale ?? '—'}</b>
                </div>
              </div>
            </AppleCard>

            {multi && (
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 px-5 py-3.5 text-xs leading-relaxed">
                این کد با {j.names.length > 1 ? `چند نام (${j.names.join('، ')})` : ''}{j.names.length > 1 && j.all_branches.length > 1 ? ' و ' : ''}{j.all_branches.length > 1 ? `چند شعبه (${j.all_branches.length})` : ''} ثبت شده است؛ شاخص‌ها بر پایهٔ کد ویزیتور و یکجا محاسبه می‌شوند.
              </div>
            )}

            {/* 12 KPI Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 w-full">
              <AppleKpiCard label="فروش عادی" value={rial(j.sales_rial)} unit="ریال" tone="blue" />
              <AppleKpiCard label="ریال خالص" value={rial(j.net_rial)} unit="ریال" tone="teal" />
              <AppleKpiCard label="رتبه در بین ویزیتورها" value={j.rank ? fa(j.rank) : '—'} unit={j.rank ? `از ${fa(j.visitor_count)}` : ''} tone="violet" />
              <AppleKpiCard label="سهم از فروش هسته" value={pct(j.share, 2)} unit="فروش عادی" tone="amber" />
              <AppleKpiCard label="تعداد فاکتور فروش" value={fa(j.sales_invoices)} unit="فقره" tone="blue" />
              <AppleKpiCard label="تعداد سطر فاکتور" value={fa(j.sales_lines)} unit="سطر" tone="teal" />
              <AppleKpiCard label="میانگین سطر هر فاکتور" value={fa2(j.avg_lines_per_invoice)} unit="سطر" tone="violet" />
              <AppleKpiCard label="مشتری خریدار" value={fa(j.buying_customers)} unit="مشتری یکتا" tone="amber" />
              <AppleKpiCard label="روز دارای فروش" value={fa(j.active_days)} unit="روز" tone="blue" />
              <AppleKpiCard label="میانگین هر فاکتور" value={dash(j.avg_invoice_rial)} unit="ریال" tone="teal" />
              <AppleKpiCard label="میانگین هر مشتری" value={dash(j.avg_customer_rial)} unit="ریال" tone="violet" />
              <AppleKpiCard label="درصد مرجوعی" value={pct(j.return_percent, 2)} unit="از فروش عادی" tone="pink" />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full items-stretch">
              <AppleCard title="روند ماهانه فروش ویزیتور" subtitle="میلیارد ریال؛ مستقل از فیلتر ماه">
                <div className="h-72 w-full mt-2" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={months} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="appleVisitorMonthly" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0071E3" />
                          <stop offset="100%" stopColor="#42A1EC" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="#E5E5EA" strokeDasharray="3 3" />
                      <XAxis dataKey="year_month" reversed tickFormatter={monthName} tickLine={false} axisLine={false} tick={{ fill: '#86868B', fontSize: 12 }} />
                      <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={55} tick={{ fill: '#86868B', fontSize: 12 }} />
                      <Tooltip content={<ChartTip labelFn={monthName} unit="میلیارد ریال" />} />
                      <Bar dataKey="gross" name="فروش عادی" fill="url(#appleVisitorMonthly)" radius={[8, 8, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </AppleCard>

              <AppleCard title="روند روزانه فروش ویزیتور" subtitle="میلیارد ریال، در بازهٔ انتخاب‌شده">
                {!days.length ? (
                  <div className="text-center py-20 text-xs text-[#86868B]">در این بازه فروشی ثبت نشده است.</div>
                ) : (
                  <div className="h-72 w-full mt-2" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={days} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                        <defs>
                          <linearGradient id="appleVisitorDaily" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#FF9500" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#FF9500" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="#E5E5EA" strokeDasharray="3 3" />
                        <XAxis dataKey="date" reversed tickFormatter={dayLabel} tickLine={false} axisLine={false} minTickGap={28} tick={{ fill: '#86868B', fontSize: 12 }} />
                        <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={55} tick={{ fill: '#86868B', fontSize: 12 }} />
                        <Tooltip content={<ChartTip labelFn={dayLabel} unit="میلیارد ریال" />} />
                        <Area type="monotone" dataKey="gross" name="فروش عادی" stroke="#FF9500" strokeWidth={2.5} fill="url(#appleVisitorDaily)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </AppleCard>
            </div>

            {/* SplitPies Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
              <SplitPie title="سهم شعبه‌ها" rows={j.branches} />
              <SplitPie title="سهم برندها" rows={j.brands} />
              <SplitPie title="سهم گرید مشتری" rows={j.grades} />
              <SplitPie title="سهم کانال فروش" rows={j.sales_types} />
            </div>

            {/* Tables Row: Top Customers + Top Products */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full items-start">
              <AppleCard title="مشتریان برتر" subtitle="۲۰ مشتری؛ برای دیدن پروفایل روی ردیف کلیک کنید">
                <Table name="مشتریان-ویزیتور" rows={j.customers} onRow={(x) => openCustomer(x.code)} columns={[
                  { label: 'کد', render: (x) => x.code, value: (x) => String(x.code) },
                  { label: 'نام مشتری', render: (x) => x.name ?? '—', value: (x) => String(x.name ?? '') },
                  { label: 'فروش عادی (ریال)', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial },
                  { label: 'تعداد فاکتور', render: (x) => fa(x.invoices), value: (x) => x.invoices },
                ]} />
              </AppleCard>

              <AppleCard title="کالاهای برتر" subtitle="۱۵ کالا">
                <Table name="کالاهای-ویزیتور" rows={j.products} columns={[
                  { label: 'کالا', render: (x) => x.name, value: (x) => String(x.name ?? '') },
                  { label: 'فروش عادی (ریال)', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial },
                  { label: 'تعداد', render: (x) => fa(x.qty), value: (x) => x.qty },
                ]} />
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

/* ---------- سلامت داده (Apple Bento Design) ---------- */
export function HealthPage({ health, meta, quality }) {
  const isReady = health?.status === 'ready'
  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-6">
      {/* Top Header Card */}
      <div className="rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-black text-xl shadow-sm shadow-emerald-500/20">
            ✓
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-[#1D1D1F] tracking-tight">وضعیت سلامت و کیفیت داده‌ها</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isReady ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'
              }`}>
                {isReady ? 'سامانه پایدار و آماده' : 'داده در حال بارگذاری یا ناقص'}
              </span>
            </div>
            <p className="text-xs text-[#86868B] mt-1">
              بررسی پیوستگی، صحت ردیف‌های فروش و مرجوعی، و سازگاری ساختار پایگاه داده
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
        <AppleKpiCard
          label="کل ردیف‌های تحلیلی"
          value={quality ? fa(quality.rows) : '—'}
          unit="سطر تراکنش معتبر"
          icon={Layers}
          tone="blue"
        />
        <AppleKpiCard
          label="بدون کد مشتری"
          value={quality ? fa(quality.null_customer_code) : '—'}
          unit="تراکنش‌های بدون شناسه"
          icon={Users}
          tone={quality?.null_customer_code > 0 ? 'amber' : 'teal'}
        />
        <AppleKpiCard
          label="بدون تاریخ فاکتور"
          value={quality ? fa(quality.null_invoice_date) : '—'}
          unit="تراکنش‌های بدون زمان"
          icon={Calendar}
          tone={quality?.null_invoice_date > 0 ? 'amber' : 'teal'}
        />
        <AppleKpiCard
          label="منفی غیرمرجوعی"
          value={quality ? fa(quality.negative_rows_non_return) : '—'}
          unit="موارد نامتعارف دیتابیس"
          icon={Activity}
          tone={quality?.negative_rows_non_return > 0 ? 'red' : 'teal'}
        />
      </div>

      {/* Limitations & Future Roadmap Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full items-start">
        <AppleCard
          title="محدودیت‌های شناخته‌شده داده"
          subtitle="قوانین سیستمی و اعتبارسنجی منابع ورودی"
          badge={`${meta?.limitations?.length ?? 0} مورد`}
        >
          {!(meta?.limitations?.length) ? (
            <div className="text-center py-8 text-xs text-[#86868B]">محدودیت خاصی ثبت نشده است.</div>
          ) : (
            <div className="space-y-2.5 mt-2">
              {(meta?.limitations ?? []).map((l) => (
                <div
                  key={l.code}
                  className={`p-3.5 rounded-2xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                    l.severity === 'err' || l.severity === 'blocked'
                      ? 'bg-rose-500/5 border-rose-500/15 text-rose-800'
                      : l.severity === 'warning'
                      ? 'bg-amber-500/5 border-amber-500/15 text-amber-800'
                      : 'bg-black/[0.02] border-black/[0.05] text-[#1D1D1F]'
                  }`}
                >
                  <span className="font-bold shrink-0">⚠️</span>
                  <span>{l.label}</span>
                </div>
              ))}
            </div>
          )}
        </AppleCard>

        <AppleCard
          title="گزارش‌های توسعهٔ آینده"
          subtitle="ماژول‌های وابسته به متغیرهای جدید کسب‌وکار"
          badge="نقشه راه"
        >
          <div className="space-y-2.5 mt-2">
            <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/15 text-xs text-amber-800 leading-relaxed flex items-start gap-2.5">
              <span className="font-bold shrink-0">📦</span>
              <div>
                <b>واحد کارتن:</b> ضریب تبدیل کارتن در داده‌های استخراج‌شده فعلی موجود نیست و در حال حاضر فقط «واحد اصلی» کالا گزارش می‌شود.
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-blue-500/5 border border-blue-500/15 text-xs text-blue-800 leading-relaxed flex items-start gap-2.5">
              <span className="font-bold shrink-0">📊</span>
              <div>
                <b>شاخص‌های پیشرفته ریزش و ارزش دوره عمر (CLV):</b> فرمول دقیق و دورهٔ بازگشت مشتری بر اساس مدل سفارش‌های آتی تعریف خواهد شد.
              </div>
            </div>
          </div>
        </AppleCard>
      </div>
    </div>
  )
}

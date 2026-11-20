import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Award, Calendar, CircleDollarSign, FileText, Layers, Package, Percent, PieChart as PieIcon, RotateCcw, TrendingUp, UserCheck, UserRound, Users } from 'lucide-react'
import { useApi } from './api'
import { useAppearance } from './AppearanceContext'
import { dayLabel, fa, fa2, monthName } from './format'
import { AppleCard, AppleKpiCard, ChartTip, pct, rial, Status, Table } from './ui'
import { ReturnsProfileCard, returnsArg } from './ReturnsPage'

export const PIE_COLORS = ['#2563eb', '#0f766e', '#8b5cf6', '#f59e0b', '#ec4899', '#0ea5e9', '#84cc16', '#ef4444', '#94a3b8']
const billions = (v) => v / 1e9
export const dash = (v, f = rial) => (v == null ? '—' : f(v))

export function SplitPie({ title, rows }) {
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

export function VisitorList({ p, openVisitor }) {
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

export function VisitorProfile({ p, code, back, openCustomer, openReturns }) {
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

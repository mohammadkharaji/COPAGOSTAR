import { useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Award, Calendar, CircleDollarSign, FileText, Layers, RotateCcw, TrendingUp, UserCheck, Users } from 'lucide-react'
import { useApi } from './api'
import { useAppearance } from './AppearanceContext'
import { dayLabel, fa, fa2, monthName } from './format'
import { AppleCard, AppleKpiCard, ChartTip, pct, rial, Status, Table } from './ui'
import { SplitPie } from './VisitorPage'

const billions = (v) => v / 1e9

export const GROWTH_LABELS = { month: 'ماهانه', season: 'فصلی', half: '۶ماهه' }
export const PROFILE_LABELS_FULL = { branch: 'شعبه', brand: 'برند', group: 'لاین', product: 'کالا' }
export const PROFILE_SPLITS = { branch: 'شعبه', brand: 'برند', group: 'لاین', grade: 'گرید مشتری', region: 'منطقه' }

export function ProfileCommon({ j, back, openCustomer, openVisitor }) {
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

export function ProfileDirectory({ p, openProfile }) {
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

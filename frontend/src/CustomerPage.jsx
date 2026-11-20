import { useState } from 'react'
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Award, Calendar, CircleDollarSign, FileText, Search, Store, TrendingUp, UserRound } from 'lucide-react'
import { useApi } from './api'
import { useAppearance } from './AppearanceContext'
import { fa, monthName } from './format'
import { AppleCard, AppleKpiCard, ChartTip, pct, rial, Status, Table } from './ui'
import { ReturnsProfileCard, returnsArg } from './ReturnsPage'

const billions = (v) => v / 1e9

export function CustomerPage({ core, code, setCode, openReturns }) {
  const { isDark } = useAppearance()
  const [draft, setDraft] = useState(code ?? '')
  const reasonFilter = new URLSearchParams(location.hash.split('?')[1] || '').get('reason') || undefined
  const r = useApi(`/customer/${encodeURIComponent(code ?? '')}`, { core, reason: reasonFilter }, Boolean(code))

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5">
      {/* Floating Glass Search & Quick Access Bar */}
      <form
        className={`rounded-2xl backdrop-blur-xl border p-3.5 sm:p-4 flex items-center justify-between gap-4 flex-wrap ${
          isDark
            ? 'bg-[#0B100E]/80 border-emerald-500/15 shadow-[0_4px_20px_rgba(0,0,0,0.35)]'
            : 'bg-white/95 border-slate-200/90 shadow-xs'
        }`}
        onSubmit={(e) => { e.preventDefault(); if (draft.trim()) setCode(draft.trim()) }}
      >
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap flex-1 max-w-xl">
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
              <Search size={16} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
            </div>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="جستجوی کد مشتری (مثلاً Gol100101)..."
              dir="ltr"
              className={`w-full pr-10 pl-4 py-2 text-sm rounded-xl border focus:outline-none transition-all ${
                isDark
                  ? 'bg-black/40 border-white/10 text-slate-100 placeholder-slate-500 focus:border-emerald-500/60 focus:bg-black/60'
                  : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-600 focus:bg-white'
              }`}
            />
          </div>
          <button
            type="submit"
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs active:scale-[0.98] transition-all"
          >
            نمایش پروفایل
          </button>
        </div>

        {code && (
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`} dir="ltr">
              کد فعال: {code}
            </span>
            <button
              type="button"
              onClick={() => { setCode(''); setDraft('') }}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              ✕ پاک کردن
            </button>
          </div>
        )}
      </form>

      {!code && (
        <AppleCard>
          <div className="text-center py-12 space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-600/20 to-teal-500/20 flex items-center justify-center text-emerald-400">
              <UserRound size={32} />
            </div>
            <h3 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>کد مشتری را وارد کنید</h3>
            <p className={`text-xs max-w-md mx-auto ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              کد مشتری مورد نظر را جستجو کنید یا از طریق کلیک روی مشتریان در بخش پارتو و گزارش‌های فروش، پروفایل تفصیلی را فراخوانی نمایید.
            </p>
          </div>
        </AppleCard>
      )}

      {code && r.error && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 px-5 py-4 text-sm font-semibold text-center">
          مشتری با کد «{code}» در این هسته فروش پیدا نشد.
        </div>
      )}

      {code && !r.error && (
        <Status state={r}>{(j) => {
          const total = (j.months ?? []).reduce((s, m) => s + (m.sales_rial || 0), 0)
          const invoices = (j.months ?? []).reduce((s, m) => s + (m.invoices || 0), 0)
          const totalDiscounts = (j.months ?? []).reduce((s, m) => s + (m.discount_rial || 0), 0)
          const avgInvoice = invoices > 0 ? Math.round(total / invoices) : 0
          const d = (j.months ?? []).map((m) => ({ ...m, gross: billions(m.sales_rial) }))
          const isVip = String(j.grade ?? '').toUpperCase().includes('VIP')
          const products = (j.products ?? []).map((x, idx) => ({ ...x, rank: idx + 1 }))
          const brandTotal = (j.brands ?? []).reduce((s, b) => s + (b.sales_rial || 0), 0)
          const brands = (j.brands ?? []).map((x, idx) => ({
            ...x,
            rank: idx + 1,
            share: brandTotal > 0 ? x.sales_rial / brandTotal : 0
          }))
          const maxMonth = (j.months ?? []).reduce((max, m) => ((m.sales_rial || 0) > (max?.sales_rial || 0) ? m : max), j.months?.[0])

          return (
            <div className="space-y-5">
              {/* Executive Customer Identity Bento Card */}
              <div
                className={`rounded-2xl sm:rounded-3xl border transition-all p-5 sm:p-6 overflow-hidden relative ${
                  isDark
                    ? 'bg-[#0B100E]/90 backdrop-blur-2xl border-emerald-500/20 shadow-[0_12px_40px_rgba(0,0,0,0.5)]'
                    : 'bg-white/95 backdrop-blur-xl border-slate-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.04)]'
                }`}
              >
                {/* Top Accent Gradient Line */}
                <div className={`absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r ${
                  isVip
                    ? 'from-amber-400 via-yellow-400 to-amber-500'
                    : 'from-emerald-500 via-teal-400 to-emerald-600'
                }`} />

                {/* Header: Customer Name & Header Badges */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-5 border-b border-white/5">
                  {/* Right: Emblem + Customer Name */}
                  <div className="flex items-center gap-3.5 sm:gap-4.5 flex-1 min-w-0">
                    <div className="relative shrink-0">
                      <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-white shadow-xl text-2xl font-black ${
                        isVip
                          ? 'bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-600 text-amber-950 shadow-amber-900/30'
                          : 'bg-gradient-to-br from-emerald-500 to-teal-700 shadow-emerald-900/30'
                      }`}>
                        {isVip ? '👑' : <Store size={28} className="text-white" />}
                      </div>
                      {isVip && (
                        <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-950 font-black text-[9px] shadow-sm">
                          VIP
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          پروفایل مشتری
                        </span>
                        {j.grade && (
                          <span className={`px-3 py-0.5 rounded-full text-xs font-extrabold flex items-center gap-1 ${
                            isVip
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                              : isDark
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {isVip ? '👑 گرید VIP' : `گرید ${j.grade}`}
                          </span>
                        )}
                      </div>
                      <h1 className={`text-xl sm:text-2xl lg:text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {j.name || j.sales_point || 'مشتری بدون نام'}
                      </h1>
                      {j.sales_point && j.sales_point !== j.name && (
                        <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          نام تابلو: <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>{j.sales_point}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Left: Quick Financial Status Pills */}
                  <div className="flex items-center gap-3 shrink-0 flex-wrap">
                    <div className={`px-4 py-2.5 rounded-2xl border ${isDark ? 'bg-black/40 border-white/10' : 'bg-slate-50 border-slate-200'} flex items-center gap-3`}>
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                        <CircleDollarSign size={20} />
                      </div>
                      <div>
                        <span className={`text-[10px] block font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>مجموع خرید دوره</span>
                        <span className={`text-base font-black tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                          {billions(total).toFixed(1)} <span className="text-xs font-normal">میلیارد ریال</span>
                        </span>
                      </div>
                    </div>
                    <div className={`px-4 py-2.5 rounded-2xl border ${isDark ? 'bg-black/40 border-white/10' : 'bg-slate-50 border-slate-200'} flex items-center gap-3`}>
                      <div className="w-9 h-9 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center shrink-0">
                        <Calendar size={20} />
                      </div>
                      <div>
                        <span className={`text-[10px] block font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>آخرین تاریخ خرید</span>
                        <span className={`text-base font-bold tabular-nums ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>
                          {j.last_purchase ?? '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Structured Metadata Grid (6 Clean Cards) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5 pt-5">
                  {/* نام فروشگاه / تابلو */}
                  <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50/80 border-slate-200'}`}>
                    <span className={`text-[11px] block font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>نام فروشگاه / تابلو</span>
                    <span className={`text-xs sm:text-sm font-bold block truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`} title={j.sales_point || j.name}>
                      {j.sales_point || j.name || '—'}
                    </span>
                  </div>

                  {/* کد مشتری */}
                  <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50/80 border-slate-200'}`}>
                    <span className={`text-[11px] block font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>کد مشتری</span>
                    <span className={`text-xs sm:text-sm font-mono font-bold block ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`} dir="ltr">
                      {j.code}
                    </span>
                  </div>

                  {/* شعبه */}
                  <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50/80 border-slate-200'}`}>
                    <span className={`text-[11px] block font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>شعبه</span>
                    <span className={`text-xs sm:text-sm font-bold block truncate ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>
                      {j.branch || '—'}
                    </span>
                  </div>

                  {/* ویزیتور */}
                  <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50/80 border-slate-200'}`}>
                    <span className={`text-[11px] block font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>ویزیتور فعال</span>
                    <span className={`text-xs sm:text-sm font-semibold block truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`} title={j.visitor}>
                      {j.visitor || '—'}
                    </span>
                  </div>

                  {/* شهر و منطقه */}
                  <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50/80 border-slate-200'}`}>
                    <span className={`text-[11px] block font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>شهر / منطقه</span>
                    <span className={`text-xs sm:text-sm font-medium block truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`} title={[j.city, j.region].filter(Boolean).join(' / ')}>
                      {[j.city, j.region].filter(Boolean).join(' / ') || '—'}
                    </span>
                  </div>

                  {/* گرید مشتری */}
                  <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-black/30 border-white/5' : 'bg-slate-50/80 border-slate-200'}`}>
                    <span className={`text-[11px] block font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>سطح وفاداری</span>
                    <span className={`text-xs sm:text-sm font-black block ${
                      isVip ? 'text-amber-400' : isDark ? 'text-emerald-400' : 'text-emerald-700'
                    }`}>
                      {j.grade ? (isVip ? 'VIP ★' : `گرید ${j.grade}`) : 'عادی'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5 Symmetrical Apple Bento KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-3.5 w-full">
                <AppleKpiCard label="جمع خرید عادی" value={rial(total)} unit={`${billions(total).toFixed(1)} میلیارد ریال`} icon={CircleDollarSign} tone="teal" />
                <AppleKpiCard label="تعداد فاکتور" value={fa(invoices)} unit="فقره فاکتور موفق" icon={FileText} tone="blue" />
                <AppleKpiCard label="میانگین هر فاکتور" value={avgInvoice > 0 ? rial(avgInvoice) : '—'} unit="ریال به ازای هر خرید" icon={TrendingUp} tone="green" />
                <AppleKpiCard label="مجموع تخفیف‌ها" value={rial(totalDiscounts)} unit={total > 0 ? `${pct(totalDiscounts / total, 1)} تخفیف موثر` : 'ریال'} icon={Award} tone="amber" />
                <AppleKpiCard label="تاریخ آخرین خرید" value={j.last_purchase ?? '—'} unit="آخرین ثبت فاکتور" icon={Calendar} tone="violet" />
              </div>

              {/* Monthly Pattern Bar Chart Bento */}
              <AppleCard
                title="الگوی ماهانه خرید مشتری"
                subtitle={maxMonth && maxMonth.sales_rial > 0 ? `فروش ناخالص به میلیارد ریال • اوج خرید در ${monthName(maxMonth.year_month)} (${billions(maxMonth.sales_rial).toFixed(1)} م.ر)` : 'فروش ناخالص به میلیارد ریال'}
                badge="روند ماهانه"
              >
                <div className="h-72 w-full mt-2" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="emeraldCustMonthly" x1="0" y1="0" x2="0" y2="1">
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
                      <Tooltip
                        content={<ChartTip labelFn={monthName} unit="میلیارد ریال" valueFn={(v) => (v == null ? '—' : Number(v).toLocaleString('fa-IR', { minimumFractionDigits: (Number(v) % 1 === 0 && Number(v) >= 10 ? 0 : 1), maximumFractionDigits: 2 }))} />}
                        cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                      />
                      <Bar dataKey="gross" name="فروش عادی" fill="url(#emeraldCustMonthly)" radius={[6, 6, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </AppleCard>

              {/* Products & Brands Bento Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full items-start">
                <AppleCard title="کالاهای خریداری‌شده" subtitle="۱۵ کالای برتر بر اساس مبلغ فروش" badge={`${fa(products.length)} کالا`}>
                  <Table
                    name="کالاهای-مشتری"
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
                        label: 'مبلغ خرید',
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
                        label: 'تعداد',
                        render: (x) => <span className="tabular-nums font-bold text-amber-400">{fa(x.qty)} <span className="text-[10px] text-slate-400 font-normal">عدد</span></span>,
                        value: (x) => x.qty,
                      },
                    ]}
                  />
                </AppleCard>

                <AppleCard title="ترکیب برندها" subtitle="سهم هر برند از کل خرید مشتری" badge={`${fa(brands.length)} برند`}>
                  <Table
                    name="برندهای-مشتری"
                    rows={brands}
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
                        label: 'برند',
                        render: (x) => (
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-500" />
                            <span className={`font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{x.name}</span>
                          </div>
                        ),
                        value: (x) => String(x.name ?? ''),
                      },
                      {
                        label: 'مبلغ خرید',
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
                        label: 'سهم از سبد',
                        render: (x) => (
                          <div className="flex items-center gap-2 min-w-[90px]">
                            <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                                style={{ width: `${Math.min(100, Math.max(5, x.share * 100))}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold tabular-nums min-w-[34px] text-left ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                              {pct(x.share, 1)}
                            </span>
                          </div>
                        ),
                        value: (x) => x.share * 100,
                        unit: '٪',
                      },
                    ]}
                  />
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

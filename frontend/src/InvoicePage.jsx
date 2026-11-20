import { useState } from 'react'
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, CircleDollarSign, FileText, Layers, Package, TrendingUp } from 'lucide-react'
import { useApi } from './api'
import { useAppearance } from './AppearanceContext'
import { fa, fa2, monthName } from './format'
import { AppleCard, AppleKpiCard, ChartTip, pct, rial, Status, Table } from './ui'

const billions = (v) => v / 1e9

export function InvoiceCompare({ p }) {
  const { isDark } = useAppearance()
  const r = useApi('/invoice-compare', { ...p, day: p.end ? p.end.replaceAll('-', '/') : undefined })
  if (!r.data || !r.data.available) return null

  const daysCur = fa(r.data.current.to % 100)
  const items = [
    {
      label: 'تعداد فاکتور فروش',
      current: fa(r.data.current.invoices),
      curUnit: 'فقره فاکتور',
      previous: fa(r.data.previous.invoices),
      prevUnit: 'فقره',
      change: r.data.change.invoices,
      icon: FileText,
      curRaw: r.data.current.invoices,
      prevRaw: r.data.previous.invoices,
    },
    {
      label: 'جمع فروش فاکتورها',
      current: rial(r.data.current.sales_rial),
      curUnit: `${billions(r.data.current.sales_rial).toFixed(1)} میلیارد ریال`,
      previous: rial(r.data.previous.sales_rial),
      prevUnit: `${billions(r.data.previous.sales_rial).toFixed(1)} م.ر`,
      change: r.data.change.sales_rial,
      icon: CircleDollarSign,
      curRaw: r.data.current.sales_rial,
      prevRaw: r.data.previous.sales_rial,
    },
    {
      label: 'میانگین هر فاکتور (AOV)',
      current: rial(r.data.current.avg_invoice_rial),
      curUnit: 'ریال در فاکتور',
      previous: rial(r.data.previous.avg_invoice_rial),
      prevUnit: 'ریال',
      change: r.data.change.avg_invoice_rial,
      icon: TrendingUp,
      curRaw: r.data.current.avg_invoice_rial,
      prevRaw: r.data.previous.avg_invoice_rial,
    },
  ]

  return (
    <AppleCard
      title="مقایسه عملکرد با مدت مشابه ماه قبل"
      subtitle={`از ابتدای ماه تا ${r.data.day} در برابر همان بازه در ماه قبل`}
      badge={`این ماه: ${daysCur} روز`}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
        {items.map((it) => {
          const ch = it.change
          const isUp = ch != null && ch >= 0
          const Icon = it.icon
          const maxRaw = Math.max(it.curRaw || 1, it.prevRaw || 1)
          const curPct = Math.min(100, Math.round(((it.curRaw || 0) / maxRaw) * 100))
          const prevPct = Math.min(100, Math.round(((it.prevRaw || 0) / maxRaw) * 100))

          return (
            <div
              key={it.label}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                isDark ? 'bg-black/25 border-white/5 hover:border-white/10' : 'bg-slate-50 border-slate-200/60 hover:shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      <Icon size={16} />
                    </div>
                    <span className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {it.label}
                    </span>
                  </div>

                  {ch != null && (
                    <span className={`inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-xs font-extrabold tabular-nums ${
                      isUp
                        ? isDark ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : isDark ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {isUp ? '▲ +' : '▼ '}{pct(Math.abs(ch), 1)}
                    </span>
                  )}
                </div>

                {/* Values comparison */}
                <div className="space-y-2 mt-2">
                  <div>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>این ماه ({daysCur} روز):</span>
                      <span className={`text-base font-black tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                        {it.current}
                      </span>
                    </div>
                    {it.curUnit && (
                      <div className={`text-[10px] text-left tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {it.curUnit}
                      </div>
                    )}
                    <div className={`h-1.5 rounded-full mt-1.5 overflow-hidden ${isDark ? 'bg-white/5' : 'bg-slate-200'}`}>
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all"
                        style={{ width: `${curPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-white/5">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>مدت مشابه ماه قبل:</span>
                      <span className={`text-sm font-semibold tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        {it.previous}
                      </span>
                    </div>
                    <div className={`h-1.5 rounded-full mt-1.5 overflow-hidden ${isDark ? 'bg-white/5' : 'bg-slate-200'}`}>
                      <div
                        className={`h-full rounded-full transition-all ${isDark ? 'bg-slate-600' : 'bg-slate-400'}`}
                        style={{ width: `${prevPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </AppleCard>
  )
}

export function InvoiceLinesSection({ p, linesState }) {
  const { isDark } = useAppearance()
  const fallback = useApi('/invoice-lines', p)
  const r = linesState || fallback

  return (
    <Status state={r}>{(j) => {
      const buckets = (j.buckets ?? []).map((b) => ({ ...b, label: b.open_ended ? `${fa(b.lines)}+ سطر` : `${fa(b.lines)} سطر` }))
      const maxBucket = buckets.reduce((max, b) => ((b.invoices || 0) > (max?.invoices || 0) ? b : max), buckets[0])

      return (
        <div className="space-y-5">
          {/* Distribution Chart Bento */}
          <AppleCard
            title="توزیع فاکتورها بر حسب تعداد سطر (عمق سبد خرید)"
            subtitle={maxBucket ? `تمرکز اصلی روی فاکتورهای ${maxBucket.label} با ${fa(maxBucket.invoices)} فقره (${pct(maxBucket.invoice_share, 1)} از کل فاکتورها)` : 'محور افقی: تعداد سطر در فاکتور · عمودی: تعداد فاکتور'}
            badge="توزیع اقلام"
          >
            <div className="h-72 w-full mt-2" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buckets} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="emeraldLinesBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" />
                      <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E5E5EA'} strokeDasharray="3 3" />
                  <XAxis dataKey="label" reversed tickLine={false} axisLine={false} tick={{ fill: isDark ? '#94A3B8' : '#86868B', fontSize: 11, fontFamily: 'Vazirmatn' }} />
                  <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={55} tick={{ fill: isDark ? '#94A3B8' : '#86868B', fontSize: 12, fontFamily: 'Vazirmatn' }} />
                  <Tooltip
                    content={
                      <ChartTip
                        unit="فاکتور"
                        valueFn={(v, payload) => {
                          const item = payload?.payload
                          return item ? `${fa(v)} فقره (${pct(item.invoice_share, 1)})` : fa(v)
                        }}
                      />
                    }
                    cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                  />
                  <Bar dataKey="invoices" name="تعداد فاکتور" fill="url(#emeraldLinesBar)" radius={[6, 6, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </AppleCard>

          {/* Tables Row: Line Distribution Table + Monthly Trend Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full items-start">
            <AppleCard title="جدول سطر فاکتور" subtitle="فقط فروش عادی؛ آخرین ردیف شامل ۱۰ سطر یا بیشتر است" badge={`${fa(buckets.length)} ردیف`}>
              <Table name="توزیع-سطر-فاکتور" rows={buckets} columns={[
                {
                  label: 'سطر در فاکتور',
                  render: (b) => (
                    <span className={`font-bold px-2 py-0.5 rounded-md text-xs ${
                      isDark ? 'bg-white/5 text-slate-100' : 'bg-slate-100 text-slate-900'
                    }`}>
                      {b.label}
                    </span>
                  ),
                  value: (b) => b.lines,
                },
                { label: 'تعداد فاکتور', render: (b) => <span className="tabular-nums font-bold">{fa(b.invoices)}</span>, value: (b) => b.invoices },
                { label: 'جمع سطرها', render: (b) => <span className="tabular-nums">{fa(b.line_count)}</span>, value: (b) => b.line_count },
                {
                  label: 'سهم از فاکتورها',
                  render: (b) => (
                    <div className="flex items-center gap-2 min-w-[90px]">
                      <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                          style={{ width: `${Math.min(100, Math.max(4, b.invoice_share * 100))}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold tabular-nums min-w-[34px] text-left">
                        {pct(b.invoice_share, 1)}
                      </span>
                    </div>
                  ),
                  value: (b) => b.invoice_share * 100,
                  unit: '٪',
                },
                {
                  label: 'سهم تجمعی',
                  render: (b) => (
                    <span className={`tabular-nums font-bold text-xs px-2 py-0.5 rounded-md ${
                      isDark ? 'bg-teal-500/10 text-teal-300' : 'bg-teal-50 text-teal-700'
                    }`}>
                      {pct(b.cum_invoice_share, 1)}
                    </span>
                  ),
                  value: (b) => b.cum_invoice_share * 100,
                  unit: '٪',
                },
              ]} />
            </AppleCard>

            <AppleCard title="روند ماهانه سطر فاکتور" subtitle="میانگین سطر هر فاکتور در هر ماه" badge={`${fa(j.months?.length || 0)} ماه`}>
              <Table name="سطر-فاکتور-ماهانه" rows={j.months || []} columns={[
                {
                  label: 'ماه',
                  render: (m) => <span className={`font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{monthName(m.year_month)}</span>,
                  value: (m) => m.year_month,
                },
                { label: 'تعداد فاکتور', render: (m) => <span className="tabular-nums font-semibold">{fa(m.invoices)}</span>, value: (m) => m.invoices },
                { label: 'تعداد سطر', render: (m) => <span className="tabular-nums">{fa(m.lines)}</span>, value: (m) => m.lines },
                {
                  label: 'میانگین سطر',
                  render: (m) => (
                    <span className={`tabular-nums font-black text-xs px-2 py-0.5 rounded-md ${
                      isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {fa2(m.avg_lines_per_invoice)}
                    </span>
                  ),
                  value: (m) => m.avg_lines_per_invoice ?? 0,
                },
                {
                  label: 'فروش عادی',
                  render: (m) => (
                    <div className="flex flex-col">
                      <span className={`tabular-nums font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{rial(m.sales_rial)}</span>
                      <span className={`text-[10px] tabular-nums font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {billions(m.sales_rial).toFixed(1)} م.ر
                      </span>
                    </div>
                  ),
                  value: (m) => m.sales_rial,
                  unit: 'ریال',
                },
              ]} />
            </AppleCard>
          </div>
        </div>
      )
    }}</Status>
  )
}

export function InvoicePage({ p }) {
  const { isDark } = useAppearance()
  const [step, setStep] = useState('10000000')
  const bandsApi = useApi('/invoice-bands', { ...p, step })
  const linesApi = useApi('/invoice-lines', p)

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5">
      <Status state={bandsApi}>{(j) => {
        const lines = linesApi.data
        const totalInvoices = j.total_invoices || 0
        const totalRial = j.total_rial || 0
        const avgInvoice = totalInvoices > 0 ? Math.round(totalRial / totalInvoices) : 0

        return (
          <>
            {/* 6 Unified Symmetrical Apple Bento KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3.5 w-full">
              <AppleKpiCard label="تعداد فاکتور فروش" value={fa(totalInvoices)} unit="فقره فاکتور صادرشده" icon={FileText} tone="blue" />
              <AppleKpiCard label="جمع فروش فاکتورها" value={rial(totalRial)} unit={`${billions(totalRial).toFixed(1)} میلیارد ریال`} icon={CircleDollarSign} tone="teal" />
              <AppleKpiCard label="میانگین هر فاکتور" value={avgInvoice ? rial(avgInvoice) : '—'} unit="ریال به ازای هر خرید" icon={TrendingUp} tone="green" />
              <AppleKpiCard label="تعداد سطر فاکتور" value={lines ? fa(lines.total_lines) : '…'} unit="سطر بدون پروموشن و مرجوعی" icon={Layers} tone="amber" />
              <AppleKpiCard label="میانگین سطر هر فاکتور" value={lines ? fa2(lines.avg_lines_per_invoice) : '…'} unit="قلم کالا در هر سبد خرید" icon={Package} tone="teal" />
              <AppleKpiCard label="میانگین ریال هر سطر" value={lines?.avg_rial_per_line != null ? rial(lines.avg_rial_per_line) : '…'} unit="ریال به ازای هر سطر" icon={BarChart3} tone="green" />
            </div>

            {/* Comparison with same day last month (Executive Bento Cards) */}
            <InvoiceCompare p={p} />

            {/* Invoice Lines Section (Distribution Chart + 2 Tables) */}
            <InvoiceLinesSection p={p} linesState={linesApi} />

            {/* Invoice Bands Section */}
            <AppleCard
              title="تحلیل بازه‌های مبلغی فاکتور"
              subtitle="توزیع تعداد و سهم فروش عادی فاکتورها در پله‌های مختلف ریالی"
              badge="بازه مبالغ"
              action={
                <div className={`flex items-center gap-1.5 p-1 rounded-xl flex-wrap ${isDark ? 'bg-black/30' : 'bg-slate-100'}`}>
                  <span className={`text-[11px] px-2 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>عرض بازه:</span>
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
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        step === v
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
                          : isDark ? 'text-slate-300 hover:text-white hover:bg-white/5' : 'text-slate-700 hover:bg-white'
                      }`}
                    >
                      {l} ریال
                    </button>
                  ))}
                </div>
              }
            >
              <Table name="بازه-فاکتور" rows={j.bands} pageSize={50} columns={[
                {
                  label: 'بازه ریالی فاکتور',
                  render: (b) => (
                    <span className={`font-mono text-xs tabular-nums font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {rial(b.from_rial)} تا {rial(b.to_rial)} ریال
                    </span>
                  ),
                  value: (b) => b.from_rial,
                },
                {
                  label: 'تعداد فاکتور',
                  render: (b) => <span className="tabular-nums font-bold">{fa(b.invoices)}</span>,
                  value: (b) => b.invoices,
                },
                {
                  label: 'سهم از فاکتورها',
                  render: (b) => (
                    <div className="flex items-center gap-2 min-w-[90px]">
                      <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-400"
                          style={{ width: `${Math.min(100, Math.max(4, b.invoice_share * 100))}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold tabular-nums min-w-[34px] text-left">
                        {pct(b.invoice_share, 1)}
                      </span>
                    </div>
                  ),
                  value: (b) => b.invoice_share * 100,
                  unit: '٪',
                },
                {
                  label: 'سهم تجمعی فاکتور',
                  render: (b) => (
                    <span className={`tabular-nums font-bold text-xs px-2 py-0.5 rounded-md ${
                      isDark ? 'bg-sky-500/10 text-sky-300' : 'bg-sky-50 text-sky-700'
                    }`}>
                      {pct(b.cum_invoice_share, 1)}
                    </span>
                  ),
                  value: (b) => b.cum_invoice_share * 100,
                  unit: '٪',
                },
                {
                  label: 'مبلغ فروش',
                  render: (b) => (
                    <div className="flex flex-col">
                      <span className={`tabular-nums font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{rial(b.sales_rial)}</span>
                      <span className={`text-[10px] tabular-nums font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {billions(b.sales_rial).toFixed(1)} م.ر
                      </span>
                    </div>
                  ),
                  value: (b) => b.sales_rial,
                  unit: 'ریال',
                },
                {
                  label: 'سهم از کل فروش',
                  render: (b) => (
                    <div className="flex items-center gap-2 min-w-[90px]">
                      <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                          style={{ width: `${Math.min(100, Math.max(4, b.sales_share * 100))}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold tabular-nums min-w-[34px] text-left">
                        {pct(b.sales_share, 1)}
                      </span>
                    </div>
                  ),
                  value: (b) => b.sales_share * 100,
                  unit: '٪',
                },
                {
                  label: 'سهم تجمعی فروش',
                  render: (b) => (
                    <span className={`tabular-nums font-bold text-xs px-2 py-0.5 rounded-md ${
                      isDark ? 'bg-teal-500/10 text-teal-300' : 'bg-teal-50 text-teal-700'
                    }`}>
                      {pct(b.cum_sales_share, 1)}
                    </span>
                  ),
                  value: (b) => b.cum_sales_share * 100,
                  unit: '٪',
                },
              ]} />
            </AppleCard>
          </>
        )
      }}</Status>
    </div>
  )
}

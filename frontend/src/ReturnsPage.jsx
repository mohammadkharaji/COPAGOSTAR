import { useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CircleAlert, CircleMinus, ExternalLink, Info, Undo2, CircleDollarSign, Calendar, Users, FileText } from 'lucide-react'
import { motion } from 'motion/react'
import { useApi } from './api'
import { fa, monthName } from './format'
import { ChartTip, Table, pct, rial } from './ui'

/* برگشتی حواله پخش: داده از فایل حواله می‌آید و با ردیف‌های مرجوعی داخل فروش (SR) جمع نمی‌شود. */

const PAGE_SIZE = 50
const VIEWS = [['month', 'ماه'], ['branch', 'شعبه'], ['reason', 'علت برگشت']]
const STATUS = {
  full: { label: 'برگشتی کامل', Icon: CircleAlert, color: '#dc2626' },
  partial: { label: 'برگشتی جزئی', Icon: CircleMinus, color: '#d97706' },
}
const IGNORED_LABELS = { sales_type: 'کانال فروش', region: 'منطقه', state: 'منطقه شهرداری', city: 'شهر', brand: 'برند', group: 'لاین', grade: 'گرید مشتری', main_group: 'گروه کالای اصلی', sub_group: 'زیرگروه کالای اصلی' }
const SCOPE_LABELS = { customer: 'مشتری', visitor: 'ویزیتور' }

export const returnsArg = (by, keys) => `${by}~${[].concat(keys).join('|')}`
function parseScope(arg) {
  const i = (arg ?? '').indexOf('~')
  if (i < 1) return null
  const by = arg.slice(0, i)
  const keys = arg.slice(i + 1).split('|').filter(Boolean)
  return SCOPE_LABELS[by] && keys.length ? { by, keys } : null
}

function AppleCard({ title, subtitle, badge, action, children, className = '' }) {
  return (
    <div className={`rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 ${className}`}>
      {(title || subtitle || badge || action) && (
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
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

function AppleKpiCard({ label, value, unit, icon: Icon, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-500/10 text-blue-600',
    teal: 'bg-teal-500/10 text-teal-600',
    amber: 'bg-amber-500/10 text-amber-600',
    violet: 'bg-violet-500/10 text-violet-600',
    pink: 'bg-pink-500/10 text-pink-600',
    red: 'bg-rose-500/10 text-rose-600',
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

function StatusBadge({ s }) {
  const m = STATUS[s]
  if (!m) return <span className="text-xs text-[#86868B]">بدون برگشتی</span>
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
      s === 'full' ? 'bg-rose-500/15 text-rose-700' : 'bg-amber-500/15 text-amber-700'
    }`}>
      <m.Icon size={12} aria-hidden="true" />
      <span>{m.label}</span>
    </span>
  )
}

function Note({ children, tone }) {
  const isErr = tone === 'err'
  return (
    <div className={`rounded-2xl p-4 text-xs font-medium flex items-center gap-2.5 flex-wrap ${
      isErr ? 'bg-rose-500/10 border border-rose-500/20 text-rose-800' : 'bg-[#0071E3]/10 border border-[#0071E3]/20 text-[#0071E3]'
    }`} role={isErr ? 'alert' : 'status'}>
      <Info size={16} aria-hidden="true" className="shrink-0" />
      <div className="flex-1 flex items-center gap-2 flex-wrap">{children}</div>
    </div>
  )
}

const orderCols = (extra = []) => [
  { label: 'تاریخ', render: (r) => r.order_date ?? '—', value: (r) => String(r.order_date ?? '') },
  { label: 'شعبه', render: (r) => r.branch ?? '—', value: (r) => String(r.branch ?? '') },
  { label: 'شماره حواله', render: (r) => <span dir="ltr">{r.dispatch_no ?? '—'}</span>, value: (r) => String(r.dispatch_no ?? '') },
  ...extra,
  { label: 'مبلغ حواله (ریال)', render: (r) => <span className="tabular-nums">{rial(r.order_rial)}</span>, value: (r) => r.order_rial },
  { label: 'مبلغ برگشتی (ریال)', render: (r) => <span className="tabular-nums font-bold text-rose-700">{rial(r.return_rial)}</span>, value: (r) => r.return_rial },
  { label: 'وضعیت', render: (r) => <StatusBadge s={r.status} />, value: (r) => STATUS[r.status]?.label ?? 'بدون برگشتی' },
  { label: 'علت برگشت', render: (r) => r.reason ?? 'نامشخص', value: (r) => String(r.reason ?? 'نامشخص') },
]
const customerCol = { label: 'مشتری', render: (r) => (r.customer_code ? `${r.customer_code} · ${r.customer_name ?? ''}` : '—'), value: (r) => `${r.customer_code ?? ''} ${r.customer_name ?? ''}` }

const PIE_COLORS = ['#ef4444', '#0071E3', '#f59e0b', '#0f766e', '#8b5cf6', '#0ea5e9', '#ec4899', '#84cc16', '#94a3b8']

function ReturnPie({ rows, nameKey, labelFn = (v) => String(v ?? '—'), selected = '', onPick }) {
  const data = rows.map((r) => ({ name: labelFn(r[nameKey]), value: r.return_rial ?? 0, raw: r[nameKey] })).filter((r) => r.value > 0)
  const total = data.reduce((sum, r) => sum + r.value, 0)
  const share = (v) => (total ? `${pct(v / total)}` : '—')
  const colorOf = (i) => PIE_COLORS[i % PIE_COLORS.length]

  return (
    <div className="space-y-4">
      <div className="h-64 w-full" dir="ltr" role="img" aria-label="نمودار سهم از مبلغ برگشتی">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="82%"
              paddingAngle={2}
              stroke="none"
              onClick={(d) => { const v = d?.payload?.raw ?? d?.raw; if (v != null && v !== '') onPick?.(v) }}
              style={{ cursor: onPick ? 'pointer' : 'default' }}
            >
              {data.map((d, i) => <Cell key={i} fill={colorOf(i)} opacity={selected && d.raw !== selected ? 0.35 : 1} />)}
            </Pie>
            <Tooltip content={<ChartTip labelFn={(v) => `${v} · ${share(data.find((d) => d.name === v)?.value ?? 0)}`} unit="ریال" />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {onPick && (
        <div className="flex flex-wrap gap-2 pt-2">
          {data.map((d, i) => (
            <button
              key={d.raw ?? i}
              type="button"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                selected === d.raw ? 'bg-[#0071E3]/15 border-[#0071E3]/30 text-[#0071E3]' : 'bg-[#F5F5F7] border-black/[0.04] text-[#1D1D1F] hover:bg-[#E8E8ED]'
              }`}
              onClick={() => onPick(selected === d.raw ? '' : d.raw)}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorOf(i) }} />
              <span>{d.name}</span>
              <span className="tabular-nums font-bold">({share(d.value)})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const aggCols = (first) => [
  first,
  { label: 'تعداد حواله', render: (r) => fa(r.orders), value: (r) => r.orders },
  { label: 'حواله برگشتی', render: (r) => fa(r.returned_orders), value: (r) => r.returned_orders },
  { label: 'مبلغ حواله (ریال)', render: (r) => rial(r.order_rial), value: (r) => r.order_rial },
  { label: 'مبلغ برگشتی (ریال)', render: (r) => <span className="font-bold text-rose-700">{rial(r.return_rial)}</span>, value: (r) => r.return_rial },
  { label: 'درصد برگشتی', render: (r) => <span className="font-bold text-amber-700">{pct(r.return_percent, 2)}</span>, value: (r) => r.return_percent * 100, unit: '٪' },
]

function ViewPanel({ view, s, reason, setReason }) {
  if (view === 'month') {
    return (
      <div className="space-y-4">
        <ReturnPie rows={s.months} nameKey="year_month" labelFn={monthName} />
        <Table name="برگشتی-ماهانه" rows={s.months} columns={aggCols({ label: 'ماه', render: (r) => monthName(r.year_month), value: (r) => r.year_month })} />
      </div>
    )
  }
  if (view === 'branch') {
    return (
      <div className="space-y-4">
        <ReturnPie rows={s.branches} nameKey="branch" />
        <Table name="برگشتی-شعبه" rows={s.branches} columns={aggCols({ label: 'شعبه', render: (r) => r.branch ?? '—', value: (r) => String(r.branch ?? '') })} />
      </div>
    )
  }
  const total = s.total.return_rial
  return (
    <div className="space-y-4">
      <ReturnPie rows={s.reasons} nameKey="reason" selected={reason} onPick={(v) => setReason(v)} />
      <Table name="برگشتی-علت" rows={s.reasons} highlight={(r) => r.reason === reason} onRow={(r) => setReason(reason === r.reason ? '' : r.reason)} columns={[
        { label: 'علت برگشت', render: (r) => r.reason, value: (r) => String(r.reason) },
        { label: 'تعداد حواله', render: (r) => fa(r.orders), value: (r) => r.orders },
        { label: 'مبلغ برگشتی (ریال)', render: (r) => <span className="font-bold text-rose-700">{rial(r.return_rial)}</span>, value: (r) => r.return_rial },
        { label: 'سهم از کل برگشتی', render: (r) => (total ? pct(r.return_rial / total, 1) : '—'), value: (r) => (total ? (r.return_rial / total) * 100 : 0), unit: '٪' },
      ]} />
    </div>
  )
}

function ReturnsTable({ q, openCustomer }) {
  const [page, setPage] = useState(0)
  const r = useApi('/returns/list', { ...q, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
  return (
    <div className="space-y-4">
      {r.error && <div className="banner err" role="alert">دریافت داده ناموفق بود.</div>}
      {r.loading && !r.data && <div className="text-center py-8 text-xs text-[#86868B]">در حال بارگذاری…</div>}
      {r.data && (() => {
        const j = r.data
        if (j.available === false) return <div className="text-center py-8 text-xs text-[#86868B]" role="status">{j.reason}</div>
        const pages = Math.max(1, Math.ceil(j.count / PAGE_SIZE))
        return (
          <>
            <Table name="برگشتی-حواله" rows={j.rows} onRow={openCustomer ? (x) => x.customer_code && openCustomer(x.customer_code) : undefined}
              columns={orderCols([customerCol, { label: 'ویزیتور', render: (x) => x.visitor ?? '—', value: (x) => String(x.visitor ?? '') }])} />
            {j.count > 0 && (
              <div className="flex items-center justify-between pt-3 border-t border-black/[0.04]">
                <button className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-black/[0.05] hover:bg-black/[0.08] text-[#1D1D1F] disabled:opacity-40" type="button" disabled={page === 0 || r.loading} onClick={() => setPage((n) => n - 1)}>صفحهٔ قبل</button>
                <span className="text-xs text-[#86868B]" role="status" aria-live="polite">صفحهٔ {fa(page + 1)} از {fa(pages)} · {fa(j.count)} حواله</span>
                <button className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-black/[0.05] hover:bg-black/[0.08] text-[#1D1D1F] disabled:opacity-40" type="button" disabled={page + 1 >= pages || r.loading} onClick={() => setPage((n) => n + 1)}>صفحهٔ بعد</button>
              </div>
            )}
          </>
        )
      })()}
    </div>
  )
}

export function ReturnsPage({ p, arg, setArg, openCustomer, onReason }) {
  const [view, setView] = useState('month')
  const reason = p.reason ?? ''
  const setReason = (v) => onReason?.(v || null)
  const [status, setStatus] = useState('')
  const scope = useMemo(() => parseScope(arg), [arg])
  const q = { ...p, ...(scope && { [scope.by]: scope.keys }), ...(status && { status }) }
  const sum = useApi('/returns/summary', q)
  const lastOptions = useRef({})
  if (sum.data?.options) lastOptions.current = sum.data.options
  const reasons = lastOptions.current.reason ?? []

  return (
    <div className="w-full max-w-[1600px] mx-auto px-6 space-y-6">
      {/* Apple Floating Glass Filter Bar */}
      <div className="rounded-[24px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#86868B]">علت برگشت:</span>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3 py-1.5 text-xs text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/25"
            >
              <option value="">همه علت‌ها</option>
              {reasons.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#86868B]">وضعیت برگشت:</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3 py-1.5 text-xs text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/25"
            >
              <option value="">همه وضعیت‌ها</option>
              <option value="full">برگشتی کامل</option>
              <option value="partial">برگشتی جزئی</option>
            </select>
          </div>
          {(reason || status) && (
            <button
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-3 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 transition-colors"
              type="button"
              onClick={() => { setReason(''); setStatus('') }}
            >
              پاک کردن فیلترها
            </button>
          )}
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#0071E3]/10 text-[#0071E3]">
          حواله‌های پخش
        </span>
      </div>

      {scope && (
        <Note>
          <span>فقط حواله‌های {SCOPE_LABELS[scope.by]}: <b dir="auto">{scope.keys.join('، ')}</b></span>
          <button className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/70 hover:bg-white text-[#1D1D1F] mr-auto transition-colors" type="button" onClick={() => setArg('')}>حذف محدودیت</button>
        </Note>
      )}

      {sum.error && <div className="banner err" role="alert">دریافت خلاصه برگشتی ناموفق بود.</div>}
      {sum.loading && !sum.data && <div className="banner">در حال بارگذاری…</div>}
      {sum.data && (() => {
        const s = sum.data
        if (s.available === false) return <Note>{s.reason}</Note>
        const t = s.total
        const ignored = (s.ignored_filters ?? []).map((k) => IGNORED_LABELS[k] ?? k)
        return (
          <>
            {ignored.length > 0 && <Note>فیلتر {ignored.join('، ')} روی حواله پخش قابل اعمال نیست و نادیده گرفته شد.</Note>}
            {s.quality?.negative_return_orders > 0 && <Note tone="err">{fa(s.quality.negative_return_orders)} حواله مبلغ برگشتی منفی دارد؛ جمع‌ها را با احتیاط بخوانید.</Note>}
            {!t.orders ? <AppleCard><div className="text-center py-10 text-xs text-[#86868B]" role="status">برای این فیلترها حواله‌ای وجود ندارد.</div></AppleCard> : (
              <>
                {/* 4 Apple Bento KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                  <AppleKpiCard label="تعداد حواله کل" value={fa(t.orders)} unit="حواله صادرشده" icon={FileText} tone="blue" />
                  <AppleKpiCard label="حواله‌های برگشتی" value={fa(t.returned_orders)} unit={`${pct(t.returned_order_percent, 2)} از کل حواله‌ها`} icon={Undo2} tone="red" />
                  <AppleKpiCard label="مبلغ کل برگشتی" value={rial(t.return_rial)} unit="ریال" icon={CircleDollarSign} tone="amber" />
                  <AppleKpiCard label="درصد مبلغ برگشتی" value={pct(t.return_percent, 2)} unit={`مشتریان دارای برگشت: ${fa(t.returned_customers)}`} icon={Users} tone="violet" />
                </div>

                {/* Analysis Bento Card */}
                <AppleCard
                  title="تحلیل ابعادی برگشتی حواله"
                  subtitle="مبلغ برگشتی بر اساس بعد انتخابی · ریال"
                  badge={VIEWS.find(([k]) => k === view)?.[1]}
                  action={
                    <div className="flex items-center gap-1 p-1 bg-[#E8E8ED]/80 rounded-2xl flex-wrap">
                      {VIEWS.map(([k, label]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setView(k)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            view === k ? 'bg-[#0071E3] text-white shadow-sm' : 'text-[#1D1D1F] hover:bg-black/[0.05]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  }
                >
                  <ViewPanel view={view} s={s} reason={reason} setReason={setReason} />
                </AppleCard>

                {/* Top Return Customers and Visitors */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full items-start">
                  {scope?.by !== 'customer' && s.customers.length > 0 && (
                    <AppleCard title="مشتریان با بیشترین برگشتی" subtitle="۱۵ مشتری برتر بر اساس مبلغ برگشتی">
                      <Table name="برگشتی-مشتریان" rows={s.customers} onRow={openCustomer ? (x) => x.code && openCustomer(x.code) : undefined}
                        columns={aggCols({ label: 'مشتری', render: (x) => `${x.code} · ${x.name ?? ''}`, value: (x) => `${x.code} ${x.name ?? ''}` })} />
                    </AppleCard>
                  )}
                  {scope?.by !== 'visitor' && s.visitors.length > 0 && (
                    <AppleCard title="ویزیتورها" subtitle="۱۵ ویزیتور برتر بر پایهٔ نام ویزیتور">
                      <Table name="برگشتی-ویزیتورها" rows={s.visitors} columns={aggCols({ label: 'ویزیتور', render: (x) => x.visitor, value: (x) => String(x.visitor) })} />
                    </AppleCard>
                  )}
                </div>
              </>
            )}
          </>
        )
      })()}

      <AppleCard title="فهرست حواله‌های برگشتی" subtitle="جدیدترین حواله‌ها اول">
        <ReturnsTable key={JSON.stringify(q)} q={q} openCustomer={openCustomer} />
      </AppleCard>
    </div>
  )
}

/* کارت برگشتی در پروفایل مشتری و ویزیتور؛ data همان فیلد dispatch_returns پاسخ API است. */
export function ReturnsProfileCard({ data, onOpen, entity }) {
  const title = 'برگشتی حواله پخش'
  const activeReason = new URLSearchParams(location.hash.split('?')[1] || '').get('reason') || ''
  if (!data?.available) {
    return (
      <AppleCard title={title}>
        <div className="text-center py-8 text-xs text-[#86868B]" role="status">داده برگشتی حواله هنوز بارگذاری نشده است.</div>
      </AppleCard>
    )
  }
  const t = data.total
  const ambiguous = data.ambiguous_names ?? []
  return (
    <AppleCard
      title={title}
      subtitle={activeReason ? `فیلتر علت: ${activeReason} · مستقل از ردیف‌های مرجوعی فروش (SR)` : `مستقل از ردیف‌های مرجوعی فروش (SR)`}
      action={
        onOpen && (
          <button
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-sm shadow-blue-500/25 transition-all"
            type="button"
            onClick={onOpen}
          >
            <ExternalLink size={13} />
            <span>مشاهده در گزارش برگشتی</span>
          </button>
        )
      }
    >
      {data.note && <Note>{data.note}</Note>}
      {ambiguous.length > 0 && <Note tone="err">نام‌های مشترک بین چند کد ویزیتور در مجموع نیامده‌اند: {ambiguous.join('، ')}</Note>}
      {!t.orders ? <div className="text-center py-8 text-xs text-[#86868B]" role="status">برای این {entity} حواله‌ای ثبت نشده است.</div> : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            <AppleKpiCard label="تعداد حواله" value={fa(t.orders)} unit="حواله" icon={FileText} tone="blue" />
            <AppleKpiCard label="حواله برگشتی" value={fa(t.returned_orders)} unit={`${pct(t.returned_order_percent, 2)} از حواله‌ها`} icon={Undo2} tone="red" />
            <AppleKpiCard label="مبلغ برگشتی" value={rial(t.return_rial)} unit="ریال" icon={CircleDollarSign} tone="amber" />
            <AppleKpiCard label="درصد برگشتی" value={pct(t.return_percent, 2)} unit="مبلغ برگشتی ÷ مبلغ حواله" icon={Users} tone="teal" />
          </div>
          {data.reasons?.length > 0 && (
            <Table name="برگشتی-علت‌ها" rows={data.reasons} columns={[
              { label: 'علت برگشت', render: (r) => r.reason, value: (r) => String(r.reason) },
              { label: 'تعداد حواله', render: (r) => fa(r.orders), value: (r) => r.orders },
              { label: 'مبلغ برگشتی (ریال)', render: (r) => <span className="font-bold text-rose-700">{rial(r.return_rial)}</span>, value: (r) => r.return_rial },
            ]} />
          )}
          {data.recent?.length > 0 && (
            <div className="pt-2">
              <h3 className="text-xs font-bold text-[#1D1D1F] mb-2">آخرین حواله‌های برگشتی</h3>
              <Table name="برگشتی-اخیر" rows={data.recent} columns={orderCols()} />
            </div>
          )}
        </div>
      )}
    </AppleCard>
  )
}

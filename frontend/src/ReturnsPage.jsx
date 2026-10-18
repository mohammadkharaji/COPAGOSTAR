import { useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CircleAlert, CircleMinus, ExternalLink, Info } from 'lucide-react'
import { useApi } from './api'
import { fa, monthName } from './format'
import { ChartTip, Kpi, Panel, Status, Table, Toggle, pct, rial } from './ui'

/* برگشتی حواله پخش: داده از فایل حواله می‌آید و با ردیف‌های مرجوعی داخل فروش (SR) جمع نمی‌شود. */

const PAGE_SIZE = 50
const VIEWS = [['month', 'ماه'], ['branch', 'شعبه'], ['reason', 'علت برگشت']]
const STATUS = {
  full: { label: 'برگشتی کامل', Icon: CircleAlert, color: 'var(--neg)' },
  partial: { label: 'برگشتی جزئی', Icon: CircleMinus, color: 'var(--saffron-deep)' },
}
const IGNORED_LABELS = { sales_type: 'کانال فروش', region: 'منطقه', state: 'منطقه شهرداری', city: 'شهر', brand: 'برند', group: 'لاین', grade: 'گرید مشتری', main_group: 'گروه کالای اصلی', sub_group: 'زیرگروه کالای اصلی' }
const SCOPE_LABELS = { customer: 'مشتری', visitor: 'ویزیتور' }

// arg format: "customer~<code>" or "visitor~<name1>|<name2>" (the returns file carries visitor names, not codes).
export const returnsArg = (by, keys) => `${by}~${[].concat(keys).join('|')}`
function parseScope(arg) {
  const i = (arg ?? '').indexOf('~')
  if (i < 1) return null
  const by = arg.slice(0, i)
  const keys = arg.slice(i + 1).split('|').filter(Boolean)
  return SCOPE_LABELS[by] && keys.length ? { by, keys } : null
}

function StatusBadge({ s }) {
  const m = STATUS[s]
  if (!m) return <span>بدون برگشتی</span>
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: m.color, fontWeight: 700 }}><m.Icon size={14} aria-hidden="true" />{m.label}</span>
}

function Note({ children, tone }) {
  return <div className={`banner ${tone ?? ''}`} role={tone === 'err' ? 'alert' : 'status'} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><Info size={15} aria-hidden="true" />{children}</div>
}

const orderCols = (extra = []) => [
  { label: 'تاریخ', render: (r) => r.order_date ?? '—', value: (r) => String(r.order_date ?? '') },
  { label: 'شعبه', render: (r) => r.branch ?? '—', value: (r) => String(r.branch ?? '') },
  { label: 'شماره حواله', render: (r) => r.dispatch_no ?? '—', value: (r) => String(r.dispatch_no ?? '') },
  ...extra,
  { label: 'مبلغ حواله (ریال)', render: (r) => rial(r.order_rial), value: (r) => r.order_rial },
  { label: 'مبلغ برگشتی (ریال)', render: (r) => rial(r.return_rial), value: (r) => r.return_rial },
  { label: 'وضعیت', render: (r) => <StatusBadge s={r.status} />, value: (r) => STATUS[r.status]?.label ?? 'بدون برگشتی' },
  { label: 'علت برگشت', render: (r) => r.reason ?? 'نامشخص', value: (r) => String(r.reason ?? 'نامشخص') },
]
const customerCol = { label: 'مشتری', render: (r) => (r.customer_code ? `${r.customer_code} · ${r.customer_name ?? ''}` : '—'), value: (r) => `${r.customer_code ?? ''} ${r.customer_name ?? ''}` }

function ReturnBars({ rows, x, tickFn }) {
  const data = rows.map((r) => ({ ...r, value: (r.return_rial ?? 0) / 1e6 }))
  const many = data.length > 8
  return (
    <div className="chart" role="img" aria-label="نمودار مبلغ برگشتی">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey={x} reversed tickFormatter={tickFn} tickLine={false} axisLine={false} interval={0} angle={many ? -35 : 0} textAnchor={many ? 'end' : 'middle'} height={many ? 70 : 30} />
          <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={64} />
          <Tooltip content={<ChartTip labelFn={tickFn} unit="میلیون ریال" />} cursor={{ fill: 'rgba(16,37,63,.05)' }} />
          <Bar dataKey="value" name="مبلغ برگشتی" fill="var(--neg)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const aggCols = (first) => [
  first,
  { label: 'تعداد حواله', render: (r) => fa(r.orders), value: (r) => r.orders },
  { label: 'حواله برگشتی', render: (r) => fa(r.returned_orders), value: (r) => r.returned_orders },
  { label: 'مبلغ حواله (ریال)', render: (r) => rial(r.order_rial), value: (r) => r.order_rial },
  { label: 'مبلغ برگشتی (ریال)', render: (r) => rial(r.return_rial), value: (r) => r.return_rial },
  { label: 'درصد برگشتی', render: (r) => pct(r.return_percent, 2), value: (r) => r.return_percent * 100, unit: '٪' },
]

function ViewPanel({ view, s }) {
  if (view === 'month') {
    return (
      <>
        <ReturnBars rows={s.months} x="year_month" tickFn={monthName} />
        <Table name="برگشتی-ماهانه" rows={s.months} columns={aggCols({ label: 'ماه', render: (r) => monthName(r.year_month), value: (r) => r.year_month })} />
      </>
    )
  }
  if (view === 'branch') {
    return (
      <>
        <ReturnBars rows={s.branches} x="branch" tickFn={(v) => String(v ?? '—')} />
        <Table name="برگشتی-شعبه" rows={s.branches} columns={aggCols({ label: 'شعبه', render: (r) => r.branch ?? '—', value: (r) => String(r.branch ?? '') })} />
      </>
    )
  }
  const total = s.total.return_rial
  return (
    <>
      <ReturnBars rows={s.reasons} x="reason" tickFn={(v) => String(v)} />
      <Table name="برگشتی-علت" rows={s.reasons} columns={[
        { label: 'علت برگشت', render: (r) => r.reason, value: (r) => String(r.reason) },
        { label: 'تعداد حواله', render: (r) => fa(r.orders), value: (r) => r.orders },
        { label: 'مبلغ برگشتی (ریال)', render: (r) => rial(r.return_rial), value: (r) => r.return_rial },
        { label: 'سهم از کل برگشتی', render: (r) => (total ? pct(r.return_rial / total, 1) : '—'), value: (r) => (total ? (r.return_rial / total) * 100 : 0), unit: '٪' },
      ]} />
    </>
  )
}

function ReturnsTable({ q, openCustomer }) {
  const [page, setPage] = useState(0)
  const r = useApi('/returns/list', { ...q, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
  return (
    <Status state={r}>{(j) => {
      if (j.available === false) return <div className="empty" role="status">{j.reason}</div>
      const pages = Math.max(1, Math.ceil(j.count / PAGE_SIZE))
      return (
        <>
          <Table name="برگشتی-حواله" rows={j.rows} onRow={openCustomer ? (x) => x.customer_code && openCustomer(x.customer_code) : undefined}
            columns={orderCols([customerCol, { label: 'ویزیتور', render: (x) => x.visitor ?? '—', value: (x) => String(x.visitor ?? '') }])} />
          {j.count > 0 && (
            <div className="toolbar" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn ghost" type="button" disabled={page === 0 || r.loading} onClick={() => setPage((n) => n - 1)}>صفحهٔ قبل</button>
              <span className="tbl-count" role="status" aria-live="polite">صفحهٔ {fa(page + 1)} از {fa(pages)} · {fa(j.count)} حواله{r.loading ? ' · در حال بارگذاری…' : ''}</span>
              <button className="btn ghost" type="button" disabled={page + 1 >= pages || r.loading} onClick={() => setPage((n) => n + 1)}>صفحهٔ بعد</button>
            </div>
          )}
        </>
      )
    }}</Status>
  )
}

export function ReturnsPage({ p, arg, setArg, openCustomer }) {
  const [view, setView] = useState('month')
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState('')
  const scope = useMemo(() => parseScope(arg), [arg])
  const q = { ...p, ...(scope && { [scope.by]: scope.keys }), ...(reason && { reason }), ...(status && { status }) }
  const sum = useApi('/returns/summary', q)
  const lastOptions = useRef({})
  if (sum.data?.options) lastOptions.current = sum.data.options
  const reasons = lastOptions.current.reason ?? []
  return (
    <>
      <div className="toolbar">
        <label className="field">علت برگشت
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">همه</option>
            {reasons.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label className="field">وضعیت برگشت
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">همه</option>
            <option value="full">برگشتی کامل</option>
            <option value="partial">برگشتی جزئی</option>
          </select>
        </label>
        {(reason || status) && <button className="btn ghost" type="button" onClick={() => { setReason(''); setStatus('') }}>پاک کردن</button>}
      </div>
      {scope && (
        <Note>
          فقط حواله‌های {SCOPE_LABELS[scope.by]}: <b dir="auto">{scope.keys.join('، ')}</b>
          {scope.by === 'visitor' && ' (تطبیق بر پایهٔ نام ویزیتور؛ فایل حواله کد ویزیتور ندارد)'}
          <button className="btn ghost" type="button" onClick={() => setArg('')}>حذف این محدودیت</button>
        </Note>
      )}
      <Status state={sum}>{(s) => {
        if (s.available === false) return <Note>{s.reason}</Note>
        const t = s.total
        const ignored = (s.ignored_filters ?? []).map((k) => IGNORED_LABELS[k] ?? k)
        return (
          <>
            {ignored.length > 0 && <Note>فیلتر {ignored.join('، ')} روی حواله پخش قابل اعمال نیست و نادیده گرفته شد.</Note>}
            {s.quality?.negative_return_orders > 0 && <Note tone="err">{fa(s.quality.negative_return_orders)} حواله مبلغ برگشتی منفی دارد؛ جمع‌ها را با احتیاط بخوانید.</Note>}
            {!t.orders ? <div className="empty" role="status">برای این فیلترها حواله‌ای وجود ندارد.</div> : (
              <>
                <section className="kpis">
                  <Kpi label="تعداد حواله" value={fa(t.orders)} unit="حواله" />
                  <Kpi label="حواله برگشتی" value={fa(t.returned_orders)} unit={`${pct(t.returned_order_percent, 2)} از حواله‌ها`} tone="primary" />
                  <Kpi label="مبلغ برگشتی" value={rial(t.return_rial)} unit="ریال" />
                  <Kpi label="درصد برگشتی" value={pct(t.return_percent, 2)} unit="مبلغ برگشتی ÷ مبلغ حواله" tone="teal" />
                  <Kpi label="برگشتی کامل" value={fa(t.full_orders)} unit={`${rial(t.full_return_rial)} ریال`} />
                  <Kpi label="برگشتی جزئی" value={fa(t.partial_orders)} unit={`${rial(t.partial_return_rial)} ریال`} />
                  <Kpi label="مشتری دارای برگشتی" value={fa(t.returned_customers)} unit="مشتری یکتا" />
                </section>
                <section className="grid">
                  <Panel title="تحلیل برگشتی" note="مبلغ برگشتی (کامل + جزئی)، میلیون ریال" full>
                    <Toggle label="نمای گزارش برگشتی" value={view} onChange={setView} options={VIEWS} />
                    <ViewPanel view={view} s={s} />
                  </Panel>
                  {scope?.by !== 'customer' && s.customers.length > 0 && (
                    <Panel title="مشتریان با بیشترین برگشتی" note="۱۵ مشتری؛ برای دیدن پروفایل روی ردیف کلیک کنید" full>
                      <Table name="برگشتی-مشتریان" rows={s.customers} onRow={openCustomer ? (x) => openCustomer(x.code) : undefined}
                        columns={aggCols({ label: 'مشتری', render: (x) => `${x.code} · ${x.name ?? ''}`, value: (x) => `${x.code} ${x.name ?? ''}` })} />
                    </Panel>
                  )}
                  {scope?.by !== 'visitor' && s.visitors.length > 0 && (
                    <Panel title="ویزیتورها" note="۱۵ ویزیتور برتر؛ بر پایهٔ نام ویزیتور" full>
                      <Table name="برگشتی-ویزیتورها" rows={s.visitors} columns={aggCols({ label: 'ویزیتور', render: (x) => x.visitor, value: (x) => String(x.visitor) })} />
                    </Panel>
                  )}
                </section>
              </>
            )}
            <p className="tbl-count" style={{ margin: '8px 0 14px' }}>{s.method}</p>
          </>
        )
      }}</Status>
      <Panel title="فهرست حواله‌های برگشتی" note="جدیدترین حواله‌ها اول" full>
        <ReturnsTable key={JSON.stringify(q)} q={q} openCustomer={openCustomer} />
      </Panel>
    </>
  )
}

/* کارت برگشتی در پروفایل مشتری و ویزیتور؛ data همان فیلد dispatch_returns پاسخ API است. */
export function ReturnsProfileCard({ data, onOpen, entity }) {
  const title = 'برگشتی حواله پخش'
  if (!data?.available) {
    return <Panel title={title} full><div className="empty" role="status">داده برگشتی حواله هنوز بارگذاری نشده است.</div></Panel>
  }
  const t = data.total
  const ambiguous = data.ambiguous_names ?? []
  return (
    <Panel title={title} note={`مستقل از ردیف‌های مرجوعی فروش (SR)`} full>
      {data.note && <Note>{data.note}</Note>}
      {ambiguous.length > 0 && <Note tone="err">نام‌های مشترک بین چند کد ویزیتور در مجموع نیامده‌اند: {ambiguous.join('، ')}</Note>}
      {!t.orders ? <div className="empty" role="status">برای این {entity} حواله‌ای ثبت نشده است.</div> : (
        <>
          <section className="kpis">
            <Kpi label="تعداد حواله" value={fa(t.orders)} unit="حواله" />
            <Kpi label="حواله برگشتی" value={fa(t.returned_orders)} unit={`${pct(t.returned_order_percent, 2)} از حواله‌ها`} tone="primary" />
            <Kpi label="مبلغ برگشتی" value={rial(t.return_rial)} unit="ریال" />
            <Kpi label="درصد برگشتی" value={pct(t.return_percent, 2)} unit="مبلغ برگشتی ÷ مبلغ حواله" tone="teal" />
          </section>
          {data.reasons?.length > 0 && (
            <Table name="برگشتی-علت‌ها" rows={data.reasons} columns={[
              { label: 'علت برگشت', render: (r) => r.reason, value: (r) => String(r.reason) },
              { label: 'تعداد حواله', render: (r) => fa(r.orders), value: (r) => r.orders },
              { label: 'مبلغ برگشتی (ریال)', render: (r) => rial(r.return_rial), value: (r) => r.return_rial },
            ]} />
          )}
          {data.recent?.length > 0 && (
            <>
              <h3 style={{ margin: '14px 0 4px', fontSize: 14 }}>آخرین حواله‌های برگشتی</h3>
              <Table name="برگشتی-اخیر" rows={data.recent} columns={orderCols()} />
            </>
          )}
        </>
      )}
      {onOpen && (
        <div className="toolbar">
          <button className="btn" type="button" onClick={onOpen}><ExternalLink size={14} aria-hidden="true" style={{ verticalAlign: '-2px', marginInlineEnd: 6 }} />مشاهده در گزارش برگشتی</button>
        </div>
      )}
    </Panel>
  )
}

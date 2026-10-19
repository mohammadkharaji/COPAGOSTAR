import { useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApi } from './api'
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

/* ---------- نمودار کیکی سهم فروش ---------- */
const PIE_COLORS = ['#2563eb', '#0f766e', '#8b5cf6', '#f59e0b', '#ec4899', '#0ea5e9', '#84cc16', '#ef4444', '#94a3b8']
const PIE_OPTIONS = [['branch', 'شعبه'], ['region', 'منطقه'], ['brand', 'برند'], ['sales_type', 'کانال فروش'], ['group', 'لاین'], ['grade', 'گرید مشتری'], ['month', 'ماه']]

function SharePie({ p, defaultBy }) {
  const [by, setBy] = useState(defaultBy)
  const r = useApi('/breakdown', { ...p, by, limit: 40 })
  return (
    <Panel title="سهم از فروش (نمودار کیکی)" note="فقط مقادیر مثبت Rial+Vat؛ ۸ مورد برتر و بقیه در «سایر»" full>
      <Toggle label="بعد نمودار کیکی" value={by} onChange={setBy} options={PIE_OPTIONS} />
      <Status state={r}>{(rows) => {
        const pos = rows.filter((x) => x.sum_rial_vat > 0).sort((a, b) => b.sum_rial_vat - a.sum_rial_vat)
        const label = (x) => (by === 'month' ? monthLabel(String(x.key)) : String(x.key))
        const top = pos.slice(0, 8).map((x) => ({ name: label(x), value: x.sum_rial_vat }))
        const rest = pos.slice(8).reduce((s, x) => s + x.sum_rial_vat, 0)
        if (rest > 0) top.push({ name: 'سایر', value: rest })
        const total = top.reduce((s, x) => s + x.value, 0)
        if (!top.length) return <div className="empty">داده‌ای برای این فیلترها وجود ندارد.</div>
        return (
          <div className="chart tall" role="img" aria-label="نمودار کیکی سهم فروش">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={top} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="80%" paddingAngle={1}
                  label={(e) => pct(e.value / total, 1)}>
                  {top.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [`${fa(v)} ریال (${pct(v / total, 1)})`, n]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )
      }}</Status>
    </Panel>
  )
}

/* ---------- روند ماهانه ---------- */
export function MonthlyTrendPage({ p }) {
  const { month: _m, start: _s, end: _e, ...q } = p
  const m = useApi('/monthly', q)
  return (
    <Status state={m}>{(rows) => {
      const d = rows.map((r) => ({ ...r, gross: billions(r.sum_rial_vat), net: billions(r.net_rial) }))
      const total = rows.reduce((s, r) => s + r.sum_rial_vat, 0)
      const best = rows.reduce((a, r) => (r.sum_rial_vat > (a?.sum_rial_vat ?? -Infinity) ? r : a), null)
      return (
        <>
          <section className="kpis">
            <Kpi label="جمع فروش (Rial+Vat)" value={rial(total)} unit="ریال" tone="primary" />
            <Kpi label="تعداد ماه دارای فروش" value={fa(rows.length)} unit="ماه" />
            <Kpi label="میانگین فروش ماهانه" value={rows.length ? rial(total / rows.length) : '—'} unit="ریال" />
            <Kpi label="بهترین ماه" value={best ? monthName(best.year_month) : '—'} unit={best ? `${rial(best.sum_rial_vat)} ریال` : ''} tone="teal" />
          </section>
          <section className="grid">
            <Panel title="روند ماهانه فروش" note="Rial+Vat و ریال خالص، میلیارد ریال" full>
              <Bars data={d} x="year_month" tall tickFn={monthName} bars={[{ key: 'gross', name: 'Rial+Vat', color: 'var(--blue)' }, { key: 'net', name: 'ریال خالص', color: 'var(--teal)' }]} />
            </Panel>
            <Panel title="روند ماهانه تعداد فاکتور و مشتری فعال" full>
              <Bars data={rows} x="year_month" unit="" tickFn={monthName} bars={[{ key: 'invoice_count', name: 'تعداد فاکتور', color: 'var(--saffron-deep)' }, { key: 'active_customers', name: 'مشتری فعال', color: 'var(--sky)' }]} />
            </Panel>
            <SharePie p={q} defaultBy="month" />
            <Panel title="جدول ماهانه" full>
              <Table name="جدول-ماهانه" rows={rows} columns={[
                { label: 'ماه', render: (r) => monthName(r.year_month), value: (r) => r.year_month },
                { label: 'Sum of Rial+Vat', render: (r) => rial(r.sum_rial_vat), value: (r) => r.sum_rial_vat },
                { label: 'ریال خالص', render: (r) => rial(r.net_rial), value: (r) => r.net_rial },
                { label: 'تعداد فاکتور', render: (r) => fa(r.invoice_count), value: (r) => r.invoice_count },
                { label: 'درصد رشد فاکتور', render: (r) => pct(r.invoice_growth, 2), value: (r) => (r.invoice_growth == null ? '' : r.invoice_growth * 100), unit: '٪' },
                { label: 'مشتری فعال', render: (r) => fa(r.active_customers), value: (r) => r.active_customers },
                { label: 'درصد پروموشن کل', render: (r) => pct(r.promo_percent, 2), value: (r) => r.promo_percent * 100, unit: '٪' },
              ]} />
            </Panel>
          </section>
        </>
      )
    }}</Status>
  )
}

/* ---------- روند روزانه ---------- */
export function TrendPage({ p }) {
  const t = useApi('/trend', p)
  return (
    <Status state={t}>{(rows) => {
      const d = rows.map((r) => ({ ...r, gross: billions(r.sum_rial_vat) }))
      const total = rows.reduce((s, r) => s + r.sum_rial_vat, 0)
      const best = rows.reduce((a, r) => (r.sum_rial_vat > (a?.sum_rial_vat ?? -Infinity) ? r : a), null)
      return (
        <>
          <section className="kpis">
            <Kpi label="جمع فروش دوره" value={rial(total)} unit="ریال" tone="primary" />
            <Kpi label="تعداد روز دارای فروش" value={fa(rows.length)} unit="روز" />
            <Kpi label="میانگین فروش روزانه" value={rows.length ? rial(total / rows.length) : '—'} unit="ریال" />
            <Kpi label="بهترین روز" value={best ? dayLabel(best.date) : '—'} unit={best ? `${rial(best.sum_rial_vat)} ریال` : ''} tone="teal" />
          </section>
          <section className="grid">
            <Panel title="روند روزانه فروش" note="Rial+Vat" full>
              <div className="chart tall" role="img" aria-label="نمودار روند روزانه">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={d} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--line)" />
                    <XAxis dataKey="date" reversed tickFormatter={dayLabel} tickLine={false} axisLine={false} minTickGap={28} />
                    <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={64} />
                    <Tooltip content={<ChartTip labelFn={dayLabel} unit="میلیارد ریال" />} />
                    <Area type="monotone" dataKey="gross" name="Rial+Vat" stroke="var(--saffron-deep)" strokeWidth={2} fill="var(--saffron)" fillOpacity={0.25} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="تعداد مشتری فعال روزانه" note="مشتریان یکتا با خرید در همان روز" full>
              <div className="chart" role="img">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={d} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--line)" />
                    <XAxis dataKey="date" reversed tickFormatter={dayLabel} tickLine={false} axisLine={false} minTickGap={28} />
                    <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={64} />
                    <Tooltip content={<ChartTip labelFn={dayLabel} unit="مشتری" />} />
                    <Area type="monotone" dataKey="customers" name="مشتری" stroke="var(--teal)" strokeWidth={2} fill="var(--teal)" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <SharePie p={p} defaultBy="branch" />
          </section>
        </>
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
    <>
      <Toggle label="بعد گزارش" value={by} options={options} onChange={changeBy} />
      {sel && (
        <div className="toolbar" style={{ marginTop: 12 }}>
          <button type="button" className="btn" onClick={() => setSel(null)}>بازگشت به همهٔ {DIM_LABELS[sel.by]}‌ها</button>
          <b>{DIM_LABELS[sel.by]}: {sel.key}</b>
          <Toggle label="زیرشاخه" value={activeChild} onChange={setChildBy} options={children.map((k) => [k, `به تفکیک ${DIM_LABELS[k]}`])} />
          <button type="button" className="btn" onClick={() => openProfile(sel.by, sel.key)}>پروفایل کامل {sel.key}</button>
        </div>
      )}
      <Status state={r}>{(rows) => {
        const d = rows.slice(0, 20).map((x) => ({ ...x, gross: billions(x.sum_rial_vat) }))
        return (
          <section className="grid" style={{ marginTop: 16 }}>
            <Panel title={sel ? `${sel.key} — زیرشاخه‌ها به تفکیک ${DIM_LABELS[activeChild]}` : `${title} — ۲۰ مورد برتر`} note="Rial+Vat به میلیارد ریال" full>
              <Bars data={d} x="key" tall tickFn={(v) => String(v).slice(0, 14)} onBar={canDrill ? (b) => open(b?.payload?.key ?? b?.key) : undefined}
                bars={[{ key: 'gross', name: 'Rial+Vat', color: 'var(--sky)' }]} />
            </Panel>
            <Panel title={sel ? `جدول تفصیلی ${sel.key}` : 'جدول تفصیلی'}
              note={canDrill ? `${drill?.[by] ? `برای دیدن زیرشاخه‌ها روی ${DIM_LABELS[by]} کلیک کنید` : `برای دیدن پروفایل ${PROFILE_LABELS[by]} روی ردیف کلیک کنید`}. درصد تخفیف = PromisonRial ÷ فروش عادی؛ درصد مرجوعی = مرجوعی ÷ فروش عادی`
                : 'درصد تخفیف = PromisonRial ÷ فروش عادی؛ درصد مرجوعی = مرجوعی ÷ فروش عادی'} full>
              <Table name={sel ? `جدول-${sel.key}-${activeChild}` : `جدول-${by}`} rows={rows} columns={breakdownColumns(head)}
                onRow={canDrill ? (x) => open(x.key) : undefined} />
            </Panel>
          </section>
        )
      }}</Status>
    </>
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

/* ---------- پارتو ---------- */
const PARETO_NAMES = { customer: 'مشتری', product: 'کالا', visitor: 'ویزیتور', branch: 'شعبه', day: 'روز' }

export function ParetoPage({ p, openCustomer, openVisitor, openProfile }) {
  const [by, setBy] = useState('customer')
  const [th, setTh] = useState('0.8')
  const r = useApi('/pareto', { ...p, by, threshold: th })
  const rowOpen = by === 'customer' ? (x) => openCustomer(x.code) : by === 'visitor' ? (x) => openVisitor(x.code)
    : by === 'branch' ? (x) => openProfile('branch', x.code) : by === 'product' ? (x) => openProfile('product', x.name) : undefined
  return (
    <>
      <div className="toolbar">
        <Toggle label="بعد پارتو" value={by} onChange={setBy} options={Object.entries(PARETO_NAMES)} />
        <label className="field">پارامتر پارتو
          <select value={th} onChange={(e) => setTh(e.target.value)}>
            {['0.5', '0.7', '0.8', '0.9'].map((v) => <option key={v} value={v}>{pct(Number(v), 0)}</option>)}
          </select>
        </label>
      </div>
      <Status state={r}>{(j) => (
        <>
          <section className="kpis" style={{ marginTop: 16 }}>
            <Kpi label="جمع فروش عادی" value={rial(j.total_rial)} unit="ریال" tone="primary" />
            <Kpi label={`تعداد کل (${PARETO_NAMES[by]})`} value={fa(j.count)} unit="" />
            <Kpi label={`تعداد پارتو (تا ${pct(j.threshold, 0)} فروش)`} value={fa(j.pareto_count)} unit="" tone="teal" />
            <Kpi label="درصد تعداد پارتو" value={pct(j.pareto_count_percent, 1)} unit="از کل" />
          </section>
          <Panel title={`جدول پارتو ${PARETO_NAMES[by]}`} note={rowOpen ? `برای دیدن پروفایل، روی ${PARETO_NAMES[by]} کلیک کنید` : 'فقط فروش عادی؛ پروموشن و مرجوعی حذف است'} full>
            <Table name={`پارتو-${by}`} rows={j.items} highlight={(x) => x.rank <= j.pareto_count}
              onRow={rowOpen}
              columns={[
                { label: 'رتبه', render: (x) => fa(x.rank), value: (x) => x.rank },
                ...(by === 'day' || by === 'branch' ? [] : [{ label: 'کد', render: (x) => x.code, value: (x) => String(x.code) }]),
                { label: PARETO_NAMES[by], render: (x) => x.name, value: (x) => String(x.name ?? '') },
                { label: 'فروش (ریال)', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial },
                { label: 'سهم فروش', render: (x) => pct(x.share, 2), value: (x) => x.share * 100, unit: '٪' },
                { label: 'سهم تجمعی', render: (x) => pct(x.cum_share, 1), value: (x) => x.cum_share * 100, unit: '٪' },
              ]} />
          </Panel>
        </>
      )}</Status>
    </>
  )
}

/* ---------- مشتریان غیرفعال ---------- */
const INACTIVE_DAYS = [['30', '۳۰ روز'], ['45', '۴۵ روز'], ['60', '۶۰ روز'], ['90', '۹۰ روز']]

function ProfileLink({ onClick, children }) {
  return (
    <button type="button" className="th-sort" style={{ textDecoration: 'underline', textAlign: 'start' }}
      onClick={(e) => { e.stopPropagation(); onClick() }}>{children}</button>
  )
}

export function InactiveCustomersPage({ p, openCustomer, openVisitor }) {
  const [days, setDays] = useState('60')
  const { month: _m, start: _s, end: _e, v: _v, ...query } = p
  const r = useApi('/inactive-customers', { ...query, days, v: p.v })
  const exportQs = new URLSearchParams(Object.entries({ ...query, days }).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v ? [[k, v]] : []))).toString()
  return (
    <>
      <div className="toolbar">
        <Toggle label="بازه بدون خرید" value={days} onChange={setDays} options={INACTIVE_DAYS} />
        <a className="tbl-export" href={`/api/inactive-customers/export?${exportQs}`} download>خروجی Excel (xlsx)</a>
      </div>
      <Status state={r}>{(j) => {
        if (!j.available) return <div className="banner">{j.reason}</div>
        return (
          <>
            <section className="kpis" style={{ marginTop: 16 }}>
              <Kpi label="مشتری غیرفعال" value={fa(j.inactive_customers)} unit={`از ${fa(j.total_customers)} مشتری دارای سابقهٔ خرید`} tone="primary" />
              <Kpi label="درصد غیرفعال" value={pct(j.inactive_percent, 1)} unit="از مشتریان دارای سابقهٔ خرید" tone="teal" />
              <Kpi label="فروش قبلی این مشتریان" value={rial(j.lost_sales_rial)} unit="ریال · فروش عادی تا قبل از بازه" />
              <Kpi label="بازهٔ بررسی" value={`${fa(j.days)} روز`} unit={`${faDate(j.window_start.replace(/\//g, ''))} تا ${faDate(j.as_of.replace(/\//g, ''))}`} hint="نسبت به آخرین تاریخ دادهٔ بارگذاری‌شده، نه امروز" />
            </section>
            <Panel title="ویزیتورها با بیشترین مشتری غیرفعال" note="ویزیتور = آخرین ویزیتور خرید مشتری · فروش قبلی ریال" full>
              <Table name="غیرفعال-ویزیتور" rows={j.by_visitor} onRow={(x) => x.code && openVisitor(x.code)} columns={[
                { label: 'کد', render: (x) => x.code ?? '—', value: (x) => String(x.code ?? '') },
                { label: 'ویزیتور', render: (x) => x.name ?? '—', value: (x) => String(x.name ?? '') },
                { label: 'مشتری غیرفعال', render: (x) => fa(x.customers), value: (x) => x.customers },
                { label: 'فروش قبلی (ریال)', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial },
              ]} />
            </Panel>
            <Panel title="فهرست مشتریان غیرفعال" note="مرتب‌شده بر اساس فروش قبلی · با کلیک روی ردیف، پروفایل مشتری باز می‌شود" full>
              <Table name={`مشتریان-غیرفعال-${days}روز`} rows={j.items} onRow={(x) => openCustomer(x.code)} columns={[
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
            </Panel>
          </>
        )
      }}</Status>
    </>
  )
}

/* ---------- تحلیل فاکتور ---------- */
export function InvoicePage({ p }) {
  const [step, setStep] = useState('10000000')
  const r = useApi('/invoice-bands', { ...p, step })
  return (
    <>
      <Status state={r}>{(j) => {
        const d = j.bands.map((b) => ({ ...b, label: `${fa(b.from_rial / 1e6)}–${fa(b.to_rial / 1e6)}`, n: b.invoices }))
        return (
          <>
            <section className="kpis" style={{ marginTop: 16 }}>
              <Kpi label="تعداد فاکتور فروش" value={fa(j.total_invoices)} unit="فقره" tone="primary" />
              <Kpi label="جمع فروش فاکتورها" value={rial(j.total_rial)} unit="ریال" />
              <Kpi label="میانگین هر فاکتور" value={j.total_invoices ? rial(j.total_rial / j.total_invoices) : '—'} unit="ریال" tone="teal" />
            </section>
            <InvoiceLinesSection p={p} />
            <div className="toolbar" style={{ marginTop: 24 }}>
              <label className="field">عرض بازه فاکتور
                <select value={step} onChange={(e) => setStep(e.target.value)}>
                  {[['5000000', '۵ میلیون'], ['10000000', '۱۰ میلیون'], ['20000000', '۲۰ میلیون'], ['50000000', '۵۰ میلیون']].map(([v, l]) => <option key={v} value={v}>{l} ریال</option>)}
                </select>
              </label>
            </div>
            <Panel title="توزیع فاکتورها بر حسب مبلغ" note="محور افقی: میلیون ریال" full>
              <Bars data={d} x="label" tall unit="فاکتور" tickFn={(v) => v} bars={[{ key: 'n', name: 'تعداد فاکتور', color: 'var(--saffron-deep)' }]} />
            </Panel>
            <Panel title="جدول بازه‌های فاکتور" note="فقط فروش عادی؛ فاکتورهای با جمع منفی حذف است" full>
              <Table name="بازه-فاکتور" rows={j.bands} columns={[
                { label: 'از (ریال)', render: (b) => rial(b.from_rial), value: (b) => b.from_rial },
                { label: 'تا (ریال)', render: (b) => rial(b.to_rial), value: (b) => b.to_rial },
                { label: 'تعداد فاکتور', render: (b) => fa(b.invoices), value: (b) => b.invoices },
                { label: 'سهم از فاکتورها', render: (b) => pct(b.invoice_share, 1), value: (b) => b.invoice_share * 100, unit: '٪' },
                { label: 'سهم تجمعی فاکتور', render: (b) => pct(b.cum_invoice_share, 1), value: (b) => b.cum_invoice_share * 100, unit: '٪' },
                { label: 'فروش (ریال)', render: (b) => rial(b.sales_rial), value: (b) => b.sales_rial },
                { label: 'سهم از فروش', render: (b) => pct(b.sales_share, 1), value: (b) => b.sales_share * 100, unit: '٪' },
                { label: 'سهم تجمعی فروش', render: (b) => pct(b.cum_sales_share, 1), value: (b) => b.cum_sales_share * 100, unit: '٪' },
              ]} />
            </Panel>
          </>
        )
      }}</Status>
    </>
  )
}

function InvoiceLinesSection({ p }) {
  const r = useApi('/invoice-lines', p)
  return <Status state={r}>{(j) => {
    const buckets = j.buckets.map((b) => ({ ...b, label: b.open_ended ? `${fa(b.lines)}+` : fa(b.lines) }))
    return (
      <>
        <section className="kpis" style={{ marginTop: 24 }}>
          <Kpi label="تعداد سطر فاکتور" value={fa(j.total_lines)} unit="سطر" tone="primary" hint="ردیف‌های فروش عادی؛ بدون پروموشن و مرجوعی" />
          <Kpi label="میانگین سطر هر فاکتور" value={fa2(j.avg_lines_per_invoice)} unit="سطر در فاکتور" tone="teal" />
          <Kpi label="میانگین ریال هر سطر" value={j.avg_rial_per_line == null ? '—' : rial(j.avg_rial_per_line)} unit="ریال" />
        </section>
        <Panel title="توزیع فاکتورها بر حسب تعداد سطر" note="محور افقی: تعداد سطر در فاکتور" full>
          <Bars data={buckets} x="label" unit="فاکتور" tickFn={(v) => v} bars={[{ key: 'invoices', name: 'تعداد فاکتور', color: 'var(--saffron-deep)' }]} />
        </Panel>
        <Panel title="جدول سطر فاکتور" note="فقط فروش عادی؛ آخرین ردیف یعنی ۱۰ سطر یا بیشتر" full>
          <Table name="توزیع-سطر-فاکتور" rows={buckets} columns={[
            { label: 'تعداد سطر در فاکتور', render: (b) => b.label, value: (b) => b.lines },
            { label: 'تعداد فاکتور', render: (b) => fa(b.invoices), value: (b) => b.invoices },
            { label: 'جمع سطرها', render: (b) => fa(b.line_count), value: (b) => b.line_count },
            { label: 'سهم از فاکتورها', render: (b) => pct(b.invoice_share, 1), value: (b) => b.invoice_share * 100, unit: '٪' },
            { label: 'سهم تجمعی فاکتور', render: (b) => pct(b.cum_invoice_share, 1), value: (b) => b.cum_invoice_share * 100, unit: '٪' },
          ]} />
        </Panel>
        <Panel title="روند ماهانه سطر فاکتور" note="میانگین سطر هر فاکتور در هر ماه" full>
          <Table name="سطر-فاکتور-ماهانه" rows={j.months} columns={[
            { label: 'ماه', render: (m) => monthLabel(m.year_month), value: (m) => m.year_month },
            { label: 'تعداد فاکتور', render: (m) => fa(m.invoices), value: (m) => m.invoices },
            { label: 'تعداد سطر', render: (m) => fa(m.lines), value: (m) => m.lines },
            { label: 'میانگین سطر هر فاکتور', render: (m) => fa2(m.avg_lines_per_invoice), value: (m) => m.avg_lines_per_invoice ?? 0 },
            { label: 'فروش عادی (ریال)', render: (m) => rial(m.sales_rial), value: (m) => m.sales_rial },
          ]} />
        </Panel>
      </>
    )
  }}</Status>
}

/* ---------- پروفایل مشتری ---------- */
export function CustomerPage({ core, code, setCode, openReturns }) {
  const [draft, setDraft] = useState(code ?? '')
  const r = useApi(`/customer/${encodeURIComponent(code ?? '')}`, { core }, Boolean(code))
  return (
    <>
      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); setCode(draft.trim()) }}>
        <label className="field">کد مشتری
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="مثلاً Gol100101" dir="ltr" />
        </label>
        <button className="btn" type="submit">نمایش پروفایل</button>
      </form>
      {!code && <div className="empty">کد مشتری را وارد کنید یا از جدول پارتو یک مشتری را انتخاب کنید.</div>}
      {code && r.error && <div className="banner err" role="alert">مشتری با این کد پیدا نشد.</div>}
      {code && !r.error && <Status state={r}>{(j) => {
        const total = j.months.reduce((s, m) => s + m.sales_rial, 0)
        const invoices = j.months.reduce((s, m) => s + m.invoices, 0)
        const d = j.months.map((m) => ({ ...m, gross: billions(m.sales_rial) }))
        return (
          <>
            <section className="panel cust-head" style={{ marginTop: 16 }}>
              <div><span>نام مشتری</span><b>{j.name ?? '—'}</b></div>
              <div><span>نام فروشگاه</span><b>{j.sales_point ?? '—'}</b></div>
              <div><span>شعبه</span><b>{j.branch ?? '—'}</b></div>
              <div><span>ویزیتور</span><b>{j.visitor ?? '—'}</b></div>
              <div><span>گرید</span><b>{j.grade ?? '—'}</b></div>
              <div><span>منطقه / شهر</span><b>{[j.region, j.city].filter(Boolean).join(' / ') || '—'}</b></div>
            </section>
            <section className="kpis" style={{ marginTop: 16 }}>
              <Kpi label="جمع فروش (ریال)" value={rial(total)} unit="فروش عادی" tone="primary" />
              <Kpi label="تعداد فاکتور" value={fa(invoices)} unit="فقره" />
              <Kpi label="تاریخ آخرین خرید" value={j.last_purchase ?? '—'} unit="" tone="teal" />
            </section>
            <section className="grid">
              <Panel title="الگوی ماهانه خرید مشتری" note="میلیارد ریال" full>
                <Bars data={d} x="year_month" tickFn={monthName} bars={[{ key: 'gross', name: 'فروش', color: 'var(--blue)' }]} />
              </Panel>
              <Panel title="کالاهای خریداری‌شده" note="۱۵ کالای برتر" full>
                <Table name="کالاهای-مشتری" rows={j.products} columns={[
                  { label: 'کالا', render: (x) => x.name, value: (x) => String(x.name ?? '') },
                  { label: 'فروش (ریال)', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial },
                  { label: 'تعداد', render: (x) => fa(x.qty), value: (x) => x.qty }]} />
              </Panel>
              <Panel title="برندها" full>
                <Table name="برندهای-مشتری" rows={j.brands} columns={[
                  { label: 'برند', render: (x) => x.name, value: (x) => String(x.name ?? '') },
                  { label: 'فروش (ریال)', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial }]} />
              </Panel>
              <ReturnsProfileCard data={j.dispatch_returns} entity="مشتری" onOpen={() => openReturns(returnsArg('customer', code))} />
            </section>
          </>
        )
      }}</Status>}
    </>
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
  return <Status state={r}>{(j) => {
    const periods = j.periods ?? []
    const last = periods[periods.length - 1]
    const chart = periods.map((x) => ({ label: x.label, current: billions(x.sales_rial), previous: x.compare ? billions(x.compare.sales_rial) : null }))
    return (
      <>
        <div className="toolbar">
          <Toggle label="نوع دوره" value={kind} onChange={setKind} options={Object.entries(GROWTH_LABELS)} />
          {j.last_date && <span className="tbl-count">داده تا {j.last_date}</span>}
        </div>
        {!periods.length ? <div className="empty">دوره‌ای برای مقایسه وجود ندارد.</div> : <>
          <section className="grid" style={{ marginTop: 16 }}>
            <Panel title={`روند ${GROWTH_LABELS[kind]} فروش`} note="فروش عادی این دوره در برابر دورهٔ قبل" full>
              <Bars data={chart} x="label" tall tickFn={(v) => String(v).slice(0, 12)} bars={[
                { key: 'current', name: 'این دوره', color: 'var(--blue)' },
                { key: 'previous', name: 'دورهٔ قبل', color: 'var(--teal)' },
              ]} />
            </Panel>
            <Panel title="جدول رشد و افت" note="دورهٔ ناقص با هم‌بازهٔ قبلی مقایسه می‌شود" full>
              <Table name={`رشد-${kind}`} rows={periods} columns={[
                { label: 'دوره', render: (x) => `${x.label}${x.complete ? '' : ' (ناقص)'}`, value: (x) => x.key },
                { label: 'بازه', render: (x) => `${x.start} تا ${x.end}`, value: (x) => x.start },
                { label: 'وضعیت', render: (x) => x.complete ? 'کامل' : x.full_coverage ? 'ناقص' : 'پوشش ناقص سوابق', value: (x) => x.complete ? 2 : x.full_coverage ? 1 : 0 },
                { label: 'فروش عادی', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial },
                { label: 'ریال خالص', render: (x) => rial(x.net_rial), value: (x) => x.net_rial },
                { label: 'فاکتور', render: (x) => fa(x.invoice_count), value: (x) => x.invoice_count },
                { label: 'مشتری فعال', render: (x) => fa(x.active_customers), value: (x) => x.active_customers },
                { label: 'بازهٔ مقایسه', render: (x) => x.compare ? `${x.compare.label}: ${x.compare.start} تا ${x.compare.end}` : '—', value: (x) => x.compare?.start ?? '' },
                { label: 'رشد فروش', render: (x) => x.compare?.growth?.sales_rial == null ? '—' : pct(x.compare.growth.sales_rial, 1), value: (x) => x.compare?.growth?.sales_rial ?? -Infinity, unit: '٪' },
                { label: 'اختلاف فروش', render: (x) => x.compare ? rial(x.compare.delta.sales_rial) : '—', value: (x) => x.compare?.delta?.sales_rial ?? 0 },
              ]} />
            </Panel>
          </section>
          {last?.compare && <div className="banner">آخرین دوره: {rial(last.sales_rial)} در برابر {last.compare.label} ({last.compare.start} تا {last.compare.end}؛ {fa(last.compare.sales_days)} روز دارای فروش)؛ رشد فروش {pct(last.compare.growth.sales_rial, 1)}.</div>}
        </>}
      </>
    )
  }}</Status>
}

function ProfileCommon({ j, back, openCustomer, openVisitor }) {
  const months = (j.months ?? []).map((m) => ({ ...m, gross: billions(m.sales_rial) }))
  const days = (j.days ?? []).map((d) => ({ ...d, gross: billions(d.sales_rial) }))
  return (
    <>
      <section className="panel cust-head" style={{ marginTop: 16 }}>
        <div><span>{PROFILE_LABELS_FULL[j.by]}</span><b>{j.key}</b></div>
        <div><span>سهم از فروش هسته</span><b>{pct(j.share, 2)}</b></div>
        <div><span>اولین فروش دوره</span><b>{j.first_sale ?? '—'}</b></div>
        <div><span>آخرین فروش دوره</span><b>{j.last_sale ?? '—'}</b></div>
        <div><button className="btn" type="button" onClick={back}>بازگشت</button></div>
      </section>
      <section className="kpis" style={{ marginTop: 16 }}>
        <Kpi label="فروش عادی" value={rial(j.sales_rial)} unit="ریال" tone="primary" />
        <Kpi label="ریال خالص" value={rial(j.net_rial)} unit="ریال" hint="Rial+Vat همهٔ ردیف‌ها − مجموع پروموشن" />
        <Kpi label="تعداد فاکتور فروش" value={fa(j.sales_invoices)} unit="فقره" />
        <Kpi label="تعداد سطر فاکتور" value={fa(j.sales_lines)} unit="سطر" />
        <Kpi label="میانگین سطر هر فاکتور" value={fa2(j.avg_lines_per_invoice)} unit="سطر در فاکتور" />
        <Kpi label="مشتری خریدار" value={fa(j.buying_customers)} unit="مشتری یکتا" />
        <Kpi label="روز دارای فروش" value={fa(j.active_days)} unit="روز" tone="teal" />
        <Kpi label="میانگین هر فاکتور" value={j.avg_invoice_rial == null ? '—' : rial(j.avg_invoice_rial)} unit="ریال" />
        <Kpi label="میانگین هر مشتری" value={j.avg_customer_rial == null ? '—' : rial(j.avg_customer_rial)} unit="ریال" />
        <Kpi label="درصد مرجوعی" value={pct(j.return_percent, 2)} unit="از فروش عادی" />
        <Kpi label="درصد تخفیف" value={pct(j.discount_percent, 2)} unit="از فروش عادی" />
      </section>
      <section className="grid">
        <Panel title="روند ماهانه" note="فروش عادی به میلیارد ریال" full><Bars data={months} x="year_month" tickFn={monthName} bars={[{ key: 'gross', name: 'فروش عادی', color: 'var(--blue)' }]} /></Panel>
        <Panel title="روند روزانه" note="فروش عادی به میلیارد ریال" full>
          {!days.length ? <div className="empty">در این بازه فروشی ثبت نشده است.</div> : <div className="chart" role="img" aria-label="روند روزانه"><ResponsiveContainer width="100%" height="100%"><AreaChart data={days}><CartesianGrid vertical={false} stroke="var(--line)" /><XAxis dataKey="date" reversed tickFormatter={dayLabel} tickLine={false} axisLine={false} /><YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} /><Tooltip content={<ChartTip labelFn={dayLabel} unit="میلیارد ریال" />} /><Area type="monotone" dataKey="gross" name="فروش عادی" stroke="var(--saffron-deep)" fill="var(--saffron)" fillOpacity={0.25} /></AreaChart></ResponsiveContainer></div>}
        </Panel>
        {Object.entries(PROFILE_SPLITS).filter(([key]) => key !== j.by).map(([key, label]) => <SplitPie key={key} title={`سهم ${label}`} rows={j[`split_${key}`] ?? []} />)}
        <Panel title="ویزیتورهای برتر" note="برای دیدن پروفایل روی ردیف کلیک کنید" full><Table name={`ویزیتور-${j.key}`} rows={j.visitors ?? []} onRow={(x) => openVisitor(x.code)} columns={[
          { label: 'کد', render: (x) => x.code, value: (x) => String(x.code) }, { label: 'نام', render: (x) => x.name ?? '—', value: (x) => String(x.name ?? '') }, { label: 'فروش', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial }, { label: 'مشتری', render: (x) => fa(x.customers), value: (x) => x.customers },
        ]} /></Panel>
        <Panel title="مشتریان برتر" note="برای دیدن پروفایل روی ردیف کلیک کنید" full><Table name={`مشتری-${j.key}`} rows={j.customers ?? []} onRow={(x) => openCustomer(x.code)} columns={[
          { label: 'کد', render: (x) => x.code, value: (x) => String(x.code) }, { label: 'نام مشتری', render: (x) => x.name ?? '—', value: (x) => String(x.name ?? '') }, { label: 'فروش', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial }, { label: 'فاکتور', render: (x) => fa(x.invoices), value: (x) => x.invoices },
        ]} /></Panel>
        {j.products?.length > 0 && <Panel title="کالاهای برتر" note="۱۵ کالا" full><Table name={`کالا-${j.key}`} rows={j.products} columns={[
          { label: 'کالا', render: (x) => x.name, value: (x) => String(x.name ?? '') }, { label: 'فروش', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial }, { label: 'تعداد', render: (x) => fa(x.qty), value: (x) => x.qty },
        ]} /></Panel>}
      </section>
    </>
  )
}

function ProfileDirectory({ p, openProfile }) {
  const [by, setBy] = useState('branch')
  const r = useApi('/breakdown', { ...p, by, limit: 100 })
  const labels = { branch: 'شعبه', brand: 'برند', group: 'لاین', product: 'کالا' }
  return <><Toggle label="نوع پروفایل" value={by} onChange={setBy} options={Object.entries(labels)} /><Status state={r}>{(rows) => <Panel title={`${labels[by]}‌ها`} note="برای مشاهدهٔ جزئیات روی ردیف کلیک کنید" full><Table name={`فهرست-${by}`} rows={rows} onRow={(x) => openProfile(by, x.key)} columns={[
    { label: labels[by], render: (x) => String(x.key), value: (x) => String(x.key) }, { label: 'فروش عادی', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial }, { label: 'ریال خالص', render: (x) => rial(x.net_rial), value: (x) => x.net_rial }, { label: 'فاکتور', render: (x) => fa(x.invoice_count), value: (x) => x.invoice_count }, { label: 'مشتری فعال', render: (x) => fa(x.active_customers), value: (x) => x.active_customers },
  ]} /></Panel>}</Status></>
}

export function ProfilePage({ p, arg, openProfile, back, openCustomer, openVisitor }) {
  const [by, key] = arg?.includes('~') ? arg.split('~') : ['', '']
  const r = useApi(`/profile/${encodeURIComponent(by)}/${encodeURIComponent(key)}`, { ...p }, Boolean(by && key))
  if (!by || !key) return <ProfileDirectory p={p} openProfile={openProfile} />
  if (r.error) return <div className="banner err" role="alert">مورد یافت نشد. <button className="btn" type="button" onClick={back}>بازگشت</button></div>
  return <Status state={r}>{(j) => <ProfileCommon j={j} back={back} openCustomer={openCustomer} openVisitor={openVisitor} />}</Status>
}

/* ---------- پروفایل ویزیتور ---------- */
function SplitPie({ title, rows }) {
  const top = rows.slice(0, 8).map((x) => ({ name: String(x.name), value: x.sales_rial }))
  const rest = rows.slice(8).reduce((s, x) => s + x.sales_rial, 0)
  if (rest > 0) top.push({ name: 'سایر', value: rest })
  const total = top.reduce((s, x) => s + x.value, 0)
  return (
    <Panel title={title} note="فقط فروش عادی">
      {!top.length ? <div className="empty">داده‌ای برای این فیلترها وجود ندارد.</div> : (
        <div className="chart tall" role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={top} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="80%" paddingAngle={1} label={(e) => pct(e.value / total, 1)}>
                {top.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [`${fa(v)} ریال (${pct(v / total, 1)})`, n]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  )
}

const dash = (v, f = rial) => (v == null ? '—' : f(v))

function VisitorList({ p, openVisitor }) {
  const r = useApi('/visitors', p)
  const ov = useApi('/overview', p)
  return (
    <Status state={r}>{(rows) => {
      const sales = rows.reduce((s, x) => s + x.sales_rial, 0)
      const unassigned = ov.data ? ov.data.sum_rial_vat - rows.reduce((s, x) => s + x.sum_rial_vat, 0) : null
      const top = rows.slice(0, 15).map((x) => ({ ...x, label: `${x.name ?? ''} (${x.code})`, gross: billions(x.sales_rial) }))
      return (
        <>
          <section className="kpis" style={{ marginTop: 16 }}>
            <Kpi label="تعداد ویزیتور دارای فروش" value={fa(rows.length)} unit="کد ویزیتور" tone="primary" />
            <Kpi label="جمع فروش عادی" value={rial(sales)} unit="ریال" />
            <Kpi label="میانگین فروش هر ویزیتور" value={rows.length ? rial(sales / rows.length) : '—'} unit="ریال" tone="teal" />
            <Kpi label="Rial+Vat بدون کد ویزیتور" value={unassigned == null ? '…' : rial(unassigned)} unit="ریال؛ ردیف‌های بدون کد در جدول نیامده" />
          </section>
          <section className="grid">
            <Panel title="ویزیتورهای برتر — ۱۵ مورد" note="فروش عادی به میلیارد ریال" full>
              <Bars data={top} x="label" tall tickFn={(v) => String(v).slice(0, 18)} bars={[{ key: 'gross', name: 'فروش عادی', color: 'var(--blue)' }]} />
            </Panel>
            <Panel title="جدول ویزیتورها" note="هر کد ویزیتور یک ردیف است؛ برای دیدن پروفایل روی ردیف کلیک کنید" full>
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
            </Panel>
          </section>
        </>
      )
    }}</Status>
  )
}

function VisitorProfile({ p, code, back, openCustomer, openReturns }) {
  const r = useApi(`/visitor/${encodeURIComponent(code)}`, p)
  if (r.error) return <div className="banner err" role="alert">ویزیتوری با این کد در این هسته فروش پیدا نشد. <button className="btn" type="button" onClick={back}>بازگشت به فهرست</button></div>
  return (
    <Status state={r}>{(j) => {
      const months = j.months.map((m) => ({ ...m, gross: billions(m.sales_rial) }))
      const days = j.days.map((d) => ({ ...d, gross: billions(d.sales_rial) }))
      const multi = j.names.length > 1 || j.all_branches.length > 1
      return (
        <>
          <section className="panel cust-head" style={{ marginTop: 16 }}>
            <div><span>نام ویزیتور</span><b>{j.name ?? '—'}</b></div>
            <div><span>کد ویزیتور</span><b dir="ltr">{j.code}</b></div>
            <div><span>شعبه‌ها</span><b>{j.all_branches.join('، ') || '—'}</b></div>
            <div><span>اولین فروش دوره</span><b>{j.first_sale ?? '—'}</b></div>
            <div><span>آخرین فروش دوره</span><b>{j.last_sale ?? '—'}</b></div>
            <div><button className="btn" type="button" onClick={back}>بازگشت به فهرست</button></div>
          </section>
          {multi && <div className="banner" style={{ marginTop: 12 }}>
            این کد با {j.names.length > 1 ? `چند نام (${j.names.join('، ')})` : ''}{j.names.length > 1 && j.all_branches.length > 1 ? ' و ' : ''}{j.all_branches.length > 1 ? `چند شعبه (${j.all_branches.length})` : ''} ثبت شده است؛ شاخص‌ها بر پایهٔ کد ویزیتور و یکجا محاسبه می‌شوند.
          </div>}
          <section className="kpis" style={{ marginTop: 16 }}>
            <Kpi label="فروش عادی" value={rial(j.sales_rial)} unit="ریال" tone="primary" />
            <Kpi label="ریال خالص" value={rial(j.net_rial)} unit="ریال" hint="Rial+Vat همهٔ ردیف‌ها − مجموع پروموشن" />
            <Kpi label="رتبه در بین ویزیتورها" value={j.rank ? fa(j.rank) : '—'} unit={j.rank ? `از ${fa(j.visitor_count)} ویزیتور` : ''} tone="teal" />
            <Kpi label="سهم از فروش هسته" value={pct(j.share, 2)} unit="فروش عادی" />
            <Kpi label="تعداد فاکتور فروش" value={fa(j.sales_invoices)} unit="فقره" />
            <Kpi label="تعداد سطر فاکتور" value={fa(j.sales_lines)} unit="سطر" />
            <Kpi label="میانگین سطر هر فاکتور" value={fa2(j.avg_lines_per_invoice)} unit="سطر در فاکتور" />
            <Kpi label="مشتری خریدار" value={fa(j.buying_customers)} unit="مشتری یکتا" />
            <Kpi label="روز دارای فروش" value={fa(j.active_days)} unit="روز" />
            <Kpi label="میانگین هر فاکتور" value={dash(j.avg_invoice_rial)} unit="ریال" />
            <Kpi label="میانگین هر مشتری" value={dash(j.avg_customer_rial)} unit="ریال" />
            <Kpi label="میانگین هر روز فروش" value={dash(j.avg_active_day_rial)} unit="ریال" />
            <Kpi label="درصد مرجوعی" value={pct(j.return_percent, 2)} unit="از فروش عادی" />
            <Kpi label="درصد تخفیف" value={pct(j.discount_percent, 2)} unit="PromisonRial ÷ فروش عادی" />
          </section>
          <section className="grid">
            <Panel title="روند ماهانه فروش ویزیتور" note="میلیارد ریال؛ مستقل از فیلتر ماه" full>
              <Bars data={months} x="year_month" tickFn={monthName} bars={[{ key: 'gross', name: 'فروش عادی', color: 'var(--blue)' }]} />
            </Panel>
            <Panel title="روند روزانه فروش ویزیتور" note="میلیارد ریال، در بازهٔ انتخاب‌شده" full>
              {!days.length ? <div className="empty">در این بازه فروشی ثبت نشده است.</div> : (
                <div className="chart" role="img" aria-label="روند روزانه ویزیتور">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={days} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--line)" />
                      <XAxis dataKey="date" reversed tickFormatter={dayLabel} tickLine={false} axisLine={false} minTickGap={28} />
                      <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={64} />
                      <Tooltip content={<ChartTip labelFn={dayLabel} unit="میلیارد ریال" />} />
                      <Area type="monotone" dataKey="gross" name="فروش عادی" stroke="var(--saffron-deep)" strokeWidth={2} fill="var(--saffron)" fillOpacity={0.25} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
            <SplitPie title="سهم شعبه‌ها" rows={j.branches} />
            <SplitPie title="سهم برندها" rows={j.brands} />
            <SplitPie title="سهم گرید مشتری" rows={j.grades} />
            <SplitPie title="سهم کانال فروش" rows={j.sales_types} />
            <Panel title="مشتریان برتر" note="۲۰ مشتری؛ برای دیدن پروفایل روی ردیف کلیک کنید" full>
              <Table name="مشتریان-ویزیتور" rows={j.customers} onRow={(x) => openCustomer(x.code)} columns={[
                { label: 'کد', render: (x) => x.code, value: (x) => String(x.code) },
                { label: 'نام مشتری', render: (x) => x.name ?? '—', value: (x) => String(x.name ?? '') },
                { label: 'فروش عادی (ریال)', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial },
                { label: 'تعداد فاکتور', render: (x) => fa(x.invoices), value: (x) => x.invoices },
              ]} />
            </Panel>
            <Panel title="کالاهای برتر" note="۱۵ کالا" full>
              <Table name="کالاهای-ویزیتور" rows={j.products} columns={[
                { label: 'کالا', render: (x) => x.name, value: (x) => String(x.name ?? '') },
                { label: 'فروش عادی (ریال)', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial },
                { label: 'تعداد', render: (x) => fa(x.qty), value: (x) => x.qty },
              ]} />
            </Panel>
            <ReturnsProfileCard data={j.dispatch_returns} entity="ویزیتور"
              onOpen={j.dispatch_returns?.matched_names?.length ? () => openReturns(returnsArg('visitor', j.dispatch_returns.matched_names)) : undefined} />
          </section>
        </>
      )
    }}</Status>
  )
}

export function VisitorPage({ p, code, setCode, openCustomer, openReturns }) {
  return code
    ? <VisitorProfile key={code} p={p} code={code} back={() => setCode('')} openCustomer={openCustomer} openReturns={openReturns} />
    : <VisitorList p={p} openVisitor={setCode} />
}

/* ---------- سلامت داده ---------- */
export function HealthPage({ health, meta, quality }) {
  return (
    <section className="grid">
      <Panel title="سلامت داده">
        <ul className="health">
          <li><span>وضعیت بارگذاری</span><b>{health?.status === 'ready' ? 'کامل' : 'ناقص'}</b></li>
          <li><span>ردیف‌های تحلیلی</span><b>{quality ? fa(quality.rows) : '…'}</b></li>
          <li><span>بدون کد مشتری</span><b>{quality ? fa(quality.null_customer_code) : '…'}</b></li>
          <li><span>بدون تاریخ فاکتور</span><b>{quality ? fa(quality.null_invoice_date) : '…'}</b></li>
          <li><span>منفی غیرمرجوعی</span><b>{quality ? fa(quality.negative_rows_non_return) : '…'}</b></li>
        </ul>
      </Panel>
      <Panel title="محدودیت‌های شناخته‌شده داده">
        <ul className="limits">{(meta?.limitations ?? []).map((l) => <li key={l.code} className={l.severity}>{l.label}</li>)}</ul>
      </Panel>
      <Panel title="گزارش‌های نمونه که فعلاً ساخته نشده‌اند" full>
        <ul className="limits">
          <li className="blocked">واحد کارتن: ضریب تبدیل کارتن در داده استخراج‌شده نیست؛ فقط «واحد اصلی» کالا موجود است.</li>
          <li className="warning">شاخص‌های ریزش، CLV و نرخ بازگشت مشتری: تعریف دقیق آن‌ها از کسب‌وکار لازم است.</li>
        </ul>
      </Panel>
    </section>
  )
}

import { useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApi } from './api'
import { billions, billions1, dayLabel, fa, monthLabel } from './format'
import { ChartTip, Kpi, Panel, Status, Table, Toggle, pct } from './ui'

const BY = [['branch', 'شعبه'], ['manager', 'مدیر'], ['supervisor', 'سرپرست'], ['visitor', 'ویزیتور'], ['line', 'لاین'], ['group', 'گروه کالا'], ['category', 'دسته کالا']]
const FILTERS = [['branch', 'شعبه'], ['line', 'لاین'], ['manager', 'مدیر'], ['supervisor', 'سرپرست'], ['group', 'گروه کالا'], ['category', 'دسته کالا'], ['visitor', 'ویزیتور']]
const STATUS = { ahead: ['در مسیر یا جلوتر', 'good'], near: ['کمی عقب‌تر', 'warn'], behind: ['عقب‌تر از مسیر', 'bad'] }
const bn = (v) => (v == null ? '—' : billions1(v))
const optLabel = (o) => (typeof o === 'string' ? o : o.label)
const optValue = (o) => (typeof o === 'string' ? o : o.value)

function StatusBadge({ status }) {
  if (!status) return <span className="tgt-badge none">—</span>
  const [text, tone] = STATUS[status]
  return <span className={`tgt-badge ${tone}`}>{text}</span>
}

function Bar({ value, expected }) {
  const w = Math.min(value ?? 0, 1.2) / 1.2 * 100
  return (
    <span className="tgt-bar" title={`تحقق ${pct(value)}، انتظار ${pct(expected)}`}>
      <i style={{ width: `${w}%` }} />
      <b style={{ insetInlineStart: `${Math.min(expected ?? 0, 1.2) / 1.2 * 100}%` }} />
    </span>
  )
}

export default function TargetPage({ core, onUnavailable }) {
  const [month, setMonth] = useState('')
  const [by, setBy] = useState('branch')
  const [sel, setSel] = useState({})
  const params = { core, by, ...(month && { month }), ...sel }
  const r = useApi('/target', params)
  const setFilter = (k, v) => setSel((s) => { const n = { ...s }; if (v) n[k] = v; else delete n[k]; return n })

  return (
    <Status state={r}>{(d) => {
      if (!d.available) return <div className="banner">{d.reason}</div>
      const s = d.summary
      const exp = d.expected_pct
      const columns = [
        { label: BY.find(([k]) => k === by)[1], render: (x) => <b>{x.label}</b>, value: (x) => x.label },
        { label: 'هدف', unit: 'میلیارد ریال', render: (x) => bn(x.target_rial), value: (x) => x.target_rial },
        { label: 'تحقق', unit: 'میلیارد ریال', render: (x) => bn(x.actual_rial), value: (x) => x.actual_rial },
        { label: 'درصد تحقق', render: (x) => <span className="tgt-pct"><span>{pct(x.achieved_pct)}</span><Bar value={x.achieved_pct} expected={exp} /></span>, value: (x) => x.achieved_pct ?? -1 },
        { label: 'اختلاف تا امروز', unit: 'میلیارد ریال', render: (x) => (x.synthetic && !x.target_rial ? '—' : <span className={x.gap_rial < 0 ? 'neg' : 'pos'} dir="ltr">{bn(x.gap_rial)}</span>), value: (x) => x.gap_rial },
        { label: 'لازم در هر روز کاری', unit: 'میلیارد ریال', render: (x) => bn(x.needed_per_day_rial), value: (x) => x.needed_per_day_rial ?? -1 },
        { label: 'پیش‌بینی پایان ماه', render: (x) => pct(x.projected_pct), value: (x) => x.projected_pct ?? -1 },
        { label: 'وضعیت', render: (x) => <StatusBadge status={x.status} />, value: (x) => x.status ?? '' },
      ]
      const counts = d.status_counts
      const q = d.quality
      return (
        <>
          <div className="toolbar">
            <label className="tgt-month">ماه تارگت
              <select value={d.month} onChange={(e) => { setMonth(e.target.value); setSel({}) }}>
                {d.months.map((m) => <option key={m.month} value={m.month}>{monthLabel(m.month)}</option>)}
              </select>
            </label>
            <Toggle label="بعد گزارش" value={by} options={BY} onChange={setBy} />
          </div>
          <div className="tgt-filters">
            {FILTERS.map(([k, label]) => (
              <label key={k}>{label}
                <select value={d.filters[k]?.[0] ?? ''} onChange={(e) => setFilter(k, e.target.value)}>
                  <option value="">همه</option>
                  {d.options[k].map((o) => <option key={optValue(o)} value={optValue(o)}>{optLabel(o)}</option>)}
                </select>
              </label>
            ))}
            {Object.keys(sel).length > 0 && <button type="button" className="btn" onClick={() => setSel({})}>پاک کردن فیلترها</button>}
          </div>

          <section className="kpis">
            <Kpi label="هدف ماه" value={bn(s.target_rial)} unit="میلیارد ریال" />
            <Kpi label="تحقق تا امروز" value={bn(s.actual_rial)} unit="میلیارد ریال" hint={d.as_of ? `تا ${dayLabel(d.as_of)}` : 'دادهٔ این ماه ثبت نشده'} />
            <Kpi label="درصد تحقق" value={pct(s.achieved_pct)} tone={s.status === 'behind' ? 'bad' : s.status === 'ahead' ? 'good' : undefined}
              hint={`انتظار تا امروز: ${pct(exp)} (${fa(d.elapsed_working_days)} از ${fa(d.working_days)} روز کاری)`} />
            <Kpi label="لازم در هر روز کاری" value={bn(s.needed_per_day_rial)} unit="میلیارد ریال" hint={`${fa(d.remaining_working_days)} روز کاری باقی مانده`} />
            <Kpi label="پیش‌بینی پایان ماه" value={pct(s.projected_pct)} hint={`با روند فعلی ≈ ${bn(s.projected_rial)} میلیارد`} />
          </section>

          <section className="grid">
            <Panel title="تحقق تجمعی در برابر مسیر مورد انتظار" note="خط آبی: فروش تجمعی. خط خاکستری: مسیر مورد انتظار با روزهای کاری (جمعه و تعطیلات سرور کنار گذاشته می‌شوند). میلیارد ریال" full>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={d.daily.map((x) => ({ ...x, actual: x.actual_cum_rial == null ? null : x.actual_cum_rial / 1e9, expected: x.expected_cum_rial / 1e9 }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" reversed tickFormatter={dayLabel} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={64} />
                  <Tooltip content={<ChartTip labelFn={dayLabel} unit="میلیارد ریال" />} />
                  <Legend />
                  <Line type="monotone" dataKey="expected" name="مسیر مورد انتظار" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                  <Line type="monotone" dataKey="actual" name="تحقق تجمعی" stroke="#2563eb" strokeWidth={2.5} dot={false} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="وضعیت امروز" note="وضعیت هر ردیف با مقایسهٔ تحقق و سهم مورد انتظار تا امروز: از ۱۰۰٪ به بالا در مسیر، ۹۰ تا ۱۰۰٪ کمی عقب، کمتر از ۹۰٪ عقب‌تر از مسیر">
              <div className="tgt-counts">
                {Object.entries(STATUS).map(([k, [text, tone]]) => (
                  <div key={k} className={`tgt-count ${tone}`}><b>{fa(counts[k] ?? 0)}</b><span>{text}</span></div>
                ))}
              </div>
            </Panel>

            <Panel title={`جدول به تفکیک ${BY.find(([k]) => k === by)[1]}`} note="روی عنوان ستون برای مرتب‌سازی کلیک کنید. درصد انتظار روزانه بر پایهٔ روزهای کاری داشبورد است." full>
              <Table name={`target-${d.month}-${by}`} columns={columns} rows={d.rows} />
            </Panel>

            <Panel title="کنترل کیفیت داده" note={d.method} full>
              <ul className="tgt-quality">
                <li>ویزیتورهای فایل تارگت: <b>{fa(q.visitors_in_target)}</b> نفر؛ بدون کد قابل تطبیق: <b>{fa(q.visitors_without_code)}</b> نفر ({billions(q.target_rial_without_code)} میلیارد ریال هدف، فقط در شعبه، مدیر و سرپرست لحاظ می‌شود).</li>
                <li>فروش دسته‌هایی که تارگت ندارند: <b>{billions(q.sales_outside_target_categories_rial)}</b> میلیارد ریال که در تحقق نیامده است.</li>
                <li>تعداد دسته کالای تارگتی: <b>{fa(q.target_categories)}</b>.</li>
              </ul>
            </Panel>
          </section>
        </>
      )
    }}</Status>
  )
}

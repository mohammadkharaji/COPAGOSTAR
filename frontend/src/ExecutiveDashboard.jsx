import { useMemo, useState } from 'react'
import {
  Activity, ArrowDownLeft, BarChart3, Building2, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign, FileText,
  Filter, HeartPulse, LayoutDashboard, ListOrdered, LogOut, MapPin, PackageSearch, Percent, PieChart as PieIcon, Printer, RefreshCw, ShoppingBag, Sparkles,
  PackageX, Target, TrendingDown, TrendingUp, Undo2, UserCheck, UserRound, UserX, Users, Wallet, X,
} from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApi } from './api'
import { dayLabel, fa, fa2, faDigits, monthLabel, monthName } from './format'
import { Table } from './ui'

const pct = (v) => (v == null ? '—' : `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(v * 100)}٪`)
const PIE_COLORS = ['#2563eb', '#0f766e', '#8b5cf6', '#f59e0b', '#ec4899', '#0ea5e9', '#84cc16', '#ef4444', '#94a3b8']
const PIE_BY = [['branch', 'شعبه'], ['region', 'منطقه'], ['brand', 'برند'], ['sales_type', 'کانال فروش'], ['group', 'لاین'], ['grade', 'گرید مشتری']]
const FILTER_LABELS = { sales_type: 'کانال فروش', region: 'منطقه', state: 'منطقه شهرداری', city: 'شهر', brand: 'برند', group: 'لاین', grade: 'گرید مشتری', main_group: 'گروه کالای اصلی', sub_group: 'زیرگروه کالای اصلی' }
const PRODUCT_GROUP_KEYS = ['main_group', 'sub_group'] // hidden while the data has no product groups (product.tsv not loaded)

export const NAV = [
  ['overview', 'نمای کلی', LayoutDashboard], ['trend', 'روند روزانه', Activity], ['monthly', 'روند ماهانه', BarChart3],
  ['growth', 'آنالیز رشد و افت', Percent], ['target', 'تارگت', Target],
  ['branch', 'شعب و مناطق', MapPin], ['product', 'کالا و برند', ShoppingBag], ['profile', 'تحلیل شعبه و برند', Building2],
  ['pareto', 'تحلیل پارتو', TrendingUp], ['inactive', 'مشتریان غیرفعال', UserX], ['returns', 'برگشتی حواله', Undo2],
  ['invoice', 'تحلیل فاکتور', FileText], ['customer', 'پروفایل مشتری', UserRound], ['visitor', 'پروفایل ویزیتور', UserCheck],
  ['health', 'سلامت داده', HeartPulse],
]

// Sidebar grouping only; NAV keeps its [id, label, Icon] shape for App.jsx routing.
// The third field marks a group as an expandable sub-menu.
const NAV_GROUPS = [
  ['فروش', ['overview', 'trend', 'monthly', 'growth', 'target'], false],
  ['تحلیل', ['branch', 'product', 'profile', 'pareto', 'inactive', 'returns'], true],
  ['مشتری و فاکتور', ['invoice', 'customer', 'visitor'], true],
  ['سیستم', ['health'], true],
]
const NAV_SECTIONS = (() => {
  const grouped = NAV_GROUPS.map(([label, ids, collapsible]) => [label, NAV.filter(([id]) => ids.includes(id)), collapsible])
  const rest = NAV.filter(([id]) => !NAV_GROUPS.some(([, ids]) => ids.includes(id)))
  return rest.length ? [...grouped, ['سایر', rest, true]] : grouped
})()

function NavGroup({ label, items, collapsible, page, onNavigate, open, onToggle, index }) {
  const hasActive = items.some(([id]) => id === page)
  const listId = `exec-nav-items-${index}`
  return (
    <div className={`exec-nav-group ${collapsible ? 'collapsible' : ''} ${collapsible && !open ? 'closed' : ''}`} role="group" aria-label={label}>
      {collapsible ? (
        <button type="button" className="exec-nav-toggle" aria-expanded={open} aria-controls={listId} onClick={onToggle}>
          <span>{label}</span>
          {!open && hasActive && <em className="exec-nav-marker" aria-label="صفحهٔ فعلی در این بخش است" />}
          <ChevronDown size={15} className="exec-nav-chevron" aria-hidden="true" />
        </button>
      ) : <div className="exec-nav-label">{label}</div>}
      <div className="exec-nav-items" id={listId}>
        <div>
          {items.map(([id, itemLabel, Icon]) => (
            <button type="button" key={id} className={id === page ? 'active' : ''} onClick={() => onNavigate(id)} title={itemLabel} aria-current={id === page ? 'page' : undefined}>
              <i className="exec-nav-icon" aria-hidden="true"><Icon size={16} /></i><span>{itemLabel}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
const TIP = {
  contentStyle: { background: '#0f1d3a', border: 0, borderRadius: 12, boxShadow: '0 14px 30px -10px rgba(15,29,58,.6)', direction: 'rtl', fontFamily: 'Vazirmatn, sans-serif', fontSize: 12 },
  itemStyle: { color: '#fff' },
  labelStyle: { color: '#93a7c9', marginBottom: 4 },
}

function QuickSelect({ label, value, options, onChange, format = (x) => x }) {
  return (
    <label className="exec-select"><span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">همه</option>
        {options.map((x) => <option key={x} value={x}>{format(x)}</option>)}
      </select>
      <ChevronDown size={15} />
    </label>
  )
}

/* ---------- پوستهٔ مشترک همهٔ صفحه‌ها ---------- */
export function ExecShell({
  page, onNavigate, core, cores, setCore, title, subtitle, month, setMonth, filters = {}, dims = {}, onFilterChange, onReset,
  showFilters = true, hideMonth = false, error, partial, lastDataDate, syncState = 'never', syncNotice, onDismissNotice, onRefresh, onLogout, user, children,
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [openGroups, setOpenGroups] = useState({})
  const running = syncState === 'running'
  const hasFilters = Boolean(month) || Object.keys(dims).length > 0
  return (
    <div className={`exec-root ${collapsed ? 'exec-collapsed' : ''}`} dir="rtl">
      <aside className="exec-sidebar">
        <div className="exec-brand">
          <span className="exec-logo"><img src="/logo.jpg" alt="لوگوی کوپا گستر" /></span>
          <div className="exec-brand-copy"><b>نبض فروش</b><small>{cores[core]}</small></div>
          <button type="button" className="exec-collapse" aria-label={collapsed ? 'باز کردن منو' : 'جمع کردن منو'} onClick={() => setCollapsed((v) => !v)}>
            {collapsed ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}
          </button>
        </div>
        <nav className="exec-nav" aria-label="گزارش‌ها">
          {NAV_SECTIONS.map(([group, items, collapsible], i) => {
            // A group the user has not toggled opens when it holds the current page.
            const open = openGroups[group] ?? items.some(([id]) => id === page)
            return (
              <NavGroup
                key={group} index={i} label={group} items={items} collapsible={collapsible} page={page} onNavigate={onNavigate}
                open={open} onToggle={() => setOpenGroups((s) => ({ ...s, [group]: !open }))}
              />
            )
          })}
        </nav>
        <div className="exec-sidebar-bottom">
          <div className="exec-system">
            <span className={`exec-dot ${syncState === 'failed' || partial ? 'bad' : ''}`} />
            <div>
              <b>{partial ? 'استخراج ناقص' : 'داده کامل'}</b>
              <small>{running ? 'در حال به‌روزرسانی' : syncState === 'failed' ? 'آخرین به‌روزرسانی ناموفق بود' : lastDataDate ? `داده تا ${faDigits(lastDataDate)}` : 'منبع: SR-1405.xlsx'}</small>
            </div>
          </div>
          <button type="button" className="exec-refresh" onClick={onRefresh} disabled={running}>
            <RefreshCw size={16} className={running ? 'spin' : ''} /><span>{running ? 'در حال به‌روزرسانی…' : 'به‌روزرسانی داده'}</span>
          </button>
          {onLogout && (
            <div className="exec-profile">
              <span className="exec-avatar" aria-hidden="true"><UserRound size={17} /></span>
              <div className="exec-profile-copy"><b dir="ltr">{user || 'کاربر'}</b><small>حساب کاربری</small></div>
              <button type="button" className="exec-logout" onClick={onLogout} aria-label="خروج از حساب" title="خروج از حساب"><LogOut size={17} /></button>
            </div>
          )}
        </div>
      </aside>

      <main className="exec-main">
        <header className="exec-header">
          <div>
            <div className="exec-eyebrow">داشبورد اجرایی · سال مالی ۱۴۰۵</div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="exec-header-actions">
            {lastDataDate && <span className="exec-live" title="آخرین روز دارای داده در پایگاه"><i /> داده تا {dayLabel(lastDataDate)}</span>}
            <div className="seg" role="tablist" aria-label="هسته فروش">
              {Object.entries(cores).map(([k, v]) => (
                <button type="button" key={k} role="tab" aria-selected={core === k} className={core === k ? 'on' : ''} onClick={() => setCore(k)}>{v}</button>
              ))}
            </div>
            <button type="button" className="exec-refresh-mini" onClick={onRefresh} disabled={running} aria-label="به‌روزرسانی داده" title="به‌روزرسانی داده">
              <RefreshCw size={17} className={running ? 'spin' : ''} />
            </button>
            <button type="button" className="exec-refresh-mini" onClick={() => window.print()} aria-label="چاپ یا ذخیره PDF" title="چاپ / PDF">
              <Printer size={17} />
            </button>
            {onLogout && (
              <button type="button" className="exec-refresh-mini exec-logout-mini" onClick={onLogout} aria-label="خروج از حساب" title="خروج">
                <LogOut size={17} />
              </button>
            )}
          </div>
        </header>

        {error && <div className="exec-alert err" role="alert">{error}</div>}
        {partial && !error && <div className="exec-alert warn">بخشی از ماه‌ها هنوز بارگذاری نشده است.</div>}
        {syncNotice && (
          <div className={`exec-alert ${syncNotice.includes('ناموفق') ? 'err' : 'ok'}`} role="status" aria-live="polite">
            <span><Sparkles size={16} />{syncNotice}</span>
            <button type="button" onClick={onDismissNotice} aria-label="بستن"><X size={16} /></button>
          </div>
        )}

        {showFilters && (
          <>
            <section className="exec-filterbar" aria-label="فیلترها">
              <div className="exec-filter-title"><Filter size={17} /><b>فیلترهای سریع</b></div>
              {!hideMonth && <QuickSelect label="ماه" value={month} options={filters.month ?? []} onChange={setMonth} format={monthLabel} />}
              <QuickSelect label="شعبه" value={dims.branch ?? ''} options={filters.branch ?? []} onChange={(v) => onFilterChange('branch', v)} />
              <div className="exec-filter-actions">
                {hasFilters && <button type="button" className="exec-reset" onClick={onReset}>پاک کردن فیلترها</button>}
                <button type="button" className={`exec-advanced-toggle ${advanced ? 'open' : ''}`} aria-expanded={advanced} onClick={() => setAdvanced((v) => !v)}>
                  {advanced ? 'بستن فیلترهای پیشرفته' : 'فیلترهای پیشرفته'}<ChevronDown size={15} />
                </button>
              </div>
            </section>
            {advanced && (
              <section className="exec-advanced">
                <div className="exec-advanced-head"><b>فیلترهای تحلیلی</b><span>روی همهٔ نمودارها و جدول‌های این صفحه اعمال می‌شود</span></div>
                <div className="exec-advanced-grid">
                  {Object.entries(FILTER_LABELS).filter(([k]) => !PRODUCT_GROUP_KEYS.includes(k) || filters[k]?.length || dims[k]).map(([k, label]) => (
                    <QuickSelect key={k} label={label} value={dims[k] ?? ''} options={filters[k] ?? []} onChange={(v) => onFilterChange(k, v)} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <div className="exec-page">{children}</div>
      </main>
    </div>
  )
}

function Metric({ icon: Icon, label, value, unit, tone = 'blue' }) {
  return (
    <article className={`exec-metric ${tone}`}>
      <div className="exec-metric-top"><i aria-hidden="true"><Icon size={18} /></i></div>
      <span className="exec-metric-label">{label}</span>
      <strong>{value}</strong>
      <small>{unit}</small>
    </article>
  )
}

// Net-rial trend line for the hero, built from the real /monthly rows; latest month on the left (RTL time axis).
function sparkPaths(values) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const range = Math.max(...values) - min || 1
  const pts = values.map((v, i) => [600 - (i * 600) / (values.length - 1), 82 - ((v - min) / range) * 70])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  return { line, area: `${line} L0 90 L600 90 Z` }
}

function HeroCard({ o, rows, period, growth, growthLabel }) {
  const spark = useMemo(() => sparkPaths(rows.map((r) => r.net_rial)), [rows])
  return (
    <article className="exec-hero exec-span-7">
      {spark && (
        <svg className="exec-hero-spark" viewBox="0 0 600 90" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="execHeroFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity=".4" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={spark.area} fill="url(#execHeroFill)" />
          <path d={spark.line} fill="none" stroke="#fff" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      <div className="exec-hero-head">
        <span className="exec-hero-title"><i aria-hidden="true"><Wallet size={18} /></i>فروش خالص (ریال خالص)</span>
        {growth != null && (
          <span className={`exec-hero-pill ${growth < 0 ? 'down' : ''}`} title="نسبت به دورهٔ مشابه ماه قبل">
            {growth < 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}{pct(Math.abs(growth))} {growth < 0 ? 'افت' : 'رشد'} {growthLabel}
          </span>
        )}
      </div>
      <div className="exec-hero-value"><strong>{o ? fa(o.net_rial) : '—'}</strong><small>ریال</small></div>
      <div className="exec-hero-sub">پس از کسر پروموشن · {period}</div>
      <div className="exec-hero-stats">
        <div><small>فروش ناخالص</small><b>{o ? `${fa(o.sum_rial_vat / 1e9)} میلیارد` : '—'}</b></div>
        <div><small>مجموع پروموشن</small><b>{o ? `${fa(o.promo_total_rial / 1e9)} میلیارد` : '—'}</b></div>
        <div><small>درصد پروموشن</small><b>{o ? pct(o.promo_percent) : '—'}</b></div>
      </div>
    </article>
  )
}

function CardHead({ title, note, chip }) {
  return (
    <div className="exec-card-head">
      <div><h2>{title}</h2>{note && <p>{note}</p>}</div>
      {chip}
    </div>
  )
}

function SalesChart({ rows }) {
  const data = rows.map((r) => ({ ...r, value: r.sum_rial_vat / 1e9, net: r.net_rial / 1e9 }))
  return (
    <div className="exec-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 4, left: 4, bottom: 0 }} barGap={6}>
          <defs>
            <linearGradient id="execNetBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b82f6" /><stop offset="1" stopColor="#1d4ed8" /></linearGradient>
            <linearGradient id="execGrossBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5eead4" /><stop offset="1" stopColor="#14b8a6" /></linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e5eaf3" strokeDasharray="4 4" />
          <XAxis dataKey="year_month" reversed tickFormatter={monthName} axisLine={false} tickLine={false} />
          <YAxis orientation="right" axisLine={false} tickLine={false} tickFormatter={(v) => fa(v)} width={50} />
          <Tooltip {...TIP} formatter={(v, n) => [`${fa(v)} میلیارد ریال`, n]} labelFormatter={monthLabel} cursor={{ fill: '#f1f5ff', radius: 10 }} />
          <Bar dataKey="net" name="ریال خالص" fill="url(#execNetBar)" radius={[8, 8, 3, 3]} maxBarSize={26} />
          <Bar dataKey="value" name="فروش ناخالص" fill="url(#execGrossBar)" radius={[8, 8, 3, 3]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function DailyChart({ rows }) {
  const data = rows.map((r) => ({ ...r, value: r.sum_rial_vat / 1e9 }))
  return (
    <div className="exec-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="execFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2563eb" stopOpacity=".28" />
              <stop offset="1" stopColor="#2563eb" stopOpacity=".02" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e5eaf3" strokeDasharray="4 4" />
          <XAxis dataKey="date" reversed tickFormatter={dayLabel} axisLine={false} tickLine={false} minTickGap={32} />
          <YAxis orientation="right" axisLine={false} tickLine={false} tickFormatter={(v) => fa(v)} width={50} />
          <Tooltip {...TIP} formatter={(v) => [`${fa(v)} میلیارد ریال`, 'فروش']} labelFormatter={dayLabel} />
          <Area type="monotone" dataKey="value" stroke="#2563eb" fill="url(#execFill)" strokeWidth={2.5} strokeLinejoin="round" activeDot={{ r: 5, fill: '#fff', stroke: '#2563eb', strokeWidth: 2.5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function SharePieCard({ p }) {
  const [by, setBy] = useState('branch')
  const r = useApi('/breakdown', { ...p, by, limit: 40 })
  const slices = useMemo(() => {
    const pos = (r.data ?? []).filter((x) => x.sum_rial_vat > 0).sort((a, b) => b.sum_rial_vat - a.sum_rial_vat)
    const top = pos.slice(0, 8).map((x) => ({ name: by === 'month' ? monthLabel(String(x.key)) : String(x.key), value: x.sum_rial_vat }))
    const rest = pos.slice(8).reduce((s, x) => s + x.sum_rial_vat, 0)
    if (rest > 0) top.push({ name: 'سایر', value: rest })
    return top
  }, [r.data, by])
  const total = slices.reduce((s, x) => s + x.value, 0)
  return (
    <article className="exec-card exec-pie-card">
      <CardHead title="سهم از فروش" note="فقط مقادیر مثبت؛ ۸ مورد برتر و بقیه در «سایر»"
        chip={<span className="exec-chip violet"><PieIcon size={14} /> کیکی</span>} />
      <div className="exec-pie-by" role="tablist" aria-label="بعد نمودار کیکی">
        {PIE_BY.map(([k, label]) => (
          <button type="button" key={k} role="tab" aria-selected={by === k} className={by === k ? 'on' : ''} onClick={() => setBy(k)}>{label}</button>
        ))}
      </div>
      {r.error ? <div className="exec-empty">دریافت داده ناموفق بود.</div>
        : !slices.length ? <div className="exec-empty">{r.loading ? 'در حال بارگذاری…' : 'داده‌ای برای این فیلترها وجود ندارد.'}</div> : (
          <div className="exec-pie-wrap">
            <ul className="exec-legend">
              {slices.map((s, i) => (
                <li key={s.name}>
                  <i style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} /><span>{s.name}</span><b>{pct(s.value / total)}</b>
                  <em className="exec-legend-bar" aria-hidden="true"><u style={{ width: `${(s.value / total) * 100}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} /></em>
                </li>
              ))}
            </ul>
            <div className="exec-pie">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slices} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="96%" paddingAngle={2} stroke="none">
                    {slices.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...TIP} formatter={(v, n) => [`${fa(v / 1e9)} میلیارد ریال (${pct(v / total)})`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="exec-pie-center"><b>{fa(total / 1e9)}</b><small>میلیارد ریال</small></div>
            </div>
          </div>
        )}
    </article>
  )
}

const prevMonthKey = (ym) => (Number(ym.slice(4)) > 1 ? `${ym.slice(0, 4)}${String(Number(ym.slice(4)) - 1).padStart(2, '0')}` : null)
const spanOf = (ym, lastDay) => ({ start: `${ym.slice(0, 4)}/${ym.slice(4)}/01`, end: `${ym.slice(0, 4)}/${ym.slice(4)}/${String(lastDay).padStart(2, '0')}` })

function Delta({ cur, prev }) {
  if (!(prev > 0)) return <span className="exec-delta flat">—</span>
  const d = cur / prev - 1
  const up = d >= 0
  return <span className={`exec-delta ${up ? 'up' : 'down'}`}>{up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{pct(Math.abs(d))}</span>
}

function ForecastCard({ pace }) {
  const d = pace.data?.available ? pace.data : null
  const done = d?.remaining_working_days === 0
  const share = d?.working_days ? Math.min(1, d.elapsed_working_days / d.working_days) : 0
  return (
    <article className="exec-card exec-forecast exec-span-5">
      <CardHead title={d ? `پیش‌بینی پایان ${monthLabel(d.year_month)}` : 'پیش‌بینی پایان ماه'}
        note="برآورد بر اساس میانگین فروش هر روز کاری" chip={<span className="exec-chip amber"><Target size={14} /> برآورد</span>} />
      {!d ? <div className="exec-empty">{pace.loading ? 'در حال بارگذاری…' : 'داده‌ای برای برآورد وجود ندارد.'}</div> : (
        <>
          <div className="exec-forecast-body">
            <div className="exec-ring" style={{ '--p': `${share * 360}deg` }} role="img"
              aria-label={`${fa(d.elapsed_working_days)} از ${fa(d.working_days)} روز کاری سپری‌شده`}>
              <div><b>{fa(d.elapsed_working_days)} از {fa(d.working_days)}</b><small>روز کاری سپری‌شده</small></div>
            </div>
            <div className="exec-forecast-value">
              <small>{done ? 'ریال خالص ماه (کامل)' : 'ریال خالص برآوردی پایان ماه'}</small>
              <strong>{fa(done ? d.net_rial : d.projected_net_rial)}</strong>
              <small>ریال · خالص واقعی تا {dayLabel(d.last_date)}: {fa(d.net_rial)}</small>
            </div>
          </div>
          <dl className="exec-facts">
            <div><dt>ناخالص {done ? 'ماه' : 'برآوردی'}</dt><dd>{fa(done ? d.sum_rial_vat : d.projected_sum_rial_vat)}</dd></div>
            <div><dt>ناخالص واقعی تا {dayLabel(d.last_date)}</dt><dd>{fa(d.sum_rial_vat)}</dd></div>
            <div><dt>روز کاری باقی‌مانده</dt><dd>{fa(d.remaining_working_days)} روز</dd></div>
          </dl>
          <p className="exec-footnote">{d.method}. این عدد پیش‌بینی است، نه فروش ثبت‌شده.</p>
        </>
      )}
    </article>
  )
}

function CompareCard({ dims, month, pace, months }) {
  const pc = pace.data?.available ? pace.data : null
  const ym = month || pc?.year_month || ''
  const pym = ym ? prevMonthKey(ym) : null
  const partial = Boolean(pc && ym === pc.year_month && pc.last_day < pc.month_days)
  const lastDay = partial ? pc.last_day : 31
  const ready = Boolean(ym && pym && months.includes(ym) && months.includes(pym))
  const cur = useApi('/overview', { ...dims, ...spanOf(ym || '000000', lastDay) }, ready)
  const prev = useApi('/overview', { ...dims, ...spanOf(pym || '000000', lastDay) }, ready)
  const c = ready ? cur.data : null
  const b = ready ? prev.data : null
  const span = partial ? ` (۱ تا ${fa(lastDay)})` : ''
  const items = [['ریال خالص', 'net_rial'], ['فروش ناخالص', 'sum_rial_vat'], ['تعداد کالا', 'sum_qty'], ['تعداد فاکتور', 'invoice_count'], ['مشتری فعال', 'active_customers']]
  return (
    <article className="exec-card exec-compare exec-span-7">
      <CardHead title="مقایسه با ماه قبل"
        note={ready ? `${monthLabel(ym)}${span} در برابر ${monthLabel(pym)}${span}` : 'برای مقایسه به دو ماه متوالی داده نیاز است'}
        chip={<span className="exec-chip blue">{partial ? 'هم‌بازه' : 'ماه کامل'}</span>} />
      {!c || !b ? <div className="exec-empty">{ready ? 'در حال بارگذاری…' : 'ماه قبلِ این دوره در داده موجود نیست.'}</div> : (
        <div className="exec-table-wrap">
          <table>
            <thead><tr><th>شاخص</th><th>{monthLabel(ym)}</th><th>{monthLabel(pym)}</th><th>تغییر</th></tr></thead>
            <tbody>
              {items.map(([label, key]) => (
                <tr key={key} style={{ cursor: 'default' }}><td>{label}</td><td>{fa(c[key])}</td><td>{fa(b[key])}</td><td><Delta cur={c[key]} prev={b[key]} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {partial && <p className="exec-footnote">ماه جاری کامل نیست؛ برای انصاف، همان روزهای ابتدای ماه قبل مقایسه می‌شود.</p>}
    </article>
  )
}

/* ---------- محتوای نمای کلی ---------- */
export default function ExecutiveDashboard({ p, cal, month, setMonth }) {
  const { month: _m, start: _s, end: _e, ...dims } = p
  const ov = useApi('/overview', p)
  const invoiceLines = useApi('/invoice-lines', p)
  const growth = useApi('/growth', { ...dims, kind: 'month' })
  const monthly = useApi('/monthly', { ...dims })
  const trend = useApi('/trend', p)
  const pace = useApi('/pace', dims)
  const ret = useApi('/returns/summary', p) // dispatch-order returns; separate from SR sales metrics
  const retTotal = ret.data?.available ? ret.data.total : null
  const retNote = ret.error ? 'دریافت داده ناموفق بود' : ret.data?.available === false ? 'داده حواله بارگذاری نشده' : ret.loading && !ret.data ? 'در حال بارگذاری…' : null
  const o = ov.data
  const rows = monthly.data ?? []
  const lastPeriod = growth.data?.periods?.at(-1)
  const selectedPeriod = growth.data?.periods?.find((r) => r.key === month)
  const invoiceGrowth = (month ? selectedPeriod : lastPeriod)?.compare?.growth?.invoice_count
  const netGrowth = (month ? selectedPeriod : lastPeriod)?.compare?.growth?.net_rial
  const growthLabel = (month ? selectedPeriod : lastPeriod)?.label
  const days = trend.data ?? []
  const toggle = (ym) => setMonth(ym === month ? '' : ym)
  return (
    <>
      <section className="exec-calendar" aria-label="تقویم کاری">
        <div className="exec-calendar-date"><CalendarDays size={20} />
          <div><span>وضعیت امروز</span><b>{cal ? `${cal.weekday_name} ${fa(cal.day)} ${cal.month_name} ${faDigits(cal.year)}` : '—'}</b></div>
        </div>
        <div className="exec-calendar-stat"><span>روز کاری</span><b>{cal ? fa(cal.working_days) : '—'}</b></div>
        <div className="exec-calendar-stat"><span>سپری‌شده</span><b>{cal ? fa(cal.days_passed) : '—'}</b></div>
        <div className="exec-calendar-stat accent"><span>باقی‌مانده</span><b>{cal ? fa(cal.days_remaining) : '—'}</b></div>
        <div className="exec-progress"><i style={{ width: cal ? `${(cal.days_passed / cal.working_days) * 100}%` : 0 }} /></div>
      </section>

      <section className="exec-grid exec-hero-row">
        <HeroCard o={o} rows={rows} period={month ? monthLabel(month) : 'همه ماه‌ها'} growth={netGrowth} growthLabel={growthLabel} />
        <ForecastCard pace={pace} />
      </section>

      <section className="exec-kpis exec-kpis-overview">
        <Metric icon={CircleDollarSign} label="فروش ناخالص" value={o ? fa(o.sum_rial_vat) : '—'} unit="ریال · شامل مالیات و عوارض" tone="blue" />
        <Metric icon={PackageSearch} label="تعداد کالا" value={o ? fa(o.sum_qty) : '—'} unit="عدد" tone="violet" />
        <Metric icon={FileText} label="تعداد فاکتور" value={o ? fa(o.invoice_count) : '—'} unit="فقره" tone="amber" />
        <Metric icon={TrendingUp} label="درصد رشد فاکتور" value={pct(invoiceGrowth)} unit={growthLabel ? `${growthLabel} نسبت به دورهٔ مشابه ماه قبل` : 'مقایسه با ماه قبل'} tone="teal" />
        <Metric icon={ListOrdered} label="میانگین سطر فاکتور" value={invoiceLines.data ? fa2(invoiceLines.data.avg_lines_per_invoice) : '—'} unit="سطر در هر فاکتور · فقط فروش عادی" tone="sky" />
        <Metric icon={Users} label="مشتری فعال" value={o ? fa(o.active_customers) : '—'} unit="مشتری یکتا" tone="pink" />
        <Metric icon={ArrowDownLeft} label="مجموع پروموشن" value={o ? fa(o.promo_total_rial) : '—'} unit="ریال" tone="red" />
        <Metric icon={Percent} label="درصد کل پروموشن" value={o ? pct(o.promo_percent) : '—'} unit="از فروش ناخالص · دورهٔ انتخاب‌شده" tone="red" />
        <Metric icon={Undo2} label="حواله‌های برگشتی" value={retTotal ? fa(retTotal.returned_orders) : '—'} unit={retNote ?? `از ${fa(retTotal.orders)} حواله پخش`} tone="amber" />
        <Metric icon={PackageX} label="درصد برگشتی حواله" value={retTotal ? pct(retTotal.return_percent) : '—'} unit={retNote ?? (ret.data.ignored_filters?.length ? 'مبلغ برگشتی ÷ مبلغ حواله · برخی فیلترها اعمال نشد' : 'مبلغ برگشتی ÷ مبلغ حواله')} tone="red" />
      </section>

      <section className="exec-grid">
        <article className="exec-card exec-span-8">
          <CardHead title="روند فروش ماهانه" note="ریال خالص و فروش ناخالص · میلیارد ریال"
            chip={<span className="exec-legend-inline"><i style={{ background: '#2563eb' }} />خالص<i style={{ background: '#14b8a6' }} />ناخالص</span>} />
          <SalesChart rows={rows} />
        </article>
        <div className="exec-span-4"><SharePieCard p={p} /></div>

        <CompareCard dims={dims} month={month} pace={pace} months={rows.map((r) => r.year_month)} />
        <article className="exec-card exec-daily exec-span-5">
          <CardHead title="روند فروش روزانه" note={month ? `روزهای ${monthLabel(month)} · میلیارد ریال` : 'روزهای دورهٔ انتخاب‌شده · میلیارد ریال'}
            chip={<span className="exec-chip blue">Rial+Vat</span>} />
          <DailyChart rows={days} />
        </article>

        <article className="exec-card exec-span-12">
          <CardHead title="خلاصهٔ ماهانه" note="برای تمرکز روی یک ماه، ردیف آن را انتخاب کنید"
            chip={<span className="exec-chip blue">مدل Power Pivot</span>} />
          <Table name="خلاصه-ماهانه" rows={rows} onRow={(r) => toggle(r.year_month)} highlight={(r) => month === r.year_month}
            columns={[
              { label: 'ماه', render: (r) => monthName(r.year_month), value: (r) => r.year_month },
              { label: 'فروش ناخالص', render: (r) => fa(r.sum_rial_vat), value: (r) => r.sum_rial_vat },
              { label: 'ریال خالص', render: (r) => fa(r.net_rial), value: (r) => r.net_rial },
              { label: 'فاکتور', render: (r) => fa(r.invoice_count), value: (r) => r.invoice_count },
              { label: 'پروموشن', render: (r) => pct(r.promo_percent), value: (r) => r.promo_percent * 100, unit: '٪' },
            ]} />
        </article>
      </section>
    </>
  )
}

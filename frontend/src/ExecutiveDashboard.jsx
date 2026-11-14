import { useMemo, useState } from 'react'
import {
  Activity,
  ArrowDownLeft,
  BarChart3,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Medal,
  Store,
  Filter,
  HeartPulse,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  MapPin,
  PackageSearch,
  Percent,
  Printer,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  PackageX,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Undo2,
  UserCheck,
  UserPlus,
  UserRound,
  UserX,
  Users,
  X,
  MessageSquare,
} from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { postJson, useApi } from './api'
import { dayLabel, fa, fa2, faDigits, monthLabel, monthName } from './format'
import { Table } from './ui'
import { motion } from 'motion/react'
import { StatusIsland, HeroMetricCard, ForecastRings, CalendarGlass, KpiSpotlight, ShareTabsCard, CompareBento } from './overview/kokonut-overview'

const pct = (v) => (v == null ? '—' : `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(v * 100)}٪`)
const PIE_COLORS = ['#2563eb', '#0f766e', '#8b5cf6', '#f59e0b', '#ec4899', '#0ea5e9', '#84cc16', '#ef4444', '#94a3b8']
const PIE_BY = [['branch', 'شعبه'], ['region', 'منطقه'], ['brand', 'برند'], ['sales_type', 'کانال فروش'], ['group', 'لاین'], ['grade', 'گرید مشتری']]
const FILTER_LABELS = { group: 'لاین', city: 'شهر', state: 'منطقه شهرداری', brand: 'برند', main_group: 'گروه کالای اصلی', sub_group: 'زیرگروه کالای اصلی', product: 'کالا', grade: 'گرید مشتری' }
const PRODUCT_GROUP_KEYS = ['main_group', 'sub_group', 'product'] // hidden while the data has no product groups (product.tsv not loaded)

export const NAV = [
  ['overview', 'نمای کلی', LayoutDashboard], ['trend', 'روند روزانه', Activity], ['monthly', 'روند ماهانه', BarChart3],
  ['growth', 'آنالیز رشد و افت', Percent], ['target', 'تارگت', Target],
  ['branch', 'شعب و مناطق', MapPin], ['product', 'کالا و برند', ShoppingBag], ['profile', 'تحلیل شعبه و برند', Building2],
  ['pareto', 'تحلیل پارتو', TrendingUp], ['inactive', 'مشتریان غیرفعال', UserX], ['potential', 'مشتریان بالقوه', UserPlus], ['returns', 'برگشتی حواله', Undo2],
  ['quantity', 'تحلیل تعداد کالا', PackageSearch],
  ['invoice', 'تحلیل فاکتور', FileText], ['customer', 'پروفایل مشتری', UserRound], ['visitor', 'پروفایل ویزیتور', UserCheck],
  ['health', 'سلامت داده', HeartPulse], ['tickets', 'تیکت‌ها', MessageSquare], ['chat', 'دستیار هوشمند', Sparkles],
  ['club_b2b', 'باشگاه مشتریان (B2B)', Store], ['club_visitor', 'باشگاه ویزیتورها', Medal],
]

// Sidebar grouping only; NAV keeps its [id, label, Icon] shape for App.jsx routing.
// The third field marks a group as an expandable sub-menu.
const NAV_GROUPS = [
  ['فروش', ['overview', 'trend', 'monthly', 'growth', 'target'], false],
  ['تحلیل', ['branch', 'product', 'profile', 'pareto', 'inactive', 'potential', 'returns', 'quantity'], true],
  ['مشتری و فاکتور', ['invoice', 'customer', 'visitor'], true],
  ['سیستم', ['health'], true],
  ['پشتیبانی', ['tickets'], false],
  ['تحلیل هوشمند', ['chat'], false],
  ['باشگاه‌ها', ['club_b2b', 'club_visitor'], true],
]
// The admin entry is not a report page: App adds it only for principals with is_admin.
export const ADMIN_NAV = ['admin', 'مدیریت کاربران', ShieldCheck]

// Sections for the pages this principal may open (allowed = list of page ids, null = all); empty groups are dropped.
function buildSections(allowed, isAdmin) {
  const nav = allowed ? NAV.filter(([id]) => allowed.includes(id)) : NAV
  const hidden = isAdmin ? [] : ['health']
  const visible = nav.filter(([id]) => !hidden.includes(id))
  const grouped = NAV_GROUPS.map(([label, ids, collapsible]) => [label, visible.filter(([id]) => ids.includes(id)), collapsible])
  const rest = nav.filter(([id]) => !NAV_GROUPS.some(([, ids]) => ids.includes(id)))
  const out = (rest.length ? [...grouped, ['سایر', rest, true]] : grouped).filter(([, items]) => items.length)
  return isAdmin ? [...out, ['مدیریت', [ADMIN_NAV], false]] : out
}

function NavGroup({ label, items, collapsible, page, onNavigate, open, onToggle, index }) {
  const hasActive = items.some(([id]) => id === page)
  const listId = `exec-nav-items-${index}`
  return (
    <div className={`exec-nav-group ${collapsible ? 'collapsible' : ''} ${collapsible && !open ? 'closed' : ''}`} role="group" aria-label={label}>
      {collapsible ? (
        <button
          type="button"
          className="exec-nav-toggle text-[11px] font-bold text-white/40 mb-2 mt-6 px-3 tracking-wider flex items-center justify-between w-full hover:text-white/70 transition-colors select-none"
          aria-expanded={open}
          aria-controls={listId}
          onClick={onToggle}
        >
          <span>{label}</span>
          <div className="flex items-center gap-1.5">
            {!open && hasActive && <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3]" aria-label="صفحهٔ فعلی در این بخش است" />}
            <ChevronDown size={14} className={`transition-transform duration-200 text-white/40 ${open ? '' : 'rotate-90'}`} aria-hidden="true" />
          </div>
        </button>
      ) : (
        <div className="text-[11px] font-bold text-white/40 mb-2 mt-6 px-3 tracking-wider select-none">
          {label}
        </div>
      )}
      <div className="exec-nav-items" id={listId}>
        <div className="space-y-1">
          {items.map(([id, itemLabel, Icon]) => {
            const active = id === page
            return (
              <button
                type="button"
                key={id}
                className={`relative flex items-center gap-3 w-full px-3 py-2 rounded-xl text-xs font-medium transition-colors text-right select-none ${
                  active ? 'text-[#38BDF8] font-bold' : 'text-white/65 hover:bg-white/5 hover:text-white'
                }`}
                onClick={() => onNavigate(id)}
                title={itemLabel}
                aria-current={active ? 'page' : undefined}
              >
                {active && (
                  <motion.div
                    layoutId="sidebarActive"
                    className="absolute inset-0 rounded-xl bg-[#0071E3]/15 border border-[#0071E3]/30"
                    transition={{ type: 'spring', stiffness: 420, damping: 35 }}
                  />
                )}
                <i
                  className={`relative z-10 w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                    active ? 'bg-[#0071E3]/20 text-[#38BDF8]' : 'text-white/50'
                  }`}
                  aria-hidden="true"
                >
                  <Icon size={16} />
                </i>
                <span className="relative z-10 truncate">{itemLabel}</span>
              </button>
            )
          })}
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

const cleanDistrictLabel = (label) => (typeof label === 'string' ? label.replace(/\s*[-_]\s*[\d۰-۹]+$/, '').trim() : label)

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
  showFilters = true, hideMonth = false, error, partial, lastDataDate, syncState = 'never', syncNotice, onDismissNotice, onRefresh, onLogout, user, allowedPages = null, isAdmin = false, canSync = false, children,
}) {
  const [pwOpen, setPwOpen] = useState(false)
  const sections = useMemo(() => buildSections(allowedPages, isAdmin), [allowedPages, isAdmin])
  const [collapsed, setCollapsed] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [openGroups, setOpenGroups] = useState({})
  const running = syncState === 'running'
  const hasFilters = Boolean(month) || Object.keys(dims).length > 0
  return (
    <div className={`exec-root ${collapsed ? 'exec-collapsed' : ''}`} dir="rtl">
      <aside className="exec-sidebar bg-[#1C1C1E] border-l border-white/10 shadow-2xl backdrop-blur-xl">
        <div className="exec-brand flex items-center gap-3 px-2 py-3 border-b border-white/[0.08] mb-2">
          <span className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-md shadow-black/20 overflow-hidden shrink-0">
            <img src="/logo.jpg" alt="لوگوی کوپا گستر" className="w-full h-full object-cover" />
          </span>
          <div className="exec-brand-copy flex-1 min-w-0">
            <b className="text-sm font-bold text-white tracking-tight block">نبض فروش</b>
            <small className="text-[11px] text-white/40 truncate block">{cores[core] ?? ''}</small>
          </div>
          <button
            type="button"
            className="exec-collapse w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            aria-label={collapsed ? 'باز کردن منو' : 'جمع کردن منو'}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
        <nav className="exec-nav" aria-label="گزارش‌ها">
          {sections.map(([group, items, collapsible], i) => {
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
          {onLogout && (
            <div className="exec-profile bg-white/5 border border-white/10 rounded-2xl p-3 mx-2 mb-4 hover:bg-white/10 cursor-pointer transition-all">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF9500] to-[#FFB340] text-white flex items-center justify-center shadow-md shadow-orange-500/25 shrink-0" aria-hidden="true">
                <UserRound size={17} />
              </span>
              <div className="exec-profile-copy min-w-0 flex-1 px-1">
                <button type="button" className="exec-user-btn text-right font-bold text-xs text-white/90 hover:text-white truncate block w-full" onClick={() => setPwOpen(true)} title="تغییر رمز">
                  <b dir="ltr">{user || 'کاربر'}</b>
                </button>
                <small className="text-[10px] text-white/40 block">حساب کاربری</small>
              </div>
              {pwOpen && <PasswordDialog onClose={() => setPwOpen(false)} />}
              <button
                type="button"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                onClick={onLogout}
                aria-label="خروج از حساب"
                title="خروج از حساب"
              >
                <LogOut size={16} />
              </button>
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
            <StatusIsland core={core} cores={cores} setCore={page === 'admin' ? () => {} : setCore} lastDataDate={lastDataDate} syncState={syncState} />
            {canSync && (
              <button type="button" className="exec-refresh-mini" onClick={onRefresh} disabled={running} aria-label="به‌روزرسانی داده" title="به‌روزرسانی داده">
                <RefreshCw size={17} className={running ? 'spin' : ''} />
              </button>
            )}
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
                  {Object.entries(FILTER_LABELS).filter(([k]) => !PRODUCT_GROUP_KEYS.includes(k) || filters[k]?.length || dims[k]).map(([k, label]) => {
                    const rawOptions = filters[k] ?? []
                    const options = k === 'city'
                      ? rawOptions.filter((c) => typeof c === 'string' && !c.includes('منطقه'))
                      : k === 'state'
                      ? (rawOptions.some((c) => typeof c === 'string' && c.includes('منطقه'))
                          ? rawOptions.filter((c) => typeof c === 'string' && !c.includes('استان'))
                          : (filters.region ?? []).filter((c) => typeof c === 'string' && c.includes('منطقه')))
                      : rawOptions
                    return (
                      <QuickSelect key={k} label={label} value={dims[k] ?? ''} options={options} onChange={(v) => onFilterChange(k, v)} format={k === 'state' ? cleanDistrictLabel : (x) => x} />
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}

        <div className="exec-page w-full max-w-[1600px] mx-auto">{children}</div>
      </main>
    </div>
  )
}

function Metric({ icon: Icon, label, value, unit, tone = 'blue', onClick }) {
  const Tag = onClick ? 'button' : 'article'
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`exec-metric ${tone}${onClick ? ' clickable' : ''}`}>
      <div className="exec-metric-top"><i aria-hidden="true"><Icon size={18} /></i></div>
      <span className="exec-metric-label">{label}</span>
      <strong>{value}</strong>
      <small>{unit}</small>
    </Tag>
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

function ShareCardBento({ p }) {
  const [by, setBy] = useState('branch')
  const r = useApi('/breakdown', { ...p, by, limit: 40 })
  const slices = useMemo(() => {
    const pos = (r.data ?? []).filter((x) => x.sum_rial_vat > 0).sort((a, b) => b.sum_rial_vat - a.sum_rial_vat)
    const top = pos.slice(0, 8).map((x) => ({ name: String(x.key), value: x.sum_rial_vat }))
    const rest = pos.slice(8).reduce((s, x) => s + x.sum_rial_vat, 0)
    if (rest > 0) top.push({ name: 'سایر', value: rest })
    return top
  }, [r.data, by])
  const total = slices.reduce((s, x) => s + x.value, 0)
  if (r.error) return <div className="ov-empty kok">دریافت داده ناموفق بود.</div>
  if (!slices.length) return <div className="ov-empty kok">{r.loading ? 'در حال بارگذاری…' : 'داده‌ای وجود ندارد.'}</div>
  return <ShareTabsCard by={by} setBy={setBy} options={PIE_BY} slices={slices} total={total} colors={PIE_COLORS} />
}

const prevMonthKey = (ym) => (Number(ym.slice(4)) > 1 ? `${ym.slice(0, 4)}${String(Number(ym.slice(4)) - 1).padStart(2, '0')}` : null)
const spanOf = (ym, lastDay) => ({ start: `${ym.slice(0, 4)}/${ym.slice(4)}/01`, end: `${ym.slice(0, 4)}/${ym.slice(4)}/${String(lastDay).padStart(2, '0')}` })

function Delta({ cur, prev }) {
  if (!(prev > 0)) return <span className="exec-delta flat">—</span>
  const d = cur / prev - 1
  const up = d >= 0
  return <span className={`exec-delta ${up ? 'up' : 'down'}`}>{up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{pct(Math.abs(d))}</span>
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
    <div className="rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 h-full flex flex-col">
      <CardHead title="مقایسه با ماه قبل"
        note={ready ? `${monthLabel(ym)}${span} در برابر ${monthLabel(pym)}${span}` : 'برای مقایسه به دو ماه متوالی داده نیاز است'}
        chip={<span className="exec-chip blue">{partial ? 'هم‌بازه' : 'ماه کامل'}</span>} />
      <div className="flex-1 mt-4">
        {!c || !b ? <div className="exec-empty">{ready ? 'در حال بارگذاری…' : 'ماه قبلِ این دوره در داده موجود نیست.'}</div>
          : <CompareBento c={c} b={b} items={items} Delta={Delta} />}
      </div>
      {partial && <p className="exec-footnote mt-3">ماه جاری کامل نیست؛ برای انصاف، همان روزهای ابتدای ماه قبل مقایسه می‌شود.</p>}
    </div>
  )
}

/* ---------- محتوای نمای کلی ---------- */
function PasswordDialog({ onClose }) {
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (next.length < 8) return setErr('رمز جدید باید حداقل ۸ نویسه باشد')
    if (next !== again) return setErr('تکرار رمز با رمز جدید یکی نیست')
    try {
      await postJson('/admin/me/password', { current_password: cur, new_password: next })
      setOk(true)
    } catch (ex) {
      setErr(ex?.message || 'تغییر رمز انجام نشد')
    }
  }
  return (
    <div className="exec-modal-backdrop" role="dialog" aria-modal="true" aria-label="تغییر رمز" onClick={onClose}>
      <form className="exec-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>تغییر رمز</h3>
        {ok ? (
          <p>رمز تغییر کرد. نشست‌های دیگر بسته شدند؛ با رمز جدید وارد شوید.</p>
        ) : (
          <>
            <label>رمز فعلی<input type="password" dir="ltr" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></label>
            <label>رمز جدید<input type="password" dir="ltr" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required /></label>
            <label>تکرار رمز جدید<input type="password" dir="ltr" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required /></label>
            {err && <p className="exec-modal-err" role="alert">{err}</p>}
            <div className="exec-modal-actions">
              <button type="button" onClick={onClose}>انصراف</button>
              <button type="submit" className="primary">ثبت رمز جدید</button>
            </div>
          </>
        )}
        {ok && <div className="exec-modal-actions"><button type="button" className="primary" onClick={onClose}>بستن</button></div>}
      </form>
    </div>
  )
}

export default function ExecutiveDashboard({ p, cal, month, setMonth, onOpenReturns }) {
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
    <div className="w-full max-w-[1600px] mx-auto space-y-5">

      {/* ── Calendar status bar ──────────────────────────────── */}
      <CalendarGlass cal={cal} />

      {/* ── Hero Bento Row (Equal Height 8 Cols + 4 Cols) ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch w-full">
        <HeroMetricCard rows={rows} o={o} growth={netGrowth} growthLabel={growthLabel} period={month ? monthLabel(month) : 'همه ماه‌ها'} />
        <ForecastRings pace={pace} />
      </div>

      {/* ── 6×2 KPI widget grid ─────────────────────────────── */}
      <KpiSpotlight items={[
        { icon: CircleDollarSign, label: 'فروش ناخالص', value: o ? fa(o.sum_rial_vat) : '—', unit: 'ریال · شامل مالیات و عوارض', tone: 'blue' },
        { icon: PackageSearch, label: 'تعداد کالا', value: o ? fa(o.sum_qty) : '—', unit: 'عدد', tone: 'violet' },
        { icon: PackageSearch, label: 'تعداد کالا خالص', value: o ? fa(o.sum_qty_net) : '—', unit: 'عدد · منهای مرجوعی', tone: 'violet' },
        { icon: FileText, label: 'تعداد فاکتور', value: o ? fa(o.invoice_count) : '—', unit: 'فقره', tone: 'amber' },
        { icon: TrendingUp, label: 'درصد رشد فاکتور', value: pct(invoiceGrowth), unit: growthLabel ? `${growthLabel} نسبت به ماه قبل` : 'مقایسه با ماه قبل', tone: 'teal' },
        { icon: ListOrdered, label: 'میانگین سطر فاکتور', value: invoiceLines.data ? fa2(invoiceLines.data.avg_lines_per_invoice) : '—', unit: 'سطر در هر فاکتور', tone: 'sky' },
        { icon: Users, label: 'مشتری فعال', value: o ? fa(o.active_customers) : '—', unit: 'مشتری یکتا', tone: 'pink' },
        { icon: ArrowDownLeft, label: 'مجموع پروموشن', value: o ? fa(o.promo_total_rial) : '—', unit: 'ریال', tone: 'red' },
        { icon: Percent, label: 'درصد کل پروموشن', value: o ? pct(o.promo_percent) : '—', unit: 'از فروش ناخالص', tone: 'red' },
        { icon: Undo2, label: 'حواله‌های برگشتی', value: retTotal ? fa(retTotal.returned_orders) : '—', unit: retNote ?? `${pct(retTotal.returned_order_percent)} از ${fa(retTotal.orders)} حواله`, tone: 'amber', onClick: onOpenReturns },
        { icon: PackageX, label: 'درصد برگشتی حواله', value: retTotal ? pct(retTotal.return_percent) : '—', unit: retNote ?? `${fa(retTotal.return_rial)} ریال برگشتی`, tone: 'red', onClick: onOpenReturns },
        { icon: PackageX, label: 'تعداد فاکتور تحویلی', value: retTotal ? fa(retTotal.invoiced_orders) : '—', unit: retNote ?? `${pct(retTotal.invoiced_order_percent)} درصد تحویل`, tone: 'blue', onClick: onOpenReturns },
      ]} />

      {/* ── Bottom content grid ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">

        {/* Monthly sales chart */}
        <div className="lg:col-span-8 rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 flex flex-col">
          <CardHead title="روند فروش ماهانه" note="ریال خالص و فروش ناخالص · میلیارد ریال"
            chip={<span className="exec-legend-inline"><i style={{ background: '#2563eb' }} />خالص<i style={{ background: '#14b8a6' }} />ناخالص</span>} />
          <SalesChart rows={rows} />
        </div>

        {/* Sales share */}
        <div className="lg:col-span-4">
          <ShareCardBento p={p} />
        </div>

        {/* Month comparison */}
        <div className="lg:col-span-7">
          <CompareCard dims={dims} month={month} pace={pace} months={rows.map((r) => r.year_month)} />
        </div>

        {/* Daily trend chart */}
        <div className="lg:col-span-5 rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 flex flex-col exec-daily">
          <CardHead title="روند فروش روزانه" note={month ? `روزهای ${monthLabel(month)} · میلیارد ریال` : 'روزهای دورهٔ انتخاب‌شده · میلیارد ریال'}
            chip={<span className="exec-chip blue">Rial+Vat</span>} />
          <DailyChart rows={days} />
        </div>

        {/* Monthly summary table */}
        <div className="lg:col-span-12 rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
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
        </div>

      </div>
    </div>
  )
}

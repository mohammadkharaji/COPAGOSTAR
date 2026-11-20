import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { get, post, postJson, useApi } from './api'
import { monthLabel, monthRange } from './format'
import ExecutiveDashboard, { ExecShell, NAV } from './ExecutiveDashboard'
import { BranchRegionPage, CustomerPage, GrowthPage, HealthPage, InactiveCustomersPage, InvoicePage, MonthlyTrendPage, PotentialCustomersPage, QuantityPage, TicketsPage, ParetoPage, ProductBrandPage, ProfilePage, ReturnsPage, TrendPage, VisitorPage } from './pages'

const TargetPage = lazy(() => import('./TargetPage'))
const CustomerMetricsPage = lazy(() => import('./CustomerMetricsPage'))
const AdminPage = lazy(() => import('./AdminPage'))
const ChatPage = lazy(() => import('./ChatPage'))
const MobileWidgetView = lazy(() => import('./MobileWidgetView'))
const ClubPage = lazy(() => import('./ClubPages').then((m) => ({ default: m.ClubPage })))
const MyClub = lazy(() => import('./ClubPages').then((m) => ({ default: m.MyClub })))
const MyVisitorClub = lazy(() => import('./ClubPages').then((m) => ({ default: m.MyVisitorClub })))
const pageLoading = <div className="banner" dir="rtl" role="status">در حال بارگذاری صفحه…</div>

const CORES = { kg: 'کوپا گستر', ch: 'زنجیره‌ای' }
const SHARED_KEYS = ['month', 'branch', 'office', 'region', 'state', 'city', 'brand', 'group', 'grade', 'sales_type', 'main_group', 'sub_group', 'product', 'reason']
const PAGE_IDS = [...NAV.map(([k]) => k), 'admin', 'widget']
const CLUB_KIND = { club_b2b: 'b2b', club_visitor: 'visitor' }

export function getDefaultLandingPage(allowedPages = [], isAdmin = false) {
  const hasOverview = allowedPages.includes('overview')
  const clubPage = NAV.find(([k]) => CLUB_KIND[k] && allowedPages.includes(k))?.[0]
  const firstAllowedNav = NAV.find(([k]) => allowedPages.includes(k))?.[0]
  return hasOverview
    ? 'overview'
    : (clubPage ?? firstAllowedNav ?? (isAdmin ? 'admin' : null))
}
// An unknown page is '' here; App turns it (and any page the user may not open) into the first page they can access.
const parseHash = () => {
  const [path, query = ''] = location.hash.slice(1).split('?')
  const [rawPage, ...rest] = path.split('/')
  const page = decodeURIComponent(rawPage)
  const q = new URLSearchParams(query)
  return { page: PAGE_IDS.includes(page) ? page : '', arg: decodeURIComponent(rest.join('/')), q }
}
const pageFromHash = () => { const { page, arg } = parseHash(); return { page, arg } }
const initialState = () => {
  const { q } = parseHash()
  const dims = {}
  SHARED_KEYS.filter((k) => k !== 'month').forEach((k) => { if (q.get(k)) dims[k] = q.get(k) })
  return { core: CORES[q.get('core')] ? q.get('core') : 'kg', month: /^\d{6}$/.test(q.get('month') ?? '') ? q.get('month') : '', dims }
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full max-w-[1200px] mx-auto p-6 my-8" dir="rtl">
          <div className="rounded-3xl p-6 sm:p-8 bg-[#0B100E]/90 border border-emerald-500/20 text-[#F5F5F7] shadow-2xl backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center font-bold text-lg">
                ⚠️
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-100">خطا در بارگذاری بخش</h2>
                <p className="text-xs text-slate-400 mt-0.5">مشکلی در پردازش و نمایش این بخش رخ داده است.</p>
              </div>
            </div>
            {this.state.error && (
              <div className="p-4 rounded-2xl bg-black/40 border border-white/5 font-mono text-xs text-rose-300 overflow-x-auto" dir="ltr">
                {this.state.error?.toString()}
              </div>
            )}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.reload()
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-sm"
              >
                تلاش مجدد و بارگذاری صفحه
              </button>
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.hash = '#overview'
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-slate-200 transition-all cursor-pointer"
              >
                بازگشت به داشبورد
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App({ onLogout }) {
  const init = useMemo(initialState, [])
  const [core, setCore] = useState(init.core)
  const [route, setRoute] = useState(pageFromHash)
  const [month, setMonth] = useState(init.month)
  const [dims, setDims] = useState(init.dims)
  const [targetFilters, setTargetFilters] = useState({})
  const hashDriven = useRef(false)
  const [health, setHealth] = useState(null)
  const [meta, setMeta] = useState(null)
  const [quality, setQuality] = useState(null)
  const [cal, setCal] = useState(null)
  const [error, setError] = useState(null)
  const [ver, setVer] = useState(0)
  const [syncNotice, setSyncNotice] = useState('')
  // What this user may open comes from /auth/me (pages, cores, is_admin); the backend enforces the same rules.
  const me = useApi('/auth/me', {})
  const principal = me.data
  // `tickets` and `chat` are ordinary pages now: rbac.EXACT lists them, so /auth/me already carries them
  // for every role whose `pages` include them. No client-side exception is needed.
  const allowedPages = useMemo(() => principal?.pages ?? [], [principal])
  const allowedCores = useMemo(() => Object.keys(CORES).filter((k) => principal?.cores?.includes(k)), [principal])
  const visibleCores = useMemo(() => Object.fromEntries(allowedCores.map((k) => [k, CORES[k]])), [allowedCores])
  const isAdmin = Boolean(principal?.is_admin)
  // Default landing route:
  // 1. Users with access to 'overview' (Sales & Analytics) always land on 'overview'.
  // 2. Only fall back to club_b2b or club_visitor if the logged-in user's role strictly lacks access to 'overview'
  //    (such as a B2B customer account or a visitor account).
  // 3. Otherwise fall back to the first allowed page in NAV (or 'admin' for pure admins).
  const home = getDefaultLandingPage(allowedPages, isAdmin)
  const canOpen = (pg) => (pg === 'widget' ? Boolean(principal) : pg === 'admin' ? isAdmin : allowedPages.includes(pg))
  // A hash for a page the user may not open falls back to their first allowed page.
  const page = principal ? (canOpen(route.page) ? route.page : home) : null
  const arg = page === route.page ? route.arg : ''
  const reports = Boolean(principal) && page !== 'admin' && allowedCores.includes(core)
  const options = useApi('/filters', {
    core,
    v: ver,
    ...(dims.branch && { branch: dims.branch }),
    ...(dims.office && { office: dims.office }),
    ...(dims.region && { region: dims.region }),
    ...(dims.state && { state: dims.state }),
    ...(dims.city && { city: dims.city }),
    ...(dims.brand && { brand: dims.brand }),
    ...(dims.main_group && { main_group: dims.main_group }),
    ...(dims.product && { product: dims.product }),
  }, reports)
  const [tick, setTick] = useState(0)
  const biSync = useApi('/bi-sync/status', { t: tick })
  const biData = biSync.data
  const running = biData?.state === 'running' || biData?.state === 'staging'
  const syncState = running ? 'running' : (biData?.last_successful_sync ? 'ok' : 'never')
  const prevSync = useRef(syncState)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), running ? 3000 : 30000)
    return () => clearInterval(t)
  }, [running])
  useEffect(() => {
    if (prevSync.current === 'running' && syncState === 'ok') {
      setVer((n) => n + 1)
      setSyncNotice('داده‌ها مستقیماً از سرور مرکزی BI دریافت و با فرمول ۳گانه با موفقیت به‌روزرسانی شدند.')
    }
    if (prevSync.current === 'running' && biData?.state === 'failed') {
      setSyncNotice('به‌روزرسانی مستقیم BI ناموفق بود؛ داده‌های قبلی حفظ شدند.')
    }
    prevSync.current = syncState
  }, [syncState, biData?.state])

  useEffect(() => {
    const on = () => {
      const n = initialState()
      hashDriven.current = n.core !== prevCore.current
      setRoute(pageFromHash())
      setCore(n.core)
      setMonth(n.month)
      setDims((d) => (JSON.stringify(d) === JSON.stringify(n.dims) ? d : n.dims))
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  useEffect(() => {
    // /data-health is admin-only (rbac.ADMIN_ONLY_PAGES); asking for it as a normal user 403s and would take the
    // whole Promise.all down, so it is fetched separately and its failure stays local to the health page.
    Promise.all([get('/health'), get('/meta')])
      .then(([h, m]) => { setHealth(h); setMeta(m); setError(null) })
      .catch(() => setError('اتصال به API برقرار نیست. بک‌اند باید روی پورت ۸۰۰۰ اجرا باشد.'))
    if (isAdmin) get('/data-health').then(setQuality).catch(() => setQuality(null))
    get('/calendar').then(setCal).catch(() => setCal(null))
  }, [ver, isAdmin])
  const startSync = () => {
    if (!isAdmin) return
    postJson('/admin/bi-sync/trigger', {})
      .then(() => setTick((n) => n + 1))
      .catch(() => {
        post('/sync')
          .then(() => setTick((n) => n + 1))
          .catch(() => setError('شروع به‌روزرسانی ممکن نشد.'))
      })
  }
  const firstCore = useRef(true)
  const prevCore = useRef(core)
  // Start on, and never stay on, a core the user is not allowed to see (also covers a ?core= in the hash).
  useEffect(() => {
    if (principal && allowedCores.length && !allowedCores.includes(core)) setCore(allowedCores[0])
  }, [principal, allowedCores, core])
  useEffect(() => {
    if (firstCore.current) { firstCore.current = false; return }
    if (prevCore.current !== core && !hashDriven.current) { setMonth(''); setDims({}) }
    hashDriven.current = false
    prevCore.current = core
  }, [core])

  const buildHash = (page, arg = '') => {
    const q = new URLSearchParams()
    if (core !== 'kg') q.set('core', core)
    if (month) q.set('month', month)
    Object.entries(dims).forEach(([k, v]) => q.set(k, v))
    const qs = q.toString()
    return `${page}${arg ? `/${encodeURIComponent(arg)}` : ''}${qs ? `?${qs}` : ''}`
  }
  const go = (page, arg = '') => { location.hash = buildHash(page, arg) }
  const openProfile = (by, key) => {
    if (by === 'visitor') {
      go('visitor', key)
    } else {
      go('profile', `${by}~${key}`)
    }
  }
  const p = useMemo(() => ({ core, ...(month ? monthRange(month) : {}), ...dims, v: ver }), [core, month, dims, ver])
  const partial = Boolean(health && health.status !== 'ready')
  const setDim = (k, v) => setDims((d) => {
    const n = { ...d }
    if (v) n[k] = v; else delete n[k]
    if (k === 'branch' && d.branch !== v) { delete n.region; delete n.state; delete n.city; delete n.office }
    if (k === 'city' && d.city !== v) { delete n.state; delete n.region }
    if (k === 'brand' && d.brand !== v) { delete n.main_group; delete n.product; delete n.sub_group }
    if (k === 'main_group' && d.main_group !== v) { delete n.product; delete n.sub_group }
    return n
  })
  useEffect(() => {
    if (!principal) return
    const next = `#${buildHash(page ?? '', arg)}`
    if (location.hash !== next) {
      if (!location.hash || location.hash === '#' || !canOpen(route.page)) {
        window.location.hash = next
      } else {
        history.replaceState(null, '', next)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [principal, core, month, dims, page, arg])
  if (me.error) return <div className="exec-alert err" role="alert" dir="rtl">دریافت اطلاعات حساب ناموفق بود.</div>
  if (!principal) return <div className="banner" dir="rtl">در حال بارگذاری…</div>

  if (page === 'widget') {
    return <ErrorBoundary key={page}><Suspense fallback={pageLoading}><MobileWidgetView principal={principal} core={core} month={month} filters={targetFilters[core] || {}} onNavigate={go} onLogout={onLogout} /></Suspense></ErrorBoundary>
  }

  const title = page === 'admin' ? 'مدیریت کاربران و نقش‌ها' : page ? (NAV.find(([k]) => k === page)?.[1] ?? 'گزارش') : 'بدون دسترسی'
  const subtitle = page === 'chat'
    ? 'پرسش و پاسخ روی دادهٔ فروش · پاسخ‌ها فقط از هسته‌ها و شعب مجاز همین حساب خوانده می‌شوند'
    : page === 'admin'
    ? 'کاربران، نقش‌ها و گزارش رویدادهای سامانه'
    : !page
      ? 'برای این حساب صفحه‌ای فعال نشده است؛ با مدیر سامانه تماس بگیرید.'
    : page === 'target'
    ? 'پیشرفت فروش نسبت به تارگت ماهانه · مبالغ به ریال و شامل مالیات و عوارض'
    : page === 'customer_metrics'
    ? 'سنجش شاخص‌های خرید، ریزش، بازگشت، ارزش طول عمر (CLV) و رفتار سبد فاکتورها'
    : page === 'returns'
      ? `دوره: ${month ? monthLabel(month) : 'همه ماه‌ها'} · حواله‌های پخش، مبالغ به ریال · جدا از ردیف‌های مرجوعی فروش (SR)`
      : `دوره: ${month ? monthLabel(month) : 'همه ماه‌ها'} · مبالغ به ریال و شامل مالیات و عوارض`

  return (
    <ExecShell
      page={page} arg={arg} onNavigate={go} core={core} cores={visibleCores} setCore={setCore} title={title} subtitle={subtitle}
      month={month} setMonth={setMonth} filters={options.data ?? {}} dims={dims} onFilterChange={setDim}
      onReset={() => { setMonth(''); setDims({}) }} showFilters={reports && !['health', 'customer', 'target', 'chat', 'club_b2b', 'club_visitor', 'customer_metrics'].includes(page)} hideMonth={['monthly', 'growth', 'inactive', 'potential', 'customer_metrics', 'chat', 'club_b2b', 'club_visitor'].includes(page)}
      error={error} partial={partial} lastDataDate={health?.last_data_date} syncState={syncState} syncNotice={syncNotice} syncMessage={biData?.message} syncProgress={biData?.progress} onDismissNotice={() => setSyncNotice('')} onRefresh={startSync} onLogout={onLogout} user={principal.user}
      allowedPages={allowedPages} isAdmin={isAdmin} canSync={isAdmin}
    >
      <ErrorBoundary key={page}>
        <Suspense fallback={pageLoading}>
        {page === 'admin' && isAdmin && <AdminPage />}
        {page === 'chat' && <ChatPage />}
        {page in CLUB_KIND && reports && (principal.is_admin
          ? <ClubPage kind={CLUB_KIND[page]} core={core} arg={arg} />
          : CLUB_KIND[page] === 'visitor' ? <MyVisitorClub arg={arg} /> : <MyClub arg={arg} />)}
        {page && page !== 'admin' && !allowedCores.length && <div className="empty">برای این حساب هسته‌ای فعال نشده است.</div>}
        {reports && page !== 'admin' && <>
        {page === 'overview' && (
          <ExecutiveDashboard
            p={p}
            cal={cal}
            month={month}
            setMonth={setMonth}
            dims={dims}
            onFilterChange={setDim}
            filters={options.data ?? {}}
            onReset={() => { setMonth(''); setDims({}) }}
            onOpenReturns={() => go('returns')}
            onOpenTickets={() => go('tickets')}
            onNavigate={go}
          />
        )}
        {page === 'trend' && <TrendPage p={p} />}
        {page === 'monthly' && <MonthlyTrendPage p={p} />}
          {page === 'target' && <TargetPage key={core} core={core} selectedMonth={month} onMonthChange={setMonth} selectedFilters={targetFilters[core] || {}} onFiltersChange={(next) => setTargetFilters((prev) => ({ ...prev, [core]: next }))} />}
        {page === 'growth' && <GrowthPage p={p} />}
        {page === 'branch' && <BranchRegionPage p={p} openProfile={openProfile} openVisitor={(c) => go('visitor', c)} />}
        {page === 'product' && <ProductBrandPage p={p} openProfile={openProfile} />}
        {page === 'profile' && <ProfilePage p={p} arg={arg} openProfile={openProfile} back={() => go('profile')} openCustomer={(c) => go('customer', c)} openVisitor={(c) => go('visitor', c)} />}
        {page === 'pareto' && <ParetoPage p={p} openCustomer={(c) => go('customer', c)} openVisitor={(c) => go('visitor', c)} openProfile={openProfile} />}
        {page === 'visitor' && <VisitorPage p={p} code={arg} setCode={(c) => go('visitor', c)} openCustomer={(c) => go('customer', c)} openReturns={(a) => go('returns', a)} />}
        {page === 'returns' && <ReturnsPage p={p} arg={arg} setArg={(a) => go('returns', a)} openCustomer={(c) => go('customer', c)} onReason={(v) => setDim('reason', v)} />}
        {page === 'quantity' && <QuantityPage p={p} />}
        {page === 'invoice' && <InvoicePage p={p} />}
        {page === 'inactive' && <InactiveCustomersPage p={p} openCustomer={(c) => go('customer', c)} openVisitor={(c) => go('visitor', c)} />}
        {page === 'potential' && <PotentialCustomersPage p={p} openCustomer={(c) => go('customer', c)} openVisitor={(c) => go('visitor', c)} />}
        {page === 'customer_metrics' && <CustomerMetricsPage p={p} core={core} setCore={setCore} openCustomer={(c) => go('customer', c)} />}
        {page === 'customer' && <CustomerPage key={arg} core={core} code={arg} setCode={(c) => go('customer', c)} openReturns={(a) => go('returns', a)} />}
        {page === 'health' && <HealthPage health={health} meta={meta} quality={quality} biSync={biSync} onTriggerBiSync={startSync} isAdmin={isAdmin} />}
        {page === 'tickets' && <TicketsPage isAdmin={!!me.data?.is_admin} />}
        </>}
        </Suspense>
      </ErrorBoundary>
    </ExecShell>
  )
}

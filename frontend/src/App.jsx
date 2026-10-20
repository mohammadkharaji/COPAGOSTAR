import TargetPage from './TargetPage'
import AdminPage from './AdminPage'
import { useEffect, useMemo, useRef, useState } from 'react'
import { get, post, useApi } from './api'
import { monthLabel, monthRange } from './format'
import ExecutiveDashboard, { ExecShell, NAV } from './ExecutiveDashboard'
import { BranchRegionPage, CustomerPage, GrowthPage, HealthPage, InactiveCustomersPage, InvoicePage, MonthlyTrendPage, ParetoPage, ProductBrandPage, ProfilePage, ReturnsPage, TrendPage, VisitorPage } from './pages'

const CORES = { kg: 'کوپا گستر', ch: 'زنجیره‌ای' }
const SHARED_KEYS = ['month', 'branch', 'region', 'state', 'city', 'brand', 'group', 'grade', 'sales_type', 'main_group', 'sub_group']
const PAGE_IDS = [...NAV.map(([k]) => k), 'admin']
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

export default function App({ onLogout }) {
  const init = useMemo(initialState, [])
  const [core, setCore] = useState(init.core)
  const [route, setRoute] = useState(pageFromHash)
  const [month, setMonth] = useState(init.month)
  const [dims, setDims] = useState(init.dims)
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
  const allowedPages = useMemo(() => principal?.pages ?? [], [principal])
  const allowedCores = useMemo(() => Object.keys(CORES).filter((k) => principal?.cores?.includes(k)), [principal])
  const visibleCores = useMemo(() => Object.fromEntries(allowedCores.map((k) => [k, CORES[k]])), [allowedCores])
  const isAdmin = Boolean(principal?.is_admin)
  const home = NAV.find(([k]) => allowedPages.includes(k))?.[0] ?? (isAdmin ? 'admin' : null)
  const canOpen = (pg) => (pg === 'admin' ? isAdmin : allowedPages.includes(pg))
  // A hash for a page the user may not open falls back to their first allowed page.
  const page = principal ? (canOpen(route.page) ? route.page : home) : null
  const arg = page === route.page ? route.arg : ''
  const reports = Boolean(principal) && page !== 'admin' && allowedCores.includes(core)
  const options = useApi('/filters', { core, v: ver, ...(dims.branch && { branch: dims.branch }), ...(dims.region && { region: dims.region }), ...(dims.state && { state: dims.state }), ...(dims.city && { city: dims.city }), ...(dims.main_group && { main_group: dims.main_group }) }, reports)
  const [tick, setTick] = useState(0)
  const sync = useApi('/sync-status', { t: tick })
  const syncState = sync.data?.state
  const running = syncState === 'running'
  const prevSync = useRef(syncState)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), running ? 4000 : 60000)
    return () => clearInterval(t)
  }, [running])
  useEffect(() => {
    if (prevSync.current === 'running' && syncState === 'ok') {
      setVer((n) => n + 1)
      setSyncNotice('داده‌ها با موفقیت به‌روزرسانی شدند.')
    }
    if (prevSync.current === 'running' && syncState === 'failed') setSyncNotice('به‌روزرسانی ناموفق بود؛ دادهٔ قبلی حفظ شد.')
    prevSync.current = syncState
  }, [syncState])

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
    Promise.all([get('/health'), get('/meta'), get('/data-health')])
      .then(([h, m, q]) => { setHealth(h); setMeta(m); setQuality(q); setError(null) })
      .catch(() => setError('اتصال به API برقرار نیست. بک‌اند باید روی پورت ۸۰۰۰ اجرا باشد.'))
    get('/calendar').then(setCal).catch(() => setCal(null))
  }, [ver])
  const startSync = () => {
    if (!isAdmin) return
    post('/sync')
      .then(() => setTick((n) => n + 1))
      .catch(() => setError('شروع به‌روزرسانی ممکن نشد.'))
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
  const openProfile = (by, key) => go('profile', `${by}~${key}`)
  const p = useMemo(() => ({ core, ...(month ? monthRange(month) : {}), ...dims, v: ver }), [core, month, dims, ver])
  const partial = Boolean(health && health.status !== 'ready')
  const setDim = (k, v) => setDims((d) => {
    const n = { ...d }
    if (v) n[k] = v; else delete n[k]
    if (k === 'branch' && d.branch !== v) { delete n.region; delete n.state; delete n.city }
    if (k === 'main_group' && d.main_group !== v) delete n.sub_group
    return n
  })
  useEffect(() => {
    if (!principal) return
    const next = `#${buildHash(page ?? '', arg)}`
    if (location.hash !== next) history.replaceState(null, '', next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [principal, core, month, dims, page, arg])
  if (me.error) return <div className="exec-alert err" role="alert" dir="rtl">دریافت اطلاعات حساب ناموفق بود.</div>
  if (!principal) return <div className="banner" dir="rtl">در حال بارگذاری…</div>
  const title = page === 'admin' ? 'مدیریت کاربران و نقش‌ها' : page ? NAV.find(([k]) => k === page)[1] : 'بدون دسترسی'
  const subtitle = page === 'admin'
    ? 'کاربران، نقش‌ها و گزارش رویدادهای سامانه'
    : !page
      ? 'برای این حساب صفحه‌ای فعال نشده است؛ با مدیر سامانه تماس بگیرید.'
    : page === 'target'
    ? 'پیشرفت فروش نسبت به تارگت ماهانه · مبالغ به ریال و شامل مالیات و عوارض'
    : page === 'returns'
      ? `دوره: ${month ? monthLabel(month) : 'همه ماه‌ها'} · حواله‌های پخش، مبالغ به ریال · جدا از ردیف‌های مرجوعی فروش (SR)`
      : `دوره: ${month ? monthLabel(month) : 'همه ماه‌ها'} · مبالغ به ریال و شامل مالیات و عوارض`

  return (
    <ExecShell
      page={page} onNavigate={go} core={core} cores={visibleCores} setCore={setCore} title={title} subtitle={subtitle}
      month={month} setMonth={setMonth} filters={options.data ?? {}} dims={dims} onFilterChange={setDim}
      onReset={() => { setMonth(''); setDims({}) }} showFilters={reports && page !== 'health' && page !== 'customer' && page !== 'target'} hideMonth={page === 'monthly' || page === 'growth' || page === 'inactive'}
      error={error} partial={partial} lastDataDate={health?.last_data_date} syncState={syncState} syncNotice={syncNotice} onDismissNotice={() => setSyncNotice('')} onRefresh={startSync} onLogout={onLogout} user={principal.user}
      allowedPages={allowedPages} isAdmin={isAdmin} canSync={isAdmin}
    >
      {page === 'admin' && isAdmin && <AdminPage />}
      {page && page !== 'admin' && !allowedCores.length && <div className="empty">برای این حساب هسته‌ای فعال نشده است.</div>}
      {reports && page !== 'admin' && <>
      {page === 'overview' && <ExecutiveDashboard p={p} cal={cal} month={month} setMonth={setMonth} />}
      {page === 'trend' && <TrendPage p={p} />}
      {page === 'monthly' && <MonthlyTrendPage p={p} />}
      {page === 'target' && <TargetPage key={core} core={core} />}
      {page === 'growth' && <GrowthPage p={p} />}
      {page === 'branch' && <BranchRegionPage p={p} openProfile={openProfile} />}
      {page === 'product' && <ProductBrandPage p={p} openProfile={openProfile} />}
      {page === 'profile' && <ProfilePage p={p} arg={arg} openProfile={openProfile} back={() => go('profile')} openCustomer={(c) => go('customer', c)} openVisitor={(c) => go('visitor', c)} />}
      {page === 'pareto' && <ParetoPage p={p} openCustomer={(c) => go('customer', c)} openVisitor={(c) => go('visitor', c)} openProfile={openProfile} />}
      {page === 'visitor' && <VisitorPage p={p} code={arg} setCode={(c) => go('visitor', c)} openCustomer={(c) => go('customer', c)} openReturns={(a) => go('returns', a)} />}
      {page === 'returns' && <ReturnsPage p={p} arg={arg} setArg={(a) => go('returns', a)} openCustomer={(c) => go('customer', c)} />}
      {page === 'invoice' && <InvoicePage p={p} />}
      {page === 'inactive' && <InactiveCustomersPage p={p} openCustomer={(c) => go('customer', c)} openVisitor={(c) => go('visitor', c)} />}
      {page === 'customer' && <CustomerPage key={arg} core={core} code={arg} setCode={(c) => go('customer', c)} openReturns={(a) => go('returns', a)} />}
      {page === 'health' && <HealthPage health={health} meta={meta} quality={quality} />}
      </>}
    </ExecShell>
  )
}

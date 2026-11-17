import { useEffect, useMemo, useState } from 'react'
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
  LayoutGrid,
  ListOrdered,
  LogOut,
  MapPin,
  Menu,
  PackageSearch,
  Percent,
  Printer,
  Receipt,
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
import { billions1, dayLabel, fa, fa2, faDigits, monthLabel, monthName } from './format'
import { Table } from './ui'
import { motion, AnimatePresence } from 'motion/react'
import { HeroMetricCard, ForecastRings, CalendarGlass, KpiSpotlight, ShareTabsCard, CompareBento } from './overview/kokonut-overview'
import { useAppearance } from './AppearanceContext'
import AmbientCanvas from './AmbientCanvas'
import AppearanceSwitcher from './AppearanceSwitcher'
import DynamicIslandHeader from './DynamicIslandHeader'

const pct = (v) => (v == null ? '—' : `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(v * 100)}٪`)
const PIE_COLORS = ['#2563eb', '#0f766e', '#8b5cf6', '#f59e0b', '#ec4899', '#0ea5e9', '#84cc16', '#ef4444', '#94a3b8']
const PIE_BY = [['branch', 'شعبه'], ['region', 'منطقه'], ['brand', 'برند'], ['main_group', 'گروه کالا'], ['grade', 'گرید مشتری']]
const FILTER_LABELS = {
  brand: 'برند',
  main_group: 'گروه کالا',
  product: 'کالا',
  city: 'شهر',
  state: 'منطقه شهرداری',
  grade: 'گرید مشتری',
  group: 'لاین فروشگاهی',
}
const PRODUCT_GROUP_KEYS = ['main_group', 'product']

export const NAV = [
  ['overview', 'نمای کلی', LayoutDashboard], ['trend', 'روند روزانه', Activity], ['monthly', 'روند ماهانه', BarChart3],
  ['growth', 'آنالیز رشد و افت', Percent], ['target', 'تارگت', Target],
  ['branch', 'شعب و مناطق', MapPin], ['product', 'کالا و برند', ShoppingBag], ['profile', 'تحلیل شعبه و برند', Building2],
  ['pareto', 'تحلیل پارتو', TrendingUp], ['customer_metrics', 'آنالیز شاخصهای خرید مشتریان', Users], ['inactive', 'مشتریان غیرفعال', UserX], ['potential', 'مشتریان بالقوه', UserPlus], ['returns', 'برگشتی حواله', Undo2],
  ['quantity', 'تحلیل تعداد کالا', PackageSearch],
  ['invoice', 'تحلیل فاکتور', FileText], ['customer', 'پروفایل مشتری', UserRound], ['visitor', 'پروفایل ویزیتور', UserCheck],
  ['health', 'سلامت داده', HeartPulse], ['tickets', 'تیکت‌ها', MessageSquare], ['chat', 'دستیار هوشمند', Sparkles],
  ['club_b2b', 'باشگاه مشتریان (B2B)', Store], ['club_visitor', 'باشگاه ویزیتورها', Medal],
]

export const ADMIN_NAV = ['admin', 'مدیریت کاربران و نقش‌ها', ShieldCheck]

/* ---------------- 3-Pillar Modular Definitions ---------------- */
export const MODULAR_PILLARS = [
  {
    id: 'sales',
    label: 'آنالیز و فروش',
    badge: 'تحلیلی',
    accentColor: '#0071E3',
    activeClass: 'active-sales',
    icon: BarChart3,
    subgroups: [
      {
        id: 'sales_perf',
        label: 'فروش و عملکرد',
        icon: TrendingUp,
        items: [
          { id: 'overview', label: 'نمای کلی', icon: LayoutDashboard },
          { id: 'trend', label: 'روند روزانه', icon: Activity },
          { id: 'monthly', label: 'روند ماهانه', icon: BarChart3 },
          { id: 'growth', label: 'آنالیز رشد و افت', icon: Percent },
          { id: 'target', label: 'تارگت', icon: Target },
        ],
      },
      {
        id: 'branches_products',
        label: 'شعب، کالا و پارتو',
        icon: Building2,
        items: [
          { id: 'branch', label: 'شعب و مناطق', icon: MapPin },
          { id: 'product', label: 'کالا و برند', icon: ShoppingBag },
          { id: 'profile', label: 'تحلیل شعبه و برند', icon: Building2 },
          { id: 'pareto', label: 'تحلیل پارتو', icon: TrendingUp },
          { id: 'returns', label: 'برگشتی حواله', icon: Undo2 },
          { id: 'quantity', label: 'تحلیل تعداد کالا', icon: PackageSearch },
        ],
      },
      {
        id: 'customers_invoices',
        label: 'مشتریان و فاکتورها',
        icon: Users,
        items: [
          { id: 'customer_metrics', label: 'آنالیز شاخصهای خرید مشتریان', icon: Users },
          { id: 'inactive', label: 'مشتریان غیرفعال', icon: UserX },
          { id: 'potential', label: 'مشتریان بالقوه', icon: UserPlus },
          { id: 'invoice', label: 'تحلیل فاکتور', icon: FileText },
          { id: 'customer', label: 'پروفایل مشتری', icon: UserRound },
          { id: 'visitor', label: 'پروفایل ویزیتور', icon: UserCheck },
        ],
      },
    ],
  },
  {
    id: 'club_b2b',
    label: 'باشگاه مشتریان (B2B)',
    badge: 'طلایی',
    accentColor: '#D97706',
    activeClass: 'active-club',
    icon: Store,
    items: [
      { id: 'club_b2b', arg: 'dashboard', label: 'داشبورد باشگاه مشتریان', icon: Store },
      { id: 'club_b2b', arg: 'tiers', label: 'سطوح وفاداری (برنزی، نقره‌ای، طلایی)', icon: Medal },
      { id: 'club_b2b', arg: 'points', label: 'امتیازات و جوایز', icon: Sparkles },
    ],
  },
  {
    id: 'club_visitor',
    label: 'باشگاه ویزیتورها',
    badge: 'تیم فروش',
    accentColor: '#059669',
    activeClass: 'active-visitor',
    icon: Medal,
    items: [
      { id: 'club_visitor', arg: 'dashboard', label: 'داشبورد ویزیتورها', icon: Medal },
      { id: 'club_visitor', arg: 'targets', label: 'تحقق تارگت و پورسانت', icon: Target },
      { id: 'club_visitor', arg: 'rankings', label: 'رتبه‌بندی و چالش‌ها', icon: TrendingUp },
    ],
  },
]

export const UTILITY_PILLAR = {
  id: 'utility',
  label: 'امکانات و سامانه',
  accentColor: '#0071E3',
  activeClass: 'active-sales',
  icon: Sparkles,
  items: [
    { id: 'chat', label: 'دستیار هوشمند', icon: Sparkles, adminOnly: true },
    { id: 'tickets', label: 'تیکت‌ها', icon: MessageSquare },
    { id: 'admin', label: 'مدیریت کاربران و نقش‌ها', icon: ShieldCheck, adminOnly: true },
    { id: 'health', label: 'سلامت داده', icon: HeartPulse, adminOnly: true },
  ],
}

export function isItemActive(item, currentPage, currentArg = '') {
  if (item.id === 'club_b2b') {
    if (currentPage !== 'club_b2b') return false
    if (!item.arg || item.arg === 'dashboard') {
      return !currentArg || currentArg === 'dashboard'
    }
    return currentArg === item.arg
  }
  if (item.id === 'club_visitor') {
    if (currentPage !== 'club_visitor') return false
    if (!item.arg || item.arg === 'dashboard') {
      return !currentArg || currentArg === 'dashboard'
    }
    return currentArg === item.arg
  }
  return currentPage === item.id
}
const TIP = {
  contentStyle: { background: '#0f1d3a', border: 0, borderRadius: 12, boxShadow: '0 14px 30px -10px rgba(15,29,58,.6)', direction: 'rtl', fontFamily: 'Vazirmatn, sans-serif', fontSize: 12 },
  itemStyle: { color: '#fff' },
  labelStyle: { color: '#93a7c9', marginBottom: 4 },
}
const TIP_DARK = {
  contentStyle: { background: 'rgba(28, 28, 30, 0.95)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: 14, boxShadow: '0 14px 30px -10px rgba(0,0,0,.6)', direction: 'rtl', fontFamily: 'Vazirmatn, sans-serif', fontSize: 12, backdropFilter: 'blur(16px)' },
  itemStyle: { color: '#F5F5F7' },
  labelStyle: { color: '#98989D', marginBottom: 4 },
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
  page, arg = '', onNavigate, core, cores, setCore, title, subtitle, month, setMonth, filters = {}, dims = {}, onFilterChange, onReset,
  showFilters = true, hideMonth = false, error, partial, lastDataDate, syncState = 'never', syncNotice, syncMessage = '', syncProgress = 0, onDismissNotice, onRefresh, onLogout, user, allowedPages = null, isAdmin = false, canSync = false, children,
}) {
  const { mode, isDark, isSolid, isLight } = useAppearance()
  const [pwOpen, setPwOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const running = syncState === 'running'
  const hasFilters = Boolean(month) || Object.keys(dims).length > 0

  // Filter pillars by user permissions
  const filteredPillars = useMemo(() => {
    return MODULAR_PILLARS.map((pillar) => {
      if (pillar.id === 'sales') {
        const subgroups = pillar.subgroups
          .map((sg) => ({
            ...sg,
            items: sg.items.filter((item) => (allowedPages ? allowedPages.includes(item.id) : true)),
          }))
          .filter((sg) => sg.items.length > 0)
        return { ...pillar, subgroups }
      }
      if (pillar.id === 'club_b2b') {
        const allowed = !allowedPages || allowedPages.includes('club_b2b')
        return allowed ? pillar : null
      }
      if (pillar.id === 'club_visitor') {
        const allowed = !allowedPages || allowedPages.includes('club_visitor')
        return allowed ? pillar : null
      }
      return pillar
    }).filter(Boolean)
  }, [allowedPages])

  const filteredUtility = useMemo(() => {
    const items = UTILITY_PILLAR.items.filter((item) => {
      if (item.id === 'admin') return isAdmin
      if (item.id === 'chat') return isAdmin && (!allowedPages || allowedPages.includes('chat'))
      if (item.id === 'health') return isAdmin
      return !allowedPages || allowedPages.includes(item.id)
    })
    return { ...UTILITY_PILLAR, items }
  }, [allowedPages, isAdmin])

  // Accordion state for the 3 pillars + utility section
  const [openPillars, setOpenPillars] = useState(() => ({
    sales: true,
    club_b2b: page === 'club_b2b',
    club_visitor: page === 'club_visitor',
    utility: ['chat', 'tickets', 'admin', 'health'].includes(page),
  }))

  // Accordion state for the 3 independent subgroups under 'sales'
  const [openSubgroups, setOpenSubgroups] = useState(() => ({
    sales_perf: !page || page === 'overview' || ['overview', 'trend', 'monthly', 'growth', 'target'].includes(page),
    branches_products: ['branch', 'product', 'profile', 'pareto', 'returns', 'quantity'].includes(page),
    customers_invoices: ['customer_metrics', 'inactive', 'potential', 'invoice', 'customer', 'visitor'].includes(page),
  }))

  // Auto-expand pillar and the specific subgroup that contains the active page
  useEffect(() => {
    if (['overview', 'trend', 'monthly', 'growth', 'target'].includes(page) || !page) {
      setOpenPillars((s) => ({ ...s, sales: true }))
      setOpenSubgroups((s) => ({ ...s, sales_perf: true }))
    } else if (['branch', 'product', 'profile', 'pareto', 'returns', 'quantity'].includes(page)) {
      setOpenPillars((s) => ({ ...s, sales: true }))
      setOpenSubgroups((s) => ({ ...s, branches_products: true }))
    } else if (['customer_metrics', 'inactive', 'potential', 'invoice', 'customer', 'visitor'].includes(page)) {
      setOpenPillars((s) => ({ ...s, sales: true }))
      setOpenSubgroups((s) => ({ ...s, customers_invoices: true }))
    } else if (page === 'club_b2b') {
      setOpenPillars((s) => ({ ...s, club_b2b: true }))
    } else if (page === 'club_visitor') {
      setOpenPillars((s) => ({ ...s, club_visitor: true }))
    } else if (['chat', 'tickets', 'admin', 'health'].includes(page)) {
      setOpenPillars((s) => ({ ...s, utility: true }))
    }
  }, [page, arg])

  const currentPageLabel = useMemo(() => {
    if (page === 'admin') return 'مدیریت کاربران'
    const found = NAV.find(([id]) => id === page)
    return found ? found[1] : (title || 'صفحه اصلی')
  }, [page, title])

  const DOCK_TABS = [
    { id: 'overview', label: 'نمای کلی', icon: LayoutDashboard },
    { id: 'trend', label: 'روند روزانه', icon: Activity },
    { id: 'target', label: 'تارگت', icon: Target },
    { id: 'profile', label: 'تحلیل', icon: Building2 },
  ]
  const isMoreActive = mobileMenuOpen || !DOCK_TABS.some((t) => t.id === page)

  // Render individual navigation menu item with strict inline style for active state
  const renderMenuItem = (item, pillar, isCollapsed) => {
    const active = isItemActive(item, page, arg)
    const Icon = item.icon
    const activeStyle = {
      backgroundColor: pillar.accentColor,
      color: '#FFFFFF',
    }

    const handleClick = () => {
      if (item.arg) {
        onNavigate(item.id, item.arg === 'dashboard' ? '' : item.arg)
      } else {
        onNavigate(item.id)
      }
    }

    if (isCollapsed) {
      return (
        <button
          type="button"
          key={`${item.id}-${item.arg || ''}`}
          style={active ? activeStyle : undefined}
          className={`w-10 h-10 mx-auto rounded-[14px] flex items-center justify-center transition-all select-none ${
            active
              ? `active ${pillar.activeClass} !text-white shadow-md`
              : isDark
              ? 'text-slate-300 hover:text-white hover:bg-white/10'
              : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04]'
          }`}
          onClick={handleClick}
          title={item.label}
          aria-label={item.label}
          aria-current={active ? 'page' : undefined}
        >
          <Icon size={18} style={active ? { color: '#FFFFFF' } : {}} className={active ? '!text-white' : undefined} />
        </button>
      )
    }

    return (
      <button
        type="button"
        key={`${item.id}-${item.arg || ''}`}
        style={active ? activeStyle : undefined}
        className={`relative flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-medium transition-all text-right select-none ${
          active
            ? `active ${pillar.activeClass} !text-white font-bold shadow-md`
            : isDark
            ? 'text-slate-300 hover:text-white hover:bg-white/10'
            : isSolid
            ? 'text-[#1D1D1F] hover:bg-slate-100'
            : 'text-[#1D1D1F] hover:bg-black/[0.04]'
        }`}
        onClick={handleClick}
        title={item.label}
        aria-current={active ? 'page' : undefined}
      >
        <i
          className={`relative z-10 w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
            active
              ? 'bg-white/20 !text-white'
              : isDark
              ? 'bg-white/5 text-slate-400'
              : 'bg-black/[0.03] text-[#86868B]'
          }`}
          style={active ? { color: '#FFFFFF' } : {}}
          aria-hidden="true"
        >
          <Icon size={15} style={active ? { color: '#FFFFFF' } : {}} className={active ? '!text-white' : undefined} />
        </i>
        <span
          className={`relative z-10 truncate ${active ? '!text-white font-bold' : ''}`}
          style={active ? { color: '#FFFFFF' } : {}}
        >
          {item.label}
        </span>
      </button>
    )
  }

  return (
    <div
      className={`exec-root ${collapsed ? 'exec-collapsed' : ''} transition-colors duration-500 min-h-screen`}
      style={{
        backgroundColor: isDark ? '#0B0C10' : '#F5F5F7',
        color: isDark ? '#F5F5F7' : '#1D1D1F',
      }}
      dir="rtl"
    >
      {/* ── Contextual Ambient Glow Engine ── */}
      <AmbientCanvas page={page} />

      {/* ── 1. Minimalist iOS Frosted Top Bar (Mobile / Tablet < 1024px) ── */}
      <header
        data-mobile-topbar
        className={`flex lg:!hidden sticky top-0 z-40 h-14 px-4 items-center justify-between w-full shrink-0 select-none shadow-xs transition-colors duration-300 ${
          isDark
            ? 'bg-[#1C1C1E]/85 backdrop-blur-2xl border-b border-white/10 text-[#F5F5F7]'
            : isSolid
            ? 'bg-white border-b border-slate-200 text-[#1D1D1F]'
            : 'bg-white/85 backdrop-blur-2xl border-b border-slate-200/90 text-[#1D1D1F]'
        }`}
      >
        {/* Right side (RTL): squircle logo + title + active page badge */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm border border-slate-200/80">
            <img src="/logo.jpg" alt="لوگوی کوپا گستر" className="w-full h-full object-cover" />
          </span>
          <b className={`text-sm font-bold tracking-tight shrink-0 ${isDark ? 'text-[#F5F5F7]' : 'text-[#1D1D1F]'}`}>
            نبض فروش
          </b>
          <span className="text-[11px] font-semibold text-[#0071E3] bg-[#0071E3]/10 border border-[#0071E3]/20 px-2.5 py-0.5 rounded-full truncate max-w-[130px]">
            {currentPageLabel}
          </span>
        </div>

        {/* Left side (RTL): sleek glass trigger button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className={`border rounded-full p-2 transition-all shrink-0 flex items-center justify-center shadow-xs ${
            isDark
              ? 'bg-white/10 hover:bg-white/15 text-[#F5F5F7] border-white/10'
              : 'bg-black/[0.04] hover:bg-black/[0.08] text-[#1D1D1F] border-black/[0.06]'
          }`}
          aria-label="باز کردن منو"
          title="منوها"
        >
          <Menu size={18} />
        </button>
      </header>

      {/* ── 2. Modular 3-Pillar Floating Sidebar (Desktop RTL: lg:my-3 lg:mr-3 lg:rounded-3xl) ── */}
      <div
        data-sidebar-placeholder
        className={`hidden lg:block shrink-0 transition-all duration-300 ${
          collapsed ? 'w-20 mr-3' : 'w-72 mr-3'
        }`}
      >
        <aside
          data-desktop-sidebar
          className={`exec-sidebar hidden lg:flex flex-col fixed top-3 right-3 h-[calc(100vh-24px)] rounded-3xl select-none transition-all duration-300 z-30 ${
            isDark
              ? 'bg-[#1C1C1E]/85 backdrop-blur-2xl border border-white/10 text-[#F5F5F7] shadow-[0_10px_35px_rgba(0,0,0,0.5)]'
              : isSolid
              ? 'bg-white border border-slate-200 text-[#1D1D1F] shadow-[0_4px_20px_rgba(0,0,0,0.06)]'
              : 'bg-white/85 backdrop-blur-2xl border border-slate-200/80 text-[#1D1D1F] shadow-[0_10px_35px_rgba(15,23,42,0.06)]'
          } ${
            collapsed
              ? 'w-20 min-w-20 max-w-20 overflow-hidden overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
              : 'w-72 min-w-72 max-w-72 overflow-hidden overflow-y-auto'
          }`}
        >
        {/* Brand Header */}
        <div className={`exec-brand flex items-center gap-3 px-2 py-3 border-b mb-2 shrink-0 ${
          isDark ? 'border-white/10' : 'border-slate-200/80'
        }`}>
          <span className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm border border-slate-200/80 overflow-hidden shrink-0">
            <img src="/logo.jpg" alt="لوگوی کوپا گستر" className="w-full h-full object-cover" />
          </span>
          {!collapsed && (
            <div className="exec-brand-copy flex-1 min-w-0">
              <b className={`text-sm font-bold tracking-tight block ${isDark ? 'text-[#F5F5F7]' : 'text-[#1D1D1F]'}`}>
                نبض فروش
              </b>
              <small className="text-[11px] text-[#86868B] dark:text-[#98989D] truncate block">
                {cores[core] ?? ''}
              </small>
            </div>
          )}
          <button
            type="button"
            className={`exec-collapse w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              isDark ? 'text-[#98989D] hover:text-[#F5F5F7] hover:bg-white/10' : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.04]'
            }`}
            aria-label={collapsed ? 'باز کردن منو' : 'جمع کردن منو'}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* 3 Modular Macro-Sections (Pillars) */}
        <nav
          className={`exec-nav flex-1 py-1 ${
            collapsed
              ? 'overflow-hidden overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
              : 'overflow-y-auto'
          }`}
          aria-label="بخش‌های اصلی سامانه"
        >
          {collapsed ? (
            /* Collapsed view: compact icon pills grouped by pillar */
            <div className="space-y-3 py-1">
              {filteredPillars.map((pillar, pi) => (
                <div key={pillar.id} className={pi > 0 ? 'pt-2 border-t border-black/[0.06] dark:border-white/10' : ''}>
                  <div className="space-y-1.5 flex flex-col items-center">
                    {pillar.id === 'sales'
                      ? pillar.subgroups.flatMap((sg) => sg.items).map((item) => renderMenuItem(item, pillar, true))
                      : pillar.items.map((item) => renderMenuItem(item, pillar, true))}
                  </div>
                </div>
              ))}
              {filteredUtility.items.length > 0 && (
                <div className="pt-2 border-t border-black/[0.06] dark:border-white/10">
                  <div className="space-y-1.5 flex flex-col items-center">
                    {filteredUtility.items.map((item) => renderMenuItem(item, filteredUtility, true))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Expanded view: 3 modular accordion macro-sections */
            <div className="space-y-2">
              {filteredPillars.map((pillar) => {
                const isOpen = !!openPillars[pillar.id]
                const PillarIcon = pillar.icon
                const hasActiveItem = pillar.id === 'sales'
                  ? pillar.subgroups.some((sg) => sg.items.some((item) => isItemActive(item, page, arg)))
                  : pillar.items.some((item) => isItemActive(item, page, arg))

                return (
                  <div key={pillar.id} className="mb-2">
                    {/* Pillar Accordion Header */}
                    <button
                      type="button"
                      onClick={() => setOpenPillars((s) => ({ ...s, [pillar.id]: !isOpen }))}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-2xl text-xs font-bold transition-all select-none ${
                        isDark
                          ? 'text-[#F5F5F7] hover:bg-white/[0.06]'
                          : 'text-[#1D1D1F] hover:bg-black/[0.04]'
                      }`}
                      aria-expanded={isOpen}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 shadow-xs"
                          style={{ backgroundColor: `${pillar.accentColor}20`, color: pillar.accentColor }}
                        >
                          <PillarIcon size={14} />
                        </span>
                        <span className="font-extrabold tracking-tight truncate">{pillar.label}</span>
                        {pillar.badge && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0"
                            style={{ backgroundColor: `${pillar.accentColor}18`, color: pillar.accentColor }}
                          >
                            {pillar.badge}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isOpen && hasActiveItem && (
                          <span
                            className="w-2 h-2 rounded-full animate-pulse shadow-xs"
                            style={{ backgroundColor: pillar.accentColor }}
                            aria-label="آیتم فعال در این بخش است"
                          />
                        )}
                        <ChevronDown
                          size={14}
                          className={`transition-transform duration-200 text-[#86868B] dark:text-[#98989D] ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </button>

                    {/* Pillar Accordion Content */}
                    {isOpen && (
                      <div className="mt-1 space-y-1 pr-1">
                        {pillar.id === 'sales' ? (
                          <div className="space-y-1.5 mt-0.5">
                            {pillar.subgroups.map((sg) => {
                              const isSubOpen = !!openSubgroups[sg.id]
                              const SgIcon = sg.icon || BarChart3
                              const hasActive = sg.items.some((item) => isItemActive(item, page, arg))

                              return (
                                <div key={sg.id} className="rounded-2xl transition-all">
                                  {/* Subgroup Accordion Header */}
                                  <button
                                    type="button"
                                    onClick={() => setOpenSubgroups((prev) => ({ ...prev, [sg.id]: !isSubOpen }))}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all select-none ${
                                      isDark
                                        ? 'text-[#F5F5F7] hover:bg-white/[0.06]'
                                        : 'text-[#1D1D1F] hover:bg-black/[0.04]'
                                    }`}
                                    aria-expanded={isSubOpen}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span
                                        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 shadow-xs"
                                        style={{ backgroundColor: `${pillar.accentColor}20`, color: pillar.accentColor }}
                                      >
                                        <SgIcon size={13} />
                                      </span>
                                      <span className="font-extrabold tracking-tight truncate text-[11.5px]">{sg.label}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {!isSubOpen && hasActive && (
                                        <span
                                          className="w-2 h-2 rounded-full animate-pulse shadow-xs"
                                          style={{ backgroundColor: pillar.accentColor }}
                                          aria-label="آیتم فعال در این بخش است"
                                        />
                                      )}
                                      <ChevronDown
                                        size={13}
                                        className={`transition-transform duration-200 text-[#86868B] dark:text-[#98989D] ${
                                          isSubOpen ? 'rotate-180' : ''
                                        }`}
                                      />
                                    </div>
                                  </button>

                                  {/* Subgroup Accordion Content */}
                                  {isSubOpen && (
                                    <div className="mt-1 space-y-0.5 pr-2">
                                      {sg.items.map((item) => renderMenuItem(item, pillar, false))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            {pillar.items.map((item) => renderMenuItem(item, pillar, false))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Utility / System Pillar (Neatly positioned above footer) */}
              {filteredUtility.items.length > 0 && (
                <div className="mt-3 pt-2 border-t border-black/[0.06] dark:border-white/10 mb-2">
                  <button
                    type="button"
                    onClick={() => setOpenPillars((s) => ({ ...s, utility: !openPillars.utility }))}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-2xl text-xs font-bold transition-all select-none ${
                      isDark
                        ? 'text-[#F5F5F7] hover:bg-white/[0.06]'
                        : 'text-[#1D1D1F] hover:bg-black/[0.04]'
                    }`}
                    aria-expanded={openPillars.utility}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 shadow-xs"
                        style={{ backgroundColor: `${filteredUtility.accentColor}20`, color: filteredUtility.accentColor }}
                      >
                        <Sparkles size={14} />
                      </span>
                      <span className="font-extrabold tracking-tight truncate">{filteredUtility.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!openPillars.utility && filteredUtility.items.some((item) => isItemActive(item, page, arg)) && (
                        <span
                          className="w-2 h-2 rounded-full animate-pulse shadow-xs"
                          style={{ backgroundColor: filteredUtility.accentColor }}
                          aria-label="آیتم فعال در این بخش است"
                        />
                      )}
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-200 text-[#86868B] dark:text-[#98989D] ${
                          openPillars.utility ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </button>

                  {openPillars.utility && (
                    <div className="mt-1 space-y-0.5 pr-1">
                      {filteredUtility.items.map((item) => renderMenuItem(item, filteredUtility, false))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* ── Sidebar Footer: User Profile + Appearance Switcher Popover ── */}
        <div className={`exec-sidebar-bottom mt-auto pt-3 border-t shrink-0 ${
          isDark ? 'border-white/10' : 'border-slate-200/80'
        } ${collapsed ? 'px-0 flex flex-col items-center gap-2' : ''}`}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2 mb-2 w-full">
              <AppearanceSwitcher compact={true} />
              <span
                className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF9500] to-[#FFB340] text-white flex items-center justify-center shadow-md shadow-orange-500/25 shrink-0 cursor-pointer"
                aria-hidden="true"
                onClick={() => setPwOpen(true)}
                title="تغییر رمز"
              >
                <UserRound size={18} />
              </span>
              {onLogout && (
                <button
                  type="button"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#86868B] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                  onClick={onLogout}
                  aria-label="خروج از حساب"
                  title="خروج از حساب"
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          ) : (
            <div
              className={`exec-profile relative flex items-center gap-2.5 p-2.5 mx-1 mb-2 rounded-2xl transition-all ${
                isDark
                  ? 'bg-white/5 border border-white/10'
                  : isSolid
                  ? 'bg-slate-50 border border-slate-200'
                  : 'bg-black/[0.03] border border-black/[0.06]'
              }`}
            >
              <span
                className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF9500] to-[#FFB340] text-white flex items-center justify-center shadow-md shadow-orange-500/25 shrink-0 cursor-pointer"
                aria-hidden="true"
                onClick={() => setPwOpen(true)}
                title="تغییر رمز"
              >
                <UserRound size={17} />
              </span>
              <div className="exec-profile-copy min-w-0 flex-1 px-1">
                <button
                  type="button"
                  className={`exec-user-btn text-right font-bold text-xs truncate block w-full hover:text-[#0071E3] ${
                    isDark ? 'text-[#F5F5F7]' : 'text-[#1D1D1F]'
                  }`}
                  onClick={() => setPwOpen(true)}
                  title="تغییر رمز"
                >
                  <b dir="ltr">{user || 'کاربر'}</b>
                </button>
                <small className={`text-[10px] block ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}>حساب کاربری</small>
              </div>
              <AppearanceSwitcher compact={false} />
              {onLogout && (
                <button
                  type="button"
                  className={`exec-logout w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                    isDark ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10' : 'text-[#86868B] hover:text-red-500 hover:bg-red-500/10'
                  }`}
                  onClick={onLogout}
                  aria-label="خروج از حساب"
                  title="خروج از حساب"
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>

      <main className="exec-main min-w-0 flex-1 overflow-x-hidden transition-all duration-300">
        {/* ── Top Smart Dynamic Island Bar ── */}
        <DynamicIslandHeader
          core={core}
          cores={cores}
          setCore={page === 'admin' ? () => {} : setCore}
          lastDataDate={lastDataDate}
          syncState={syncState}
          syncMessage={syncMessage}
          syncProgress={syncProgress}
          onRefresh={onRefresh}
          canSync={canSync}
          page={page}
        />

        <header className="exec-header">
          <div>
            <div className="exec-eyebrow">داشبورد اجرایی · سال مالی ۱۴۰۵</div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
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

        <div className="exec-page w-full max-w-[1600px] mx-auto px-2 sm:px-6 pb-24 lg:pb-6">{children}</div>
      </main>

      {/* ── 2. Floating iOS Glass Bottom Dock (Mobile / Tablet < 1024px) ── */}
      <nav
        data-mobile-dock
        className={`flex lg:!hidden fixed bottom-3 inset-x-3 z-40 h-16 shadow-lg rounded-[26px] px-2 items-center justify-around select-none transition-colors duration-300 ${
          isDark
            ? 'bg-[#1C1C1E]/85 backdrop-blur-2xl border border-white/10 text-[#F5F5F7]'
            : isSolid
            ? 'bg-white border border-slate-200 text-[#1D1D1F]'
            : 'bg-white/90 backdrop-blur-2xl border border-slate-200/90 text-[#1D1D1F]'
        }`}
        aria-label="ناوبری اصلی موبایل"
      >
        {DOCK_TABS.map((tab) => {
          const Icon = tab.icon
          const active = page === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setMobileMenuOpen(false)
                onNavigate(tab.id)
              }}
              style={active ? { backgroundColor: '#0071E3', color: '#FFFFFF' } : {}}
              className={`flex items-center gap-1.5 transition-all duration-200 ${
                active
                  ? 'active !bg-[#0071E3] !text-white rounded-2xl px-3 py-1.5 shadow-[0_4px_14px_rgba(0,113,227,0.35)]'
                  : 'flex-col justify-center text-[#86868B] hover:text-[#1D1D1F] py-1 px-2'
              }`}
            >
              <Icon size={active ? 16 : 18} style={active ? { color: '#FFFFFF' } : {}} className={active ? '!text-white' : undefined} />
              <span
                style={active ? { color: '#FFFFFF' } : {}}
                className={active ? 'text-[10px] font-bold whitespace-nowrap !text-white' : 'text-[10px] font-medium whitespace-nowrap mt-0.5'}
              >
                {tab.label}
              </span>
            </button>
          )
        })}

        {/* 5th Tab: منوها (More button) */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          style={isMoreActive ? { backgroundColor: '#0071E3', color: '#FFFFFF' } : {}}
          className={`flex items-center gap-1.5 transition-all duration-200 ${
            isMoreActive
              ? 'active !bg-[#0071E3] !text-white rounded-2xl px-3 py-1.5 shadow-[0_4px_14px_rgba(0,113,227,0.35)]'
              : 'flex-col justify-center text-[#86868B] hover:text-[#1D1D1F] py-1 px-2'
          }`}
          aria-expanded={mobileMenuOpen}
          aria-label="سایر منوها"
        >
          <LayoutGrid size={isMoreActive ? 16 : 18} style={isMoreActive ? { color: '#FFFFFF' } : {}} className={isMoreActive ? '!text-white' : undefined} />
          <span
            style={isMoreActive ? { color: '#FFFFFF' } : {}}
            className={isMoreActive ? 'text-[10px] font-bold whitespace-nowrap !text-white' : 'text-[10px] font-medium whitespace-nowrap mt-0.5'}
          >
            منوها
          </span>
        </button>
      </nav>

      {/* ── 3. iOS Grouped Menu Sheet (Mobile / Tablet < 1024px) ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="mobileMenuBackdrop"
              data-mobile-backdrop
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 lg:!hidden"
              aria-hidden="true"
            />

            {/* Bottom Sheet */}
            <motion.div
              key="mobileMenuSheet"
              data-mobile-sheet
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className={`fixed bottom-0 inset-x-0 z-50 rounded-t-[32px] max-h-[85vh] overflow-y-auto p-5 pb-8 lg:!hidden flex flex-col gap-4 text-right shadow-[0_-10px_40px_rgb(0,0,0,0.25)] transition-colors duration-300 ${
                isDark
                  ? 'bg-[#1C1C1E]/95 backdrop-blur-3xl border-t border-white/10 text-[#F5F5F7]'
                  : isSolid
                  ? 'bg-white border-t border-slate-200 text-[#1D1D1F]'
                  : 'bg-[#F5F5F7]/95 backdrop-blur-3xl border-t border-slate-200/90 text-[#1D1D1F]'
              }`}
              role="dialog"
              aria-modal="true"
              aria-label="منوی بخش‌ها"
            >
              {/* Drag Handle Pill */}
              <div className="w-10 h-1.5 bg-black/20 dark:bg-white/20 rounded-full mx-auto mb-1 shrink-0" />

              {/* Sheet Header */}
              <div className={`flex items-center justify-between pb-2 border-b shrink-0 ${
                isDark ? 'border-white/10' : 'border-slate-200/80'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0071E3]" />
                  <h3 className={`text-sm font-bold ${isDark ? 'text-[#F5F5F7]' : 'text-[#1D1D1F]'}`}>
                    منوی بخش‌های سامانه
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    isDark
                      ? 'bg-white/10 hover:bg-white/15 text-[#98989D] hover:text-[#F5F5F7]'
                      : 'bg-black/[0.05] hover:bg-black/[0.1] text-[#86868B] hover:text-[#1D1D1F]'
                  }`}
                  aria-label="بستن"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modular 3-Pillars for Mobile Sheet */}
              <div className="space-y-4 flex-1">
                {filteredPillars.map((pillar) => {
                  const PillarIcon = pillar.icon
                  const items = pillar.id === 'sales'
                    ? pillar.subgroups.flatMap((sg) => sg.items)
                    : pillar.items

                  return (
                    <div key={pillar.id} className="space-y-1.5">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-5 h-5 rounded-md flex items-center justify-center"
                            style={{ backgroundColor: `${pillar.accentColor}20`, color: pillar.accentColor }}
                          >
                            <PillarIcon size={12} />
                          </span>
                          <span className="text-[11px] font-bold tracking-wider block">
                            {pillar.label}
                          </span>
                        </div>
                        {pillar.badge && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                            style={{ backgroundColor: `${pillar.accentColor}18`, color: pillar.accentColor }}
                          >
                            {pillar.badge}
                          </span>
                        )}
                      </div>
                      <div className={`rounded-2xl p-1.5 grid grid-cols-2 gap-1.5 shadow-xs ${
                        isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200/80'
                      }`}>
                        {items.map((item) => {
                          const active = isItemActive(item, page, arg)
                          const Icon = item.icon
                          const activeStyle = {
                            backgroundColor: pillar.accentColor,
                            color: '#FFFFFF',
                          }
                          return (
                            <button
                              key={`${item.id}-${item.arg || ''}`}
                              type="button"
                              onClick={() => {
                                if (item.arg) {
                                  onNavigate(item.id, item.arg === 'dashboard' ? '' : item.arg)
                                } else {
                                  onNavigate(item.id)
                                }
                                setMobileMenuOpen(false)
                              }}
                              style={active ? activeStyle : undefined}
                              className={`flex items-center gap-2 p-2 rounded-xl text-xs transition-all text-right select-none ${
                                active
                                  ? `active ${pillar.activeClass} !text-white font-bold shadow-md`
                                  : isDark
                                  ? 'text-[#E5E5EA] font-semibold hover:bg-white/10'
                                  : 'text-[#1D1D1F] font-semibold hover:bg-black/[0.04]'
                              }`}
                            >
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                  active
                                    ? 'bg-white/20 !text-white'
                                    : isDark
                                    ? 'bg-white/5 text-[#98989D]'
                                    : 'bg-black/[0.04] text-[#86868B]'
                                }`}
                                style={active ? { color: '#FFFFFF' } : {}}
                              >
                                <Icon size={14} style={active ? { color: '#FFFFFF' } : {}} className={active ? '!text-white' : undefined} />
                              </div>
                              <span
                                className={`truncate flex-1 font-medium ${active ? '!text-white font-bold' : ''}`}
                                style={active ? { color: '#FFFFFF' } : {}}
                              >
                                {item.label}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {/* Utility Pillar for Mobile Sheet */}
                {filteredUtility.items.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-[#86868B] dark:text-[#98989D] px-2 tracking-wider block">
                      {filteredUtility.label}
                    </span>
                    <div className={`rounded-2xl p-1.5 grid grid-cols-2 gap-1.5 shadow-xs ${
                      isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-slate-200/80'
                    }`}>
                      {filteredUtility.items.map((item) => {
                        const active = isItemActive(item, page, arg)
                        const Icon = item.icon
                        const activeStyle = {
                          backgroundColor: filteredUtility.accentColor,
                          color: '#FFFFFF',
                        }
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              onNavigate(item.id)
                              setMobileMenuOpen(false)
                            }}
                            style={active ? activeStyle : undefined}
                            className={`flex items-center gap-2 p-2 rounded-xl text-xs transition-all text-right select-none ${
                              active
                                ? `active ${filteredUtility.activeClass} !text-white font-bold shadow-md`
                                : isDark
                                ? 'text-[#E5E5EA] font-semibold hover:bg-white/10'
                                : 'text-[#1D1D1F] font-semibold hover:bg-black/[0.04]'
                            }`}
                          >
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                active
                                  ? 'bg-white/20 !text-white'
                                  : isDark
                                  ? 'bg-white/5 text-[#98989D]'
                                  : 'bg-black/[0.04] text-[#86868B]'
                              }`}
                              style={active ? { color: '#FFFFFF' } : {}}
                            >
                              <Icon size={14} style={active ? { color: '#FFFFFF' } : {}} className={active ? '!text-white' : undefined} />
                            </div>
                            <span
                              className={`truncate flex-1 font-medium ${active ? '!text-white font-bold' : ''}`}
                              style={active ? { color: '#FFFFFF' } : {}}
                            >
                              {item.label}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile & Appearance Settings at Bottom */}
              <div className={`relative mt-2 pt-3 border-t flex items-center justify-between p-3 rounded-2xl shrink-0 ${
                isDark ? 'border-white/10 bg-white/5' : 'border-slate-200/80 bg-black/[0.02]'
              }`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF9500] to-[#FFB340] text-white flex items-center justify-center shadow-md shadow-orange-500/25 shrink-0">
                    <UserRound size={16} />
                  </span>
                  <div className="min-w-0">
                    <button
                      type="button"
                      className={`text-right font-bold text-xs truncate block hover:text-[#0071E3] ${
                        isDark ? 'text-[#F5F5F7]' : 'text-[#1D1D1F]'
                      }`}
                      onClick={() => {
                        setPwOpen(true)
                        setMobileMenuOpen(false)
                      }}
                      title="تغییر رمز"
                    >
                      <span dir="ltr">{user || 'کاربر'}</span>
                    </button>
                    <small className="text-[10px] text-[#86868B] dark:text-[#98989D] block">حساب کاربری</small>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <AppearanceSwitcher compact={false} />
                  {onLogout && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false)
                        onLogout()
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 px-3 py-1.5 rounded-xl transition-colors shrink-0"
                      aria-label="خروج از حساب"
                    >
                      <LogOut size={14} />
                      <span>خروج</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {pwOpen && <PasswordDialog onClose={() => setPwOpen(false)} />}
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
  const { isDark } = useAppearance()
  const data = rows.map((r) => ({ ...r, value: r.sum_rial_vat / 1e9, net: r.net_rial / 1e9 }))
  const tipConfig = isDark ? TIP_DARK : TIP
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#e5eaf3'
  const cursorFill = isDark ? 'rgba(255, 255, 255, 0.04)' : '#f1f5ff'
  return (
    <div className="exec-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 4, left: 4, bottom: 0 }} barGap={6}>
          <defs>
            <linearGradient id="execNetBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b82f6" /><stop offset="1" stopColor="#1d4ed8" /></linearGradient>
            <linearGradient id="execGrossBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5eead4" /><stop offset="1" stopColor="#14b8a6" /></linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="4 4" />
          <XAxis dataKey="year_month" reversed tickFormatter={monthName} axisLine={false} tickLine={false} tick={{ fill: isDark ? '#98989D' : '#64748B' }} />
          <YAxis orientation="right" axisLine={false} tickLine={false} tickFormatter={(v) => fa(v)} width={50} tick={{ fill: isDark ? '#98989D' : '#64748B' }} />
          <Tooltip {...tipConfig} formatter={(v, n) => [`${fa(v)} میلیارد ریال`, n]} labelFormatter={monthLabel} cursor={{ fill: cursorFill, radius: 10 }} />
          <Bar dataKey="net" name="ریال خالص" fill="url(#execNetBar)" radius={[8, 8, 3, 3]} maxBarSize={26} />
          <Bar dataKey="value" name="فروش ناخالص" fill="url(#execGrossBar)" radius={[8, 8, 3, 3]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function DailyChart({ rows }) {
  const { isDark } = useAppearance()
  const data = rows.map((r) => ({ ...r, value: r.sum_rial_vat / 1e9 }))
  const tipConfig = isDark ? TIP_DARK : TIP
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#e5eaf3'
  return (
    <div className="exec-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="execFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={isDark ? '.4' : '.28'} />
              <stop offset="1" stopColor="#2563eb" stopOpacity=".02" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={gridColor} strokeDasharray="4 4" />
          <XAxis dataKey="date" reversed tickFormatter={dayLabel} axisLine={false} tickLine={false} minTickGap={32} tick={{ fill: isDark ? '#98989D' : '#64748B' }} />
          <YAxis orientation="right" axisLine={false} tickLine={false} tickFormatter={(v) => fa(v)} width={50} tick={{ fill: isDark ? '#98989D' : '#64748B' }} />
          <Tooltip {...tipConfig} formatter={(v) => [`${fa(v)} میلیارد ریال`, 'فروش']} labelFormatter={dayLabel} />
          <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="url(#execFill)" strokeWidth={2.5} strokeLinejoin="round" activeDot={{ r: 5, fill: isDark ? '#1C1C1E' : '#fff', stroke: '#3b82f6', strokeWidth: 2.5 }} />
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
  const { isDark, isSolid } = useAppearance()
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

  const surfaceClass = isDark
    ? 'bg-[#1C1C1E]/85 backdrop-blur-2xl border border-white/10 text-[#F5F5F7] shadow-[0_8px_30px_rgba(0,0,0,0.5)]'
    : isSolid
    ? 'bg-white border border-slate-200 text-[#1D1D1F] shadow-sm'
    : 'bg-white/85 backdrop-blur-2xl border border-slate-200/80 text-[#1D1D1F] shadow-[0_8px_30px_rgb(0,0,0,0.04)]'

  return (
    <div className={`rounded-[28px] ${surfaceClass} p-6 h-full flex flex-col transition-colors`}>
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
  const { isDark, isSolid } = useAppearance()
  const { month: _m, start: _s, end: _e, ...dims } = p
  const ov = useApi('/overview', p)
  const invoiceLines = useApi('/invoice-lines', p)
  const growth = useApi('/growth', { ...dims, kind: 'month' })
  const monthly = useApi('/monthly', { ...dims })
  const trend = useApi('/trend', p)
  const pace = useApi('/pace', dims)
  const target = useApi('/target', { core: p.core, ...(month ? { month } : {}) })
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

  // Executive KPI calculations (reconciled with DuckDB)
  const returnsRial = o ? Math.abs(o.returns_rial ?? 0) : 0
  const aov = (o && o.invoice_count) ? Math.round(o.net_rial / o.invoice_count) : null
  const targetAchieved = target.data?.summary?.achieved_pct ?? null
  const targetTotal = target.data?.summary?.target_rial ?? null

  const surfaceClass = isDark
    ? 'bg-[#1C1C1E]/85 backdrop-blur-2xl border border-white/10 text-[#F5F5F7] shadow-[0_8px_30px_rgba(0,0,0,0.5)]'
    : isSolid
    ? 'bg-white border border-slate-200 text-[#1D1D1F] shadow-sm'
    : 'bg-white/85 backdrop-blur-2xl border border-slate-200/80 text-[#1D1D1F] shadow-[0_8px_30px_rgb(0,0,0,0.04)]'

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-3 sm:space-y-5 px-1 sm:px-0">

      {/* ── Calendar status bar ──────────────────────────────── */}
      <CalendarGlass cal={cal} />

      {/* ── Hero Bento Row (Equal Height 8 Cols + 4 Cols) ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch w-full">
        <HeroMetricCard rows={rows} o={o} growth={netGrowth} growthLabel={growthLabel} period={month ? monthLabel(month) : 'همه ماه‌ها'} />
        <ForecastRings pace={pace} />
      </div>

      {/* ── 6×2 KPI widget grid (Executive, non-duplicate, no digit truncation) ─────────────────────────────── */}
      <KpiSpotlight items={[
        { icon: Undo2, label: 'مبلغ مرجوعی', value: o ? billions1(returnsRial) : '—', unit: 'میلیارد ریال · مرجوعی کل', tooltip: o ? `${fa(returnsRial)} ریال مرجوعی فروش` : undefined, tone: 'red', onClick: onOpenReturns },
        { icon: PackageSearch, label: 'تعداد کالا', value: o ? fa(o.sum_qty) : '—', unit: 'عدد', tone: 'violet' },
        { icon: PackageSearch, label: 'تعداد کالا خالص', value: o ? fa(o.sum_qty_net) : '—', unit: 'عدد · منهای مرجوعی', tone: 'violet' },
        { icon: FileText, label: 'تعداد فاکتور', value: o ? fa(o.invoice_count) : '—', unit: 'فقره', tone: 'amber' },
        { icon: TrendingUp, label: 'درصد رشد فاکتور', value: pct(invoiceGrowth), unit: growthLabel ? `${growthLabel} نسبت به ماه قبل` : 'مقایسه با ماه قبل', tone: 'teal' },
        { icon: ListOrdered, label: 'میانگین سطر فاکتور', value: invoiceLines.data ? fa2(invoiceLines.data.avg_lines_per_invoice) : '—', unit: 'سطر در هر فاکتور', tone: 'sky' },
        { icon: Users, label: 'مشتری فعال', value: o ? fa(o.active_customers) : '—', unit: 'مشتری یکتا', tone: 'pink' },
        { icon: Receipt, label: 'میانگین هر فاکتور (AOV)', value: aov ? fa(aov) : '—', unit: 'ریال · ارزش سفارش', tooltip: aov ? `${fa(aov)} ریال میانگین ارزش هر فاکتور` : undefined, tone: 'teal' },
        { icon: Target, label: 'درصد تحقق تارگت', value: targetAchieved != null ? pct(targetAchieved) : (target.loading ? '…' : '—'), unit: targetTotal ? `از تارگت ${billions1(targetTotal)} م.ر` : 'از هدف فروش دوره', tooltip: target.data?.summary ? `تحقق: ${fa(target.data.summary.actual_rial)} از هدف ${fa(target.data.summary.target_rial)} ریال` : undefined, tone: targetAchieved >= 1 ? 'teal' : targetAchieved >= 0.9 ? 'amber' : 'red' },
        { icon: Undo2, label: 'حواله‌های برگشتی', value: retTotal ? fa(retTotal.returned_orders) : '—', unit: retNote ?? `${pct(retTotal.returned_order_percent)} از ${fa(retTotal.orders)} حواله`, tone: 'amber', onClick: onOpenReturns },
        { icon: PackageX, label: 'درصد برگشتی حواله', value: retTotal ? pct(retTotal.return_percent) : '—', unit: retNote ?? (retTotal?.return_rial ? `${billions1(retTotal.return_rial)} م.ر برگشتی` : '—'), tooltip: retTotal?.return_rial ? `${fa(retTotal.return_rial)} ریال برگشتی` : undefined, tone: 'red', onClick: onOpenReturns },
        { icon: PackageX, label: 'تعداد فاکتور تحویلی', value: retTotal ? fa(retTotal.invoiced_orders) : '—', unit: retNote ?? `${pct(retTotal.invoiced_order_percent)} درصد تحویل`, tone: 'blue', onClick: onOpenReturns },
      ]} />

      {/* ── Bottom content grid ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">

        {/* Monthly sales chart */}
        <div className={`lg:col-span-8 rounded-[24px] sm:rounded-[28px] ${surfaceClass} p-4 sm:p-6 overflow-hidden w-full max-w-full flex flex-col transition-colors`}>
          <CardHead title="روند فروش ماهانه" note="ریال خالص و فروش ناخالص · میلیارد ریال"
            chip={<span className={`exec-legend-inline ${isDark ? 'text-slate-300' : ''}`}><i style={{ background: '#2563eb' }} />خالص<i style={{ background: '#14b8a6' }} />ناخالص</span>} />
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
        <div className={`lg:col-span-5 rounded-[24px] sm:rounded-[28px] ${surfaceClass} p-4 sm:p-6 overflow-hidden w-full max-w-full flex flex-col exec-daily transition-colors`}>
          <CardHead title="روند فروش روزانه" note={month ? `روزهای ${monthLabel(month)} · میلیارد ریال` : 'روزهای دورهٔ انتخاب‌شده · میلیارد ریال'}
            chip={<span className="exec-chip blue">Rial+Vat</span>} />
          <DailyChart rows={days} />
        </div>

        {/* Monthly summary table */}
        <div className={`lg:col-span-12 rounded-[24px] sm:rounded-[28px] ${surfaceClass} p-4 sm:p-6 overflow-hidden w-full max-w-full transition-colors`}>
          <CardHead title="خلاصهٔ ماهانه" note="برای تمرکز روی یک ماه، ردیف آن را انتخاب کنید"
            chip={<span className="exec-chip blue">مدل Power Pivot</span>} />
          <div className="w-full overflow-x-auto -mx-2 px-2">
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
    </div>
  )
}

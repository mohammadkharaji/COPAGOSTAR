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
import SalesOverview, { OverviewHeader } from './overview/SalesOverview'
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
const PRODUCT_GROUP_KEYS = []
const TEHRAN_EXCLUDED_GEO = new Set([
  'استان مرکزی',
  'استان البرز',
  'شهرستان اصفهان',
  'شهرستان بویر احمد',
  'شهرستان خفر',
  'شهرستان نظرآباد',
  'شهرستان ساوه',
  'کرج',
  'یاسوج',
  'نظر آباد',
])

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
    accentColor: '#10B981',
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
    accentColor: '#F59E0B',
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
    accentColor: '#14B8A6',
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
  accentColor: '#06B6D4',
  activeClass: 'active-utility',
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

  // Color & active token themes per pillar
  const PILLAR_THEMES = {
    sales: {
      activeClassDark: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 font-bold shadow-[0_0_15px_rgba(16,185,129,0.12)]',
      activeClassLight: 'bg-emerald-50/90 border-emerald-300/80 text-emerald-950 font-bold shadow-xs',
      indicator: 'bg-emerald-400 shadow-[0_0_8px_#10B981]',
      iconActiveDark: 'bg-emerald-500/25 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]',
      iconActiveLight: 'bg-emerald-100 text-emerald-800',
    },
    club_b2b: {
      activeClassDark: 'bg-amber-500/15 border-amber-500/30 text-amber-300 font-bold shadow-[0_0_15px_rgba(245,158,11,0.12)]',
      activeClassLight: 'bg-amber-50/90 border-amber-300/80 text-amber-950 font-bold shadow-xs',
      indicator: 'bg-amber-400 shadow-[0_0_8px_#F59E0B]',
      iconActiveDark: 'bg-amber-500/25 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.3)]',
      iconActiveLight: 'bg-amber-100 text-amber-800',
    },
    club_visitor: {
      activeClassDark: 'bg-teal-500/15 border-teal-500/30 text-teal-300 font-bold shadow-[0_0_15px_rgba(20,184,166,0.12)]',
      activeClassLight: 'bg-teal-50/90 border-teal-300/80 text-teal-950 font-bold shadow-xs',
      indicator: 'bg-teal-400 shadow-[0_0_8px_#14B8A6]',
      iconActiveDark: 'bg-teal-500/25 text-teal-300 shadow-[0_0_8px_rgba(20,184,166,0.3)]',
      iconActiveLight: 'bg-teal-100 text-teal-800',
    },
    utility: {
      activeClassDark: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300 font-bold shadow-[0_0_15px_rgba(6,182,212,0.12)]',
      activeClassLight: 'bg-cyan-50/90 border-cyan-300/80 text-cyan-950 font-bold shadow-xs',
      indicator: 'bg-cyan-400 shadow-[0_0_8px_#06B6D4]',
      iconActiveDark: 'bg-cyan-500/25 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.3)]',
      iconActiveLight: 'bg-cyan-100 text-cyan-800',
    },
  }

  // Render individual navigation menu item with sleek modern active state
  const renderMenuItem = (item, pillar, isCollapsed) => {
    const active = isItemActive(item, page, arg)
    const Icon = item.icon
    const theme = PILLAR_THEMES[pillar.id] || PILLAR_THEMES.sales

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
          className={`relative w-10 h-10 mx-auto rounded-xl flex items-center justify-center transition-all select-none border outline-none focus:outline-none ${
            active
              ? (isDark ? theme.activeClassDark : theme.activeClassLight)
              : (isDark
                  ? 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-white/[0.05]'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100')
          }`}
          onClick={handleClick}
          title={item.label}
          aria-label={item.label}
          aria-current={active ? 'page' : undefined}
        >
          {active && (
            <span className={`absolute right-0 top-2 bottom-2 w-1 rounded-l-full ${theme.indicator}`} />
          )}
          <Icon size={17} />
        </button>
      )
    }

    return (
      <button
        type="button"
        key={`${item.id}-${item.arg || ''}`}
        className={`group relative flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-xl text-xs transition-all text-right select-none border outline-none focus:outline-none ${
          active
            ? (isDark ? theme.activeClassDark : theme.activeClassLight)
            : (isDark
                ? 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] font-medium'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium')
        }`}
        onClick={handleClick}
        title={item.label}
        aria-current={active ? 'page' : undefined}
      >
        {active && (
          <span className={`absolute right-0 top-1.5 bottom-1.5 w-1 rounded-l-full ${theme.indicator}`} />
        )}
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
            active
              ? (isDark ? theme.iconActiveDark : theme.iconActiveLight)
              : (isDark
                  ? 'bg-white/[0.03] text-slate-400 group-hover:bg-white/[0.06] group-hover:text-slate-200'
                  : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200/80 group-hover:text-slate-800')
          }`}
          aria-hidden="true"
        >
          <Icon size={14} />
        </div>
        <span className="truncate flex-1 text-[12px] font-sans">
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
              ? 'bg-[#0A0E0C]/95 backdrop-blur-2xl border border-white/[0.07] text-slate-100 shadow-[0_12px_45px_rgba(0,0,0,0.65)]'
              : isSolid
              ? 'bg-white border border-slate-200 text-slate-900 shadow-[0_4px_20px_rgba(0,0,0,0.06)]'
              : 'bg-white/95 backdrop-blur-2xl border border-slate-200/90 text-slate-900 shadow-[0_10px_35px_rgba(15,23,42,0.06)]'
          } ${
            collapsed
              ? 'w-20 min-w-20 max-w-20 overflow-hidden overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
              : 'w-72 min-w-72 max-w-72 overflow-hidden overflow-y-auto px-2'
          }`}
        >
        {/* Brand Header */}
        <div className={`exec-brand flex items-center gap-2.5 px-3 py-3 border-b mb-2 shrink-0 ${
          isDark ? 'border-white/[0.07]' : 'border-slate-200/80'
        }`}>
          <div className="relative">
            <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-xs border border-slate-200/80 overflow-hidden shrink-0">
              <img src="/logo.jpg" alt="لوگوی کوپا گستر" className="w-full h-full object-cover" />
            </span>
            <span className="absolute -bottom-0.5 -left-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0A0E0C] dark:border-[#0A0E0C] light:border-white shadow-xs" />
          </div>
          {!collapsed && (
            <div className="exec-brand-copy flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <b className={`text-sm font-black tracking-tight block ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  نبض فروش
                </b>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981] animate-pulse" />
              </div>
              <small className={`text-[10.5px] truncate block font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {cores[core] || 'کوپا گستر · سال ۱۴۰۵'}
              </small>
            </div>
          )}
          <button
            type="button"
            className={`exec-collapse w-7 h-7 rounded-lg flex items-center justify-center transition-colors outline-none focus:outline-none ${
              isDark ? 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.06]' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            aria-label={collapsed ? 'باز کردن منو' : 'جمع کردن منو'}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
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
                <div key={pillar.id} className={pi > 0 ? 'pt-2 border-t border-white/[0.06] dark:border-white/[0.06] light:border-slate-200/80' : ''}>
                  <div className="space-y-1.5 flex flex-col items-center">
                    {pillar.id === 'sales'
                      ? pillar.subgroups.flatMap((sg) => sg.items).map((item) => renderMenuItem(item, pillar, true))
                      : pillar.items.map((item) => renderMenuItem(item, pillar, true))}
                  </div>
                </div>
              ))}
              {filteredUtility.items.length > 0 && (
                <div className="pt-2 border-t border-white/[0.06] dark:border-white/[0.06] light:border-slate-200/80">
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
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-all select-none outline-none focus:outline-none ${
                        isDark
                          ? 'text-slate-200 hover:bg-white/[0.04]'
                          : 'text-slate-800 hover:bg-slate-100/70'
                      }`}
                      aria-expanded={isOpen}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 shadow-xs"
                          style={{ backgroundColor: `${pillar.accentColor}18`, color: pillar.accentColor }}
                        >
                          <PillarIcon size={13} />
                        </span>
                        <span className="font-extrabold tracking-tight truncate text-[12px]">{pillar.label}</span>
                        {pillar.badge && (
                          <span
                            className="text-[9.5px] px-2 py-0.5 rounded-full font-bold shrink-0 border"
                            style={{
                              backgroundColor: `${pillar.accentColor}14`,
                              color: pillar.accentColor,
                              borderColor: `${pillar.accentColor}25`,
                            }}
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
                          size={13}
                          className={`transition-transform duration-200 text-slate-400 ${
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
                                <div key={sg.id} className="rounded-xl transition-all">
                                  {/* Subgroup Accordion Header */}
                                  <button
                                    type="button"
                                    onClick={() => setOpenSubgroups((prev) => ({ ...prev, [sg.id]: !isSubOpen }))}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all select-none outline-none focus:outline-none ${
                                      isDark
                                        ? 'text-slate-300 hover:bg-white/[0.03]'
                                        : 'text-slate-700 hover:bg-slate-100/60'
                                    }`}
                                    aria-expanded={isSubOpen}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span
                                        className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: `${pillar.accentColor}14`, color: pillar.accentColor }}
                                      >
                                        <SgIcon size={12} />
                                      </span>
                                      <span className="font-bold tracking-tight truncate text-[11px]">
                                        {sg.label}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {!isSubOpen && hasActive && (
                                        <span
                                          className="w-1.5 h-1.5 rounded-full animate-pulse shadow-xs"
                                          style={{ backgroundColor: pillar.accentColor }}
                                        />
                                      )}
                                      <ChevronDown
                                        size={12}
                                        className={`transition-transform duration-200 text-slate-400 ${
                                          isSubOpen ? 'rotate-180' : ''
                                        }`}
                                      />
                                    </div>
                                  </button>

                                  {/* Subgroup Accordion Content with vertical tree connector */}
                                  {isSubOpen && (
                                    <div className="mr-3.5 pr-2 border-r border-white/[0.06] dark:border-white/[0.06] light:border-slate-200/90 space-y-0.5 mt-0.5">
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
                <div className="mt-3 pt-2 border-t border-white/[0.06] dark:border-white/[0.06] light:border-slate-200/80 mb-2">
                  <button
                    type="button"
                    onClick={() => setOpenPillars((s) => ({ ...s, utility: !openPillars.utility }))}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition-all select-none outline-none focus:outline-none ${
                      isDark
                        ? 'text-slate-200 hover:bg-white/[0.04]'
                        : 'text-slate-800 hover:bg-slate-100/70'
                    }`}
                    aria-expanded={openPillars.utility}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 shadow-xs"
                        style={{ backgroundColor: `${filteredUtility.accentColor}18`, color: filteredUtility.accentColor }}
                      >
                        <Sparkles size={13} />
                      </span>
                      <span className="font-extrabold tracking-tight truncate text-[12px]">{filteredUtility.label}</span>
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
                        size={13}
                        className={`transition-transform duration-200 text-slate-400 ${
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
        <div className={`exec-sidebar-bottom mt-auto pt-2.5 border-t shrink-0 ${
          isDark ? 'border-white/[0.07]' : 'border-slate-200/80'
        } ${collapsed ? 'px-0 flex flex-col items-center gap-2' : ''}`}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2 mb-2 w-full">
              <AppearanceSwitcher compact={true} />
              <span
                className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xs shrink-0 cursor-pointer"
                aria-hidden="true"
                onClick={() => setPwOpen(true)}
                title="تغییر رمز"
              >
                <UserRound size={16} />
              </span>
              {onLogout && (
                <button
                  type="button"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors outline-none"
                  onClick={onLogout}
                  aria-label="خروج از حساب"
                  title="خروج از حساب"
                >
                  <LogOut size={15} />
                </button>
              )}
            </div>
          ) : (
            <div
              className={`exec-profile relative flex items-center gap-2 p-2 mb-2 rounded-2xl transition-all border ${
                isDark
                  ? 'bg-white/[0.03] border-white/[0.06]'
                  : 'bg-slate-50 border-slate-200/90'
              }`}
            >
              <span
                className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-xs shrink-0 cursor-pointer"
                aria-hidden="true"
                onClick={() => setPwOpen(true)}
                title="تغییر رمز"
              >
                <UserRound size={15} />
              </span>
              <div className="exec-profile-copy min-w-0 flex-1 px-1">
                <button
                  type="button"
                  className={`exec-user-btn text-right font-bold text-xs truncate block w-full outline-none focus:outline-none hover:text-emerald-400 ${
                    isDark ? 'text-slate-200' : 'text-slate-800'
                  }`}
                  onClick={() => setPwOpen(true)}
                  title="تغییر رمز"
                >
                  <b dir="ltr">{user || 'کاربر'}</b>
                </button>
                <small className={`text-[10px] block font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {isAdmin ? 'مدیر سیستم' : 'حساب کاربری'}
                </small>
              </div>
              <AppearanceSwitcher compact={false} />
              {onLogout && (
                <button
                  type="button"
                  className={`exec-logout w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 outline-none ${
                    isDark ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10' : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                  }`}
                  onClick={onLogout}
                  aria-label="خروج از حساب"
                  title="خروج از حساب"
                >
                  <LogOut size={15} />
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

        {/* Unified Apple-style header with filters for all pages */}
        {page !== 'overview' && (
          <div className="w-full max-w-[1600px] mx-auto px-2 sm:px-6">
            <OverviewHeader
              title={title}
              subtitle={subtitle}
              branch={dims.branch}
              branches={filters.branch ?? []}
              onBranchChange={(b) => onFilterChange?.('branch', b)}
              month={month}
              setMonth={setMonth}
              months={filters.month ?? []}
              dims={dims}
              filters={filters}
              onFilterChange={onFilterChange}
              onReset={onReset}
              showFilters={showFilters}
              hideMonth={hideMonth}
            />
          </div>
        )}

        {error && <div className="exec-alert err" role="alert">{error}</div>}
        {partial && !error && <div className="exec-alert warn">بخشی از ماه‌ها هنوز بارگذاری نشده است.</div>}
        {syncNotice && (
          <div className={`exec-alert ${syncNotice.includes('ناموفق') ? 'err' : 'ok'}`} role="status" aria-live="polite">
            <span><Sparkles size={16} />{syncNotice}</span>
            <button type="button" onClick={onDismissNotice} aria-label="بستن"><X size={16} /></button>
          </div>
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
              style={active ? { backgroundColor: '#10B981', color: '#FFFFFF' } : {}}
              className={`flex items-center gap-1.5 transition-all duration-200 outline-none ${
                active
                  ? 'active !bg-[#10B981] !text-white rounded-2xl px-3 py-1.5 shadow-[0_4px_14px_rgba(16,185,129,0.35)]'
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
          style={isMoreActive ? { backgroundColor: '#10B981', color: '#FFFFFF' } : {}}
          className={`flex items-center gap-1.5 transition-all duration-200 outline-none ${
            isMoreActive
              ? 'active !bg-[#10B981] !text-white rounded-2xl px-3 py-1.5 shadow-[0_4px_14px_rgba(16,185,129,0.35)]'
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
                      <div className={`rounded-2xl p-1.5 grid grid-cols-2 gap-1.5 shadow-xs border ${
                        isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200/80'
                      }`}>
                        {items.map((item) => {
                          const active = isItemActive(item, page, arg)
                          const Icon = item.icon
                          const theme = PILLAR_THEMES[pillar.id] || PILLAR_THEMES.sales

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
                              className={`flex items-center gap-2 p-2 rounded-xl text-xs transition-all text-right select-none border outline-none focus:outline-none ${
                                active
                                  ? (isDark ? theme.activeClassDark : theme.activeClassLight)
                                  : (isDark
                                      ? 'border-transparent text-slate-300 hover:bg-white/10'
                                      : 'border-transparent text-slate-700 hover:bg-slate-100')
                              }`}
                            >
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                  active
                                    ? (isDark ? theme.iconActiveDark : theme.iconActiveLight)
                                    : (isDark
                                        ? 'bg-white/5 text-slate-400'
                                        : 'bg-black/[0.04] text-slate-500')
                                }`}
                              >
                                <Icon size={14} />
                              </div>
                              <span className="truncate flex-1 font-medium text-[11.5px]">
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
                    <span className="text-[11px] font-bold text-slate-400 px-2 tracking-wider block">
                      {filteredUtility.label}
                    </span>
                    <div className={`rounded-2xl p-1.5 grid grid-cols-2 gap-1.5 shadow-xs border ${
                      isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-slate-200/80'
                    }`}>
                      {filteredUtility.items.map((item) => {
                        const active = isItemActive(item, page, arg)
                        const Icon = item.icon
                        const theme = PILLAR_THEMES.utility

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              onNavigate(item.id)
                              setMobileMenuOpen(false)
                            }}
                            className={`flex items-center gap-2 p-2 rounded-xl text-xs transition-all text-right select-none border outline-none focus:outline-none ${
                              active
                                ? (isDark ? theme.activeClassDark : theme.activeClassLight)
                                : (isDark
                                    ? 'border-transparent text-slate-300 hover:bg-white/10'
                                    : 'border-transparent text-slate-700 hover:bg-slate-100')
                            }`}
                          >
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                active
                                  ? (isDark ? theme.iconActiveDark : theme.iconActiveLight)
                                  : (isDark
                                      ? 'bg-white/5 text-slate-400'
                                      : 'bg-black/[0.04] text-slate-500')
                              }`}
                            >
                              <Icon size={14} />
                            </div>
                            <span className="truncate flex-1 font-medium text-[11.5px]">
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

export default function ExecutiveDashboard({
  p,
  cal,
  month,
  setMonth,
  dims = {},
  onFilterChange,
  filters = {},
  onReset,
  onOpenReturns,
  onOpenTickets,
  onNavigate,
}) {
  return (
    <SalesOverview
      p={p}
      cal={cal}
      month={month}
      setMonth={setMonth}
      dims={dims}
      onFilterChange={onFilterChange}
      filters={filters}
      onReset={onReset}
      onOpenReturns={onOpenReturns}
      onOpenTickets={onOpenTickets}
      onNavigate={onNavigate}
    />
  )
}

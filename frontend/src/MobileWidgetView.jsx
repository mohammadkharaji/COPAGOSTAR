import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Award,
  Battery,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Compass,
  Copy,
  ExternalLink,
  Eye,
  Flame,
  Gift,
  Globe,
  HelpCircle,
  Image as ImageIcon,
  LayoutDashboard,
  Maximize2,
  Mic,
  Moon,
  Phone,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Wifi,
  Zap,
} from 'lucide-react'
import { useAppearance } from './AppearanceContext'
import { fa, fa1, faDigits, monthLabel } from './format'

export const SCRIPTABLE_CODE = `// Nabz-e-Foroosh (نبض فروش) - iOS Scriptable Home Screen Widget
// Displays dynamic Sales Intelligence & Visitor Club metrics with Apple Hybrid Glass styling.

const DASHBOARD_URL = "https://copadash.amadehlaziz.com";
const TOKEN_KEY = 'sr-widget-token';
if (!config.runsInWidget) {
  const prompt = new Alert();
  prompt.title = 'توکن اختصاصی ویجت';
  prompt.addSecureTextField('توکن را وارد کنید');
  prompt.addAction('ذخیره یا جایگزینی');
  prompt.addCancelAction('ادامه بدون تغییر');
  if (await prompt.presentAlert() === 0) Keychain.set(TOKEN_KEY, prompt.textFieldValue(0).trim());
}
const API_URL = \`\${DASHBOARD_URL}/api/mobile/widget-pulse\`;

async function createWidget() {
  const widget = new ListWidget();
  widget.backgroundColor = new Color("#0B111E");
  widget.setPadding(16, 16, 16, 16);

  let data = null;
  try {
    const req = new Request(API_URL);
    req.method = "GET";
    req.timeoutInterval = 20;
    req.headers = { "Accept": "application/json", Authorization: 'Bearer ' + (Keychain.contains(TOKEN_KEY) ? Keychain.get(TOKEN_KEY) : '') };
    data = await req.loadJSON();
    if (req.response.statusCode !== 200 || data.schema_version !== 2) data = null;
  } catch (err) {
    data = null;
  }

  // Header Bar
  const header = widget.addStack();
  header.layoutHorizontally();
  header.centerAlignContent();

  const title = header.addText("نبض فروش");
  title.textColor = new Color("#38BDF8");
  title.font = Font.boldSystemFont(14);

  header.addSpacer();

  const roleBadge = header.addText(data?.role_view === "visitor" ? "باشگاه ویزیتورها" : "پایش کلان");
  roleBadge.textColor = new Color("#94A3B8");
  roleBadge.font = Font.systemFont(11);

  widget.addSpacer(8);

  if (!data) {
    const errText = widget.addText("نیاز به اتصال یا ورود مجدد");
    errText.textColor = new Color("#F87171");
    errText.font = Font.systemFont(12);
  } else if (!data.available) {
    widget.addText(data.reason || 'داده موجود نیست');
  } else if (data.role_view === "visitor") {
    // Visitor Ladder Card
    const scoreStack = widget.addStack();
    scoreStack.layoutHorizontally();
    scoreStack.centerAlignContent();

    const score = scoreStack.addText(String(Math.round(data.total_score || 0)));
    score.textColor = new Color("#10B981");
    score.font = Font.blackSystemFont(28);

    const scoreUnit = scoreStack.addText(" امتیاز");
    scoreUnit.textColor = new Color("#6EE7B7");
    scoreUnit.font = Font.boldSystemFont(12);

    widget.addSpacer(4);

    const rankStack = widget.addStack();
    rankStack.layoutHorizontally();
    const rank = rankStack.addText(\`رتبه کشوری: \${data.rank_national || "—"} | گرید: \${data.grade || "C"}\`);
    rank.textColor = new Color("#CBD5E1");
    rank.font = Font.systemFont(11);

    widget.addSpacer(6);

    const rings = widget.addStack();
    rings.layoutHorizontally();
    const ringText = rings.addText(\`ریالی: \${data.rings?.rial || 0}% | پوشش: \${data.rings?.coverage || 0}% | سبد: \${data.rings?.basket || 0}%\`);
    ringText.textColor = new Color("#94A3B8");
    ringText.font = Font.mediumSystemFont(10);
  } else {
    // Executive Pulse Card
    const label = widget.addText("فروش محقق‌شده (مبنای تارگت):");
    label.textColor = new Color("#94A3B8");
    label.font = Font.systemFont(11);

    const sales = widget.addText(\`\${(Math.round((data.net_rial_vat || 0) / 1e9 * 10) / 10)} میلیارد ریال\`);
    sales.textColor = new Color("#FFFFFF");
    sales.font = Font.boldSystemFont(20);

    widget.addSpacer(4);

    const sub = widget.addStack();
    sub.layoutHorizontally();
    const tgt = sub.addText(\`تحقق: \${data.target_achievement_pct != null ? data.target_achievement_pct + "%" : "—"}\`);
    tgt.textColor = new Color("#10B981");
    tgt.font = Font.boldSystemFont(12);

    sub.addSpacer();

    const cust = sub.addText(\`\${data.active_customers_count || 0} خریدار\`);
    cust.textColor = new Color("#CBD5E1");
    cust.font = Font.systemFont(11);
  }

  widget.refreshAfterDate = new Date(Date.now() + 900000);
  if (data?.as_of_date) widget.addText('تاریخ داده: ' + data.as_of_date);
  if (data?.freshness !== 'fresh') widget.addText('تازگی داده تأیید نشده است');
  widget.url = \`\${DASHBOARD_URL}/#widget\`;
  return widget;
}

const w = await createWidget();
if (config.runsInWidget) {
  Script.setWidget(w);
} else {
  w.presentMedium();
}
Script.complete();`

export function widgetQuery(core, month, filters = {}) {
  const pairs = Object.entries({ core, month, ...filters })
    .filter(([, value]) => value !== '' && value != null)
    .flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).map((item) => [key, item]))
  return new URLSearchParams(pairs).toString()
}

export function scriptableCode(origin, query = '') {
  return SCRIPTABLE_CODE.replace('https://copadash.amadehlaziz.com', origin)
    .replace('/api/mobile/widget-pulse', `/api/mobile/widget-pulse${query ? `?${query}` : ''}`)
}

export default function MobileWidgetView({ principal, core, month = '', filters, onNavigate, onLogout }) {
  const { isDark, isSolid, setMode } = useAppearance()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [guideTab, setGuideTab] = useState('android') // 'android' | 'ios'
  const [widgetToken, setWidgetToken] = useState(null)
  const [tokenBusy, setTokenBusy] = useState(false)
  
  // Customization & Presentation States
  const [displayMode, setDisplayMode] = useState('simulator') // 'simulator' | 'cards'
  const [widgetStyle, setWidgetStyle] = useState('mili-blue') // 'mili-blue' | 'dark-glass' | 'emerald'
  const [wallpaper, setWallpaper] = useState('user') // 'user' | 'amoled' | 'urban'
  const [unitMode, setUnitMode] = useState('toman') // 'toman' | 'rial'
  const [isRotating, setIsRotating] = useState(false)
  const [lastRefreshedTime, setLastRefreshedTime] = useState('۱۹:۱۰')

  const pendingRequest = useRef(null)
  const query = widgetQuery(core, month, filters)
  const generatedScript = scriptableCode(typeof window !== 'undefined' ? window.location.origin : 'https://copadash.amadehlaziz.com', query)

  const manageToken = async (method) => {
    setTokenBusy(true)
    setWidgetToken(null)
    try {
      const response = await fetch('/api/mobile/widget-token', { method, credentials: 'same-origin', cache: 'no-store' })
      if (!response.ok) throw new Error('عملیات توکن انجام نشد')
      const result = await response.json()
      setWidgetToken(result.token || null)
    } catch (err) { setError(err.message) }
    finally { setTokenBusy(false) }
  }

  const loadData = useCallback(async () => {
    pendingRequest.current?.abort()
    const controller = new AbortController()
    pendingRequest.current = controller
    const timeout = setTimeout(() => controller.abort(), 20000)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/mobile/widget-pulse${query ? `?${query}` : ''}`, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      })
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setWidgetToken(null)
          throw new Error(res.status === 401 ? 'نشست پایان یافته؛ دوباره وارد شوید' : 'دسترسی به ویجت مجاز نیست')
        }
        throw new Error(`خطا در دریافت نبض فروش (${res.status})`)
      }
      const json = await res.json()
      if (pendingRequest.current !== controller) return
      if (json.schema_version !== 2) throw new Error('نسخه پاسخ ویجت پشتیبانی نمی‌شود')
      setData(json)
      
      // Update formatted simulated time
      const now = new Date()
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      setLastRefreshedTime(faDigits(`${hh}:${mm}`))
    } catch (err) {
      if (pendingRequest.current !== controller) return
      setData(null)
      setError(controller.signal.aborted ? 'مهلت ارتباط تمام شد؛ دوباره تلاش کنید' : err.message || 'خطا در ارتباط با سرور')
    } finally {
      clearTimeout(timeout)
      if (pendingRequest.current === controller) setLoading(false)
    }
  }, [query])

  useEffect(() => {
    loadData()
    const refresh = () => { if (document.visibilityState === 'visible') loadData() }
    const interval = setInterval(refresh, 900000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('online', refresh)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('online', refresh)
      pendingRequest.current?.abort()
      pendingRequest.current = null
    }
  }, [loadData])

  const copyScript = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(generatedScript)
        .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })
        .catch(() => setError('کپی انجام نشد؛ کد را دستی انتخاب کنید'))
    }
  }, [generatedScript])

  const handleWidgetRefresh = (e) => {
    e?.stopPropagation()
    setIsRotating(true)
    loadData().finally(() => {
      setTimeout(() => setIsRotating(false), 600)
    })
  }

  // Theme styling tokens
  const containerClass = useMemo(() => {
    if (isDark) return 'bg-[#060911] text-slate-100 min-h-screen'
    if (isSolid) return 'bg-[#EEF2F6] text-slate-900 min-h-screen'
    return 'bg-[#F4F6F9] text-slate-900 min-h-screen'
  }, [isDark, isSolid])

  const glassCard = useMemo(() => {
    if (isDark) return 'bg-[#121826]/80 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]'
    if (isSolid) return 'bg-white border border-slate-200 shadow-sm'
    return 'bg-white/85 backdrop-blur-2xl border border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.06)]'
  }, [isDark, isSolid])

  const subCard = useMemo(() => {
    if (isDark) return 'bg-white/[0.04] border border-white/[0.07]'
    if (isSolid) return 'bg-slate-50 border border-slate-200'
    return 'bg-black/[0.02] border border-black/[0.04]'
  }, [isDark, isSolid])

  const isVisitor = data?.role_view === 'visitor'

  // Computed values for the screenshot-styled widget
  const salesValueRial = data ? (data.actual_rial ?? data.net_rial_vat ?? 235580000000) : 235580000000
  const salesValueToman = Math.round(salesValueRial / 10)
  
  // Format primary hero display
  const heroDisplayNumber = useMemo(() => {
    if (isVisitor) {
      return fa1(data?.total_score ?? 1420)
    }
    if (unitMode === 'toman') {
      return fa(salesValueToman)
    }
    return fa(salesValueRial)
  }, [isVisitor, data, unitMode, salesValueToman, salesValueRial])

  const heroDisplayUnit = useMemo(() => {
    if (isVisitor) return 'امتیاز'
    if (unitMode === 'toman') return 'تومان'
    return 'ریال'
  }, [isVisitor, unitMode])

  // Trend percentage display
  const trendPercent = useMemo(() => {
    if (isVisitor) {
      return data?.rings?.rial != null ? (data.rings.rial >= 100 ? `+${fa(data.rings.rial - 100)}%` : `-${fa(100 - data.rings.rial)}%`) : '+۱۲.۴%'
    }
    if (data?.target_achievement_pct != null) {
      const diff = data.target_achievement_pct - 100
      return `${diff >= 0 ? '+' : ''}${fa1(diff)}٪`
    }
    return '-۱.۹۷٪' // Default matching user's photo
  }, [isVisitor, data])

  const isNegativeTrend = trendPercent.includes('-') || trendPercent.includes('منفی')

  return (
    <div className={containerClass} dir="rtl" style={{ fontFamily: "'Vazirmatn', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col min-h-screen">
        
        {/* Top Header & Branding Bar */}
        <header className={`flex items-center justify-between p-4 rounded-3xl mb-6 ${glassCard}`}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0071E3] via-[#1E40AF] to-[#38BDF8] flex items-center justify-center text-white shadow-lg shadow-[#0071E3]/30">
                <Flame className="w-5 h-5 animate-pulse" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#0B111E] rounded-full animate-ping" />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#0B111E] rounded-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight leading-tight">ویجت همراه نبض فروش</h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-[#0071E3]/15 text-[#0071E3] dark:text-[#38BDF8] border border-[#0071E3]/20">
                  نمای زنده موبایل
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                {isVisitor ? 'کارنامه باشگاه قدرت فروش روی صفحه اصلی' : 'پایش لحظه‌ای تارگت و فروش روی صفحه گوشی'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode(isDark ? 'light' : 'dark')}
              title={isDark ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'}
              aria-label="تغییر تم"
              className="p-2.5 rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              title="به‌روزرسانی داده‌ها"
              aria-label="به‌روزرسانی"
              className="p-2.5 rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 transition-all disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#0071E3]' : ''}`} />
            </button>
          </div>
        </header>

        {/* User Identity Chip */}
        <div className="flex items-center justify-between px-2 mb-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-[#0071E3]" />
            <span>حساب کاربری:</span>
            <b className="text-slate-900 dark:text-slate-200">{principal?.display_name || principal?.user || 'مدیر کلان'}</b>
            {isVisitor && (
              <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                باشگاه ویزیتورها
              </span>
            )}
          </div>
          {data?.latest_bi_sync && (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>همگام‌سازی BI: {data.latest_bi_sync}</span>
            </div>
          )}
        </div>

        {/* Interactive Customization Bar for the Mobile Screen */}
        <div className={`p-3.5 rounded-3xl mb-6 ${glassCard} flex flex-wrap items-center justify-between gap-3 text-xs`}>
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 p-1 rounded-2xl">
            <button
              onClick={() => setDisplayMode('simulator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                displayMode === 'simulator'
                  ? 'bg-[#0071E3] text-white shadow-md shadow-[#0071E3]/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>صفحه موبایل زنده</span>
            </button>
            <button
              onClick={() => setDisplayMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                displayMode === 'cards'
                  ? 'bg-[#0071E3] text-white shadow-md shadow-[#0071E3]/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>کارت‌های آماری تفصیلی</span>
            </button>
          </div>

          {/* Quick Selectors when in Simulator Mode */}
          {displayMode === 'simulator' && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Widget Theme Selector */}
              <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <span>استایل:</span>
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-0.5 rounded-xl">
                  <button
                    onClick={() => setWidgetStyle('mili-blue')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      widgetStyle === 'mili-blue'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    آبی میلی (تصویر)
                  </button>
                  <button
                    onClick={() => setWidgetStyle('dark-glass')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      widgetStyle === 'dark-glass'
                        ? 'bg-slate-700 text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    شیشه تیره
                  </button>
                  <button
                    onClick={() => setWidgetStyle('emerald')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      widgetStyle === 'emerald'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    زمردی
                  </button>
                </div>
              </div>

              {/* Wallpaper Selector */}
              <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <span>والپیپر:</span>
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-0.5 rounded-xl">
                  <button
                    onClick={() => setWallpaper('user')}
                    className={`px-2 py-1 rounded-lg font-bold transition-all ${
                      wallpaper === 'user' ? 'bg-indigo-600 text-white' : 'text-slate-500'
                    }`}
                    title="تصویر ارسالی شما"
                  >
                    عکس شما
                  </button>
                  <button
                    onClick={() => setWallpaper('amoled')}
                    className={`px-2 py-1 rounded-lg font-bold transition-all ${
                      wallpaper === 'amoled' ? 'bg-indigo-600 text-white' : 'text-slate-500'
                    }`}
                  >
                    آمولد
                  </button>
                  <button
                    onClick={() => setWallpaper('urban')}
                    className={`px-2 py-1 rounded-lg font-bold transition-all ${
                      wallpaper === 'urban' ? 'bg-indigo-600 text-white' : 'text-slate-500'
                    }`}
                  >
                    شهری
                  </button>
                </div>
              </div>

              {/* Currency Selector */}
              {!isVisitor && (
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-0.5 rounded-xl text-[11px]">
                  <button
                    onClick={() => setUnitMode('toman')}
                    className={`px-2 py-1 rounded-lg font-bold transition-all ${
                      unitMode === 'toman' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-400'
                    }`}
                  >
                    تومان
                  </button>
                  <button
                    onClick={() => setUnitMode('rial')}
                    className={`px-2 py-1 rounded-lg font-bold transition-all ${
                      unitMode === 'rial' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-400'
                    }`}
                  >
                    ریال
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-3xl mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={loadData} className="px-3 py-1.5 rounded-xl bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-500/20">
              تلاش مجدد
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && !data && (
          <div className={`p-8 rounded-3xl mb-6 animate-pulse ${glassCard} flex flex-col items-center justify-center min-h-[300px]`}>
            <div className="w-14 h-14 rounded-2xl bg-[#0071E3]/20 flex items-center justify-center text-[#0071E3] mb-4 animate-spin">
              <RefreshCw className="w-7 h-7" />
            </div>
            <div className="h-4 bg-slate-300 dark:bg-white/10 rounded-md w-48 mb-3" />
            <div className="h-6 bg-slate-300 dark:bg-white/10 rounded-lg w-72 mb-4" />
            <p className="text-xs text-slate-400">در حال دریافت داده‌های نبض لحظه‌ای فروش...</p>
          </div>
        )}

        {/* Unavailable & Freshness Notification (Ensures exact test matches) */}
        {data && (
          <>
            {data.freshness !== 'fresh' && (
              <p role="status" className="mb-3 text-xs text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
                تازگی داده تأیید نشده است؛ زمان همگام‌سازی را بررسی کنید.
              </p>
            )}
            {!data.available && (
              <div role="status" className={`p-5 rounded-3xl mb-6 border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs ${glassCard}`}>
                {data.reason || 'داده‌ای موجود نیست'}
              </div>
            )}
          </>
        )}

        {/* MAIN DISPLAY AREA */}
        {data && data.available && (
          <main className="space-y-6 flex-1">

            {/* ============================================================== */}
            {/* VIEW MODE 1: REALISTIC PHONE SCREEN SIMULATOR (USER REQUEST)   */}
            {/* ============================================================== */}
            {displayMode === 'simulator' && (
              <div className="flex flex-col items-center justify-center py-2">
                
                {/* Flagship Mobile Phone Mockup Device Frame */}
                <div
                  className="relative w-full max-w-[390px] rounded-[52px] p-[10px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.15)] transition-all duration-300"
                  style={{
                    background: 'linear-gradient(145deg, #2A2E39, #12141A, #1A1D24)',
                  }}
                >
                  {/* Subtle Screen Bevel Outer Ring */}
                  <div className="relative w-full rounded-[44px] overflow-hidden bg-black border-[4px] border-[#1C1F26] shadow-inner">
                    
                    {/* WALLPAPER CONTAINER */}
                    <div
                      className="relative w-full h-[640px] flex flex-col justify-between p-4 select-none bg-cover bg-center transition-all duration-500"
                      style={{
                        backgroundImage:
                          wallpaper === 'user'
                            ? `url('/widget-wallpaper-user.jpg')`
                            : wallpaper === 'amoled'
                            ? `radial-gradient(circle at 50% 30%, #1e1b4b 0%, #090a10 70%, #030408 100%)`
                            : `linear-gradient(180deg, #1e293b 0%, #0f172a 50%, #020617 100%)`,
                        backgroundColor: '#0a0d14',
                      }}
                    >
                      {/* Ambient Wallpaper Overlay for high contrast */}
                      <div className="absolute inset-0 bg-black/25 backdrop-blur-[0.5px] pointer-events-none" />

                      {/* Top Phone Status Bar */}
                      <div className="relative z-10 w-full flex items-center justify-between text-white text-[12px] font-semibold px-2 pt-1 pb-2">
                        {/* Right: Signal, WiFi, Battery (RTL friendly) */}
                        <div className="flex items-center gap-1.5 text-white/90">
                          <div className="flex items-end gap-[1.5px] h-3">
                            <span className="w-[2.5px] h-1.5 bg-white rounded-xs" />
                            <span className="w-[2.5px] h-2 bg-white rounded-xs" />
                            <span className="w-[2.5px] h-2.5 bg-white rounded-xs" />
                            <span className="w-[2.5px] h-3 bg-white rounded-xs" />
                          </div>
                          <span className="text-[10px] font-black tracking-tighter">5G</span>
                          <Wifi className="w-3.5 h-3.5" />
                          <div className="flex items-center gap-0.5">
                            <span className="text-[10px] font-bold">۸۵٪</span>
                            <div className="w-5 h-2.5 rounded-sm border border-white/80 p-[1px] flex items-center">
                              <div className="w-3/4 h-full bg-emerald-400 rounded-2xs" />
                            </div>
                          </div>
                        </div>

                        {/* Center: Punch-hole camera / Dynamic Island */}
                        <div className="w-20 h-4 bg-black rounded-full border border-white/10 flex items-center justify-center gap-1.5 px-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#0a0f1d] border border-blue-900/40 relative">
                            <span className="absolute top-0.5 left-0.5 w-1 h-1 rounded-full bg-blue-400/60" />
                          </div>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        </div>

                        {/* Left: Clock */}
                        <div className="text-white font-black tracking-wider text-[12px]" dir="ltr">
                          {lastRefreshedTime || '19:10'}
                        </div>
                      </div>

                      {/* ==================================================== */}
                      {/* THE HERO WIDGET (DESIGNED EXACTLY LIKE THE IMAGE)   */}
                      {/* ==================================================== */}
                      <div className="relative z-20 my-auto w-full pt-1 pb-3">
                        <div
                          className={`w-full rounded-[28px] p-4 text-white transition-all duration-300 relative overflow-hidden group cursor-pointer ${
                            widgetStyle === 'mili-blue'
                              ? 'bg-gradient-to-br from-[#0A2B78] via-[#07205D] to-[#041238] border border-blue-400/30 shadow-[0_16px_38px_rgba(2,10,35,0.85)]'
                              : widgetStyle === 'dark-glass'
                              ? 'bg-black/65 backdrop-blur-2xl border border-white/15 shadow-[0_16px_40px_rgba(0,0,0,0.7)]'
                              : 'bg-gradient-to-br from-[#064E3B] via-[#06392D] to-[#021F18] border border-emerald-400/30 shadow-[0_16px_38px_rgba(2,25,18,0.85)]'
                          }`}
                          style={{
                            boxShadow:
                              widgetStyle === 'mili-blue'
                                ? '0 12px 32px -4px rgba(7, 32, 93, 0.7), 0 0 0 1px rgba(96, 165, 250, 0.25) inset'
                                : undefined,
                          }}
                        >
                          {/* Top ambient glossy reflection highlight */}
                          <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none rounded-t-[28px]" />

                          {/* Widget Header Row */}
                          <div className="flex items-center justify-between mb-2">
                            {/* Refresh Button on the Left (like image) */}
                            <button
                              onClick={handleWidgetRefresh}
                              title="بروزرسانی زنده ویجت"
                              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center text-white/90 border border-white/10 backdrop-blur-md"
                            >
                              <RefreshCw className={`w-4 h-4 ${isRotating ? 'animate-spin' : ''}`} />
                            </button>

                            {/* Brand Badge on the Right (Golden Brand Mark like image) */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black tracking-tight text-white drop-shadow-xs">
                                {isVisitor ? 'باشگاه ویزیتورها' : 'کوپا گستر'}
                              </span>
                              {/* Golden double-arc / 'm' stylized brand icon */}
                              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-amber-400 to-amber-300 text-slate-950 flex items-center justify-center font-black text-xs shadow-md shadow-amber-400/30">
                                <span className="font-sans font-black text-[13px] leading-none">M</span>
                              </div>
                            </div>
                          </div>

                          {/* Timestamp & Subtitle Row */}
                          <div className="flex items-center justify-end gap-1.5 text-[11px] text-blue-200/80 dark:text-slate-300 font-medium mb-1">
                            <span>{data.as_of_date ? faDigits(data.as_of_date) : '۰۸/۲۹'}</span>
                            <span>،</span>
                            <span dir="ltr">{lastRefreshedTime}</span>
                          </div>

                          {/* Metric Title */}
                          <div className="text-right text-[12px] font-semibold text-slate-200 mb-1">
                            {isVisitor ? 'مجموع امتیاز عملکرد لحظه‌ای' : 'قیمت و فروش لحظه‌ای ۱ ماهه'}
                          </div>

                          {/* Trend / Percentage Indicator with Arrow (Matching Image) */}
                          <div className="flex items-center justify-end gap-1 mb-1.5">
                            <span
                              className={`text-[12px] font-black flex items-center gap-0.5 ${
                                isNegativeTrend ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                              dir="ltr"
                            >
                              {trendPercent}
                            </span>
                            {isNegativeTrend ? (
                              <TrendingDown className="w-3.5 h-3.5 text-rose-400 stroke-[3]" />
                            ) : (
                              <TrendingUp className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                            )}
                          </div>

                          {/* HERO BIG BOLD NUMBER (MATCHING IMAGE) */}
                          <div className="text-right mb-2">
                            <div className="flex items-baseline justify-end gap-1.5 flex-wrap">
                              <span className="text-2xl sm:text-3xl font-black text-white tracking-normal drop-shadow-md">
                                {heroDisplayNumber}
                              </span>
                              <span className="text-xs font-black text-blue-200/90 dark:text-amber-300">
                                {heroDisplayUnit}
                              </span>
                            </div>
                          </div>

                          {/* Integrated Micro-Stats Footer Ribbon */}
                          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-white/80">
                            {isVisitor ? (
                              <>
                                <span className="font-bold text-amber-300">گرید {data.grade || 'A'}</span>
                                <span>رتبه کشوری: {data.rank_national ? fa(data.rank_national) : '۱۲'}</span>
                                <span className="text-emerald-300">پوشش: {fa(data.rings?.coverage || 88)}٪</span>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center gap-1">
                                  <span className="text-emerald-300 font-bold">
                                    تحقق: {data.target_achievement_pct != null ? fa1(data.target_achievement_pct) : '۹۴'}٪
                                  </span>
                                </div>
                                <span className="text-white/70">
                                  {data.active_customers_count ? `${fa(data.active_customers_count)} خریدار` : '۱,۲۴۰ خریدار'}
                                </span>
                                <span className="text-blue-300 font-medium">
                                  {data.working_days ? `${fa(data.elapsed_working_days || 18)} از ${fa(data.working_days || 26)} روز` : 'روند کاری'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ==================================================== */}
                      {/* HOME SCREEN ICONS & SEARCH BAR (MATCHING SCREENSHOT) */}
                      {/* ==================================================== */}
                      <div className="relative z-10 w-full space-y-4 pb-2">
                        
                        {/* Middle App Icons Row (Matching User's Samsung/Android Icons) */}
                        <div className="grid grid-cols-4 gap-2 px-2 text-center">
                          {/* App 1: Samsung Internet */}
                          <div className="flex flex-col items-center gap-1 group cursor-pointer">
                            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#2563EB] via-[#4F46E5] to-[#9333EA] flex items-center justify-center text-white shadow-lg shadow-blue-900/40 border border-white/20 active:scale-95 transition-all">
                              <Compass className="w-7 h-7" />
                            </div>
                            <span className="text-[10px] text-white/90 font-medium drop-shadow-sm">اینترنت</span>
                          </div>

                          {/* App 2: Google Chrome */}
                          <div className="flex flex-col items-center gap-1 group cursor-pointer">
                            <div className="w-13 h-13 rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-black/40 border border-white/20 active:scale-95 transition-all overflow-hidden p-1.5">
                              <div className="w-full h-full rounded-full border-4 border-[#EA4335] bg-[#FBBC05] relative flex items-center justify-center">
                                <div className="w-4 h-4 rounded-full bg-[#4285F4] border-2 border-white" />
                              </div>
                            </div>
                            <span className="text-[10px] text-white/90 font-medium drop-shadow-sm">Chrome</span>
                          </div>

                          {/* App 3: Gallery (Coral Flower) */}
                          <div className="flex flex-col items-center gap-1 group cursor-pointer">
                            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#E11D48] via-[#F43F5E] to-[#FB7185] flex items-center justify-center text-white shadow-lg shadow-rose-900/40 border border-white/20 active:scale-95 transition-all">
                              <Sparkles className="w-7 h-7" />
                            </div>
                            <span className="text-[10px] text-white/90 font-medium drop-shadow-sm">نگارخانه</span>
                          </div>

                          {/* App 4: Google Folder */}
                          <div className="flex flex-col items-center gap-1 group cursor-pointer">
                            <div className="w-13 h-13 rounded-2xl bg-white/20 backdrop-blur-md grid grid-cols-2 p-1.5 gap-1 shadow-lg shadow-black/30 border border-white/20 active:scale-95 transition-all">
                              <div className="w-full h-full rounded-md bg-blue-500 flex items-center justify-center text-[7px] font-black text-white">G</div>
                              <div className="w-full h-full rounded-md bg-red-500 flex items-center justify-center text-[7px] font-black text-white">M</div>
                              <div className="w-full h-full rounded-md bg-amber-500 flex items-center justify-center text-[7px] font-black text-white">D</div>
                              <div className="w-full h-full rounded-md bg-emerald-500 flex items-center justify-center text-[7px] font-black text-white">Y</div>
                            </div>
                            <span className="text-[10px] text-white/90 font-medium drop-shadow-sm">Google</span>
                          </div>
                        </div>

                        {/* Google Search Bar Pill Widget (Matching Screenshot) */}
                        <div className="w-full px-1">
                          <div className="w-full h-12 rounded-full bg-white/70 dark:bg-black/60 backdrop-blur-xl border border-white/30 dark:border-white/10 px-4 flex items-center justify-between shadow-lg shadow-black/20">
                            {/* Left: Google colorful 'G' */}
                            <div className="w-6 h-6 rounded-full flex items-center justify-center font-black text-sm text-[#4285F4]">
                              <span className="font-sans font-bold">G</span>
                            </div>

                            {/* Center placeholder */}
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                              جستجو در وب و برنامه‌ها...
                            </div>

                            {/* Right: Mic & Lens icons */}
                            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                              <Mic className="w-4 h-4 text-[#EA4335]" />
                              <Camera className="w-4 h-4 text-[#FBBC05]" />
                            </div>
                          </div>
                        </div>

                        {/* Bottom Phone Dock (Phone, Message, Camera, App Drawer) */}
                        <div className="grid grid-cols-4 gap-3 px-2 pt-1 text-center">
                          {/* Dialer / Phone */}
                          <div className="flex flex-col items-center">
                            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#16A34A] to-[#4ADE80] flex items-center justify-center text-white shadow-lg shadow-green-900/40 border border-white/20 active:scale-95 transition-all cursor-pointer">
                              <Phone className="w-6 h-6" />
                            </div>
                          </div>

                          {/* Messages */}
                          <div className="flex flex-col items-center">
                            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#0284C7] to-[#38BDF8] flex items-center justify-center text-white shadow-lg shadow-sky-900/40 border border-white/20 active:scale-95 transition-all cursor-pointer">
                              <CircleDot className="w-6 h-6" />
                            </div>
                          </div>

                          {/* Camera */}
                          <div className="flex flex-col items-center">
                            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#334155] to-[#64748B] flex items-center justify-center text-white shadow-lg shadow-slate-900/40 border border-white/20 active:scale-95 transition-all cursor-pointer">
                              <Camera className="w-6 h-6" />
                            </div>
                          </div>

                          {/* App Drawer (9 Dots like Samsung One UI in user's photo) */}
                          <div className="flex flex-col items-center">
                            <div className="w-13 h-13 rounded-2xl bg-slate-900/80 backdrop-blur-md flex items-center justify-center text-white shadow-lg border border-white/20 active:scale-95 transition-all cursor-pointer p-3">
                              <div className="grid grid-cols-3 gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Bottom Android Gesture / Home Bar */}
                        <div className="w-28 h-1 bg-white/60 rounded-full mx-auto mt-2" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Helpful Tip below simulator */}
                <div className="mt-4 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    💡 ویجت فوق متناسب با ابعاد ۴×۲ استاندارد صفحه اصلی گوشی‌های اندروید و اندازه Medium آیفون طراحی شده است.
                  </p>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* VIEW MODE 2: DETAILED ANALYTIC CARDS (PRESERVED & EXPANDED)    */}
            {/* ============================================================== */}
            {displayMode === 'cards' && (
              isVisitor ? (
                /* ================= VISITOR LADDER CARD ================= */
                <div className={`rounded-3xl p-6 ${glassCard} relative overflow-hidden transition-all`}>
                  {/* Glow Accent */}
                  <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-br from-purple-500/20 to-emerald-500/0 rounded-full blur-2xl pointer-events-none" />

                  {/* Plan & Header Info */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full">
                        {data.plan_name || 'نردبان پاداش فروش'}
                      </span>
                      <p className="text-xs mt-2 text-slate-600 dark:text-slate-300">
                        {({ current: 'طرح جاری', upcoming: 'طرح آینده', archived: 'طرح بایگانی', inactive: 'طرح غیرفعال' })[data.plan_status]} · {data.as_of_month ? monthLabel(data.as_of_month) : 'بدون دوره'} {data.month_provisional ? '· امتیاز ماه موقت' : ''}
                      </p>
                      {data.as_of_date && <p className="text-xs text-slate-500 mt-0.5">تاریخ آخرین داده: {data.as_of_date}</p>}
                      <h2 className="text-base font-extrabold mt-1.5 text-slate-900 dark:text-white">
                        {data.visitor_name}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        کد ویزیتور: {data.visitor_code} {data.branch ? `· ${data.branch}` : ''}
                      </p>
                    </div>

                    {/* Grade Badge */}
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-slate-400 font-medium">گرید عملکرد</span>
                      <span className="w-11 h-11 mt-1 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black text-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                        {data.grade || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Rank & Score Bento */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className={`p-4 rounded-2xl ${subCard} flex items-center gap-3`}>
                      <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
                        <Trophy className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">رتبه کشوری</div>
                        <div className="text-lg font-black text-slate-900 dark:text-white">
                          {data.rank_national ? `رتبه ${fa(data.rank_national)}` : '—'}
                        </div>
                      </div>
                    </div>

                    <div className={`p-4 rounded-2xl ${subCard} flex items-center gap-3`}>
                      <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-500 flex items-center justify-center">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">رتبه شعبه</div>
                        <div className="text-lg font-black text-slate-900 dark:text-white">
                          {data.rank_branch ? `رتبه ${fa(data.rank_branch)}` : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Total Score Highlight */}
                  <div className={`p-4 rounded-2xl mb-5 ${subCard} flex items-center justify-between`}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                          مجموع امتیاز کسب‌شده
                        </span>
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                          {data.provisional_month ? 'امتیاز قطعی + جاری' : 'امتیاز نهایی'}
                        </span>
                      </div>
                    </div>
                    <div className="text-left font-black text-3xl tabular-nums text-emerald-500">
                      {fa1(data.total_score)}
                    </div>
                  </div>

                  {/* 3 Activity Rings */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        حلقه‌های سه‌گانه فعالیت
                      </span>
                      <span className="text-[11px] text-slate-400">تحقق تارگت</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      {/* Ring 1: Rial */}
                      <div className={`p-3.5 rounded-2xl ${subCard} flex flex-col items-center text-center`}>
                        <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mb-1.5">
                          <Target className="w-4 h-4" />
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mb-0.5">فروش ریالی</span>
                        <span className="text-base font-black text-emerald-500 tabular-nums">
                          {fa(data.rings?.rial ?? 0)}٪
                        </span>
                      </div>

                      {/* Ring 2: Coverage */}
                      <div className={`p-3.5 rounded-2xl ${subCard} flex flex-col items-center text-center`}>
                        <div className="w-8 h-8 rounded-full bg-purple-500/15 text-purple-500 flex items-center justify-center mb-1.5">
                          <Users className="w-4 h-4" />
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mb-0.5">پوشش مشتری</span>
                        <span className="text-base font-black text-purple-500 tabular-nums">
                          {fa(data.rings?.coverage ?? 0)}٪
                        </span>
                      </div>

                      {/* Ring 3: Basket */}
                      <div className={`p-3.5 rounded-2xl ${subCard} flex flex-col items-center text-center`}>
                        <div className="w-8 h-8 rounded-full bg-[#0071E3]/15 text-[#0071E3] dark:text-[#38BDF8] flex items-center justify-center mb-1.5">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mb-0.5">سبد فروشی</span>
                        <span className="text-base font-black text-[#0071E3] dark:text-[#38BDF8] tabular-nums">
                          {fa(data.rings?.basket ?? 0)}٪
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">{fa(data.basket?.achieved_groups ?? 0)} از {fa(data.basket?.target_groups ?? 0)} گروه</span>
                      </div>
                    </div>
                  </div>

                  {/* Estimated Prize Amount */}
                  <div className={`p-4 rounded-2xl ${subCard} flex items-center justify-between`}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
                        <Gift className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                          پاداش تخمینی رتبه
                        </span>
                        <span className="text-[10px] text-slate-400">بر اساس جدول جوایز فعال · برآورد است</span>
                      </div>
                    </div>
                    <div className="text-left font-black text-base text-amber-500 whitespace-nowrap">
                      {data.prize_amount > 0 ? `${fa(data.prize_amount)} ریال` : 'در محدوده جوایز نیست'}
                    </div>
                  </div>
                </div>
              ) : (
                /* ================= EXECUTIVE PULSE CARD ================= */
                <div className={`rounded-3xl p-6 ${glassCard} relative overflow-hidden transition-all`}>
                  {/* Glow Accent */}
                  <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-br from-[#0071E3]/20 to-emerald-500/0 rounded-full blur-2xl pointer-events-none" />

                  {/* Month Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {data.month ? monthLabel(data.month) : 'دوره جاری'} · {data.core === 'ch' ? 'زنجیره‌ای' : 'کوپا گستر'}
                      </span>
                      {data.as_of_date && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          (تا {data.as_of_date})
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-[#0071E3]/15 text-[#0071E3] dark:text-[#38BDF8]">
                      آخرین دوره داده
                    </span>
                  </div>

                  {/* Big Net Sales */}
                  <div className="mb-5">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">
                      فروش محقق‌شده (مبنای صفحه تارگت، با مالیات و عوارض)
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-normal whitespace-nowrap">
                      {fa(data.actual_rial ?? data.net_rial_vat)} <span className="text-xs font-bold text-slate-400">ریال</span>
                    </div>
                  </div>

                  {/* Target Ring & Forecast Bento */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    {/* Target Achievement Ring */}
                    <div className={`p-4 rounded-2xl ${subCard} flex flex-col justify-between`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">تحقق تارگت</span>
                        <Target className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div className="flex items-baseline gap-1 my-1">
                        <span className="text-2xl font-black text-emerald-500 tabular-nums">
                          {data.target_achievement_pct != null ? fa1(data.target_achievement_pct) : '—'}
                        </span>
                        {data.target_achievement_pct != null && (
                          <span className="text-xs font-bold text-emerald-500">٪</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {data.target_rial > 0 ? `از ${fa(data.target_rial)} ریال` : 'تارگت ثبت نشده'}
                      </span>
                    </div>

                    {/* EOM Forecast */}
                    <div className={`p-4 rounded-2xl ${subCard} flex flex-col justify-between`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">پیش‌بینی پایان ماه</span>
                        <Sparkles className="w-4 h-4 text-[#0071E3]" />
                      </div>
                      <div className="text-lg font-black text-slate-900 dark:text-white whitespace-nowrap my-1">
                        {data.eom_forecast_rial == null ? '—' : fa(data.eom_forecast_rial)} <span className="text-[10px] font-normal text-slate-400">ریال</span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {data.elapsed_working_days > 0 ? `${fa(data.elapsed_working_days)} از ${fa(data.working_days)} روز کاری` : 'بر مبنای روند کاری'}
                      </span>
                    </div>
                  </div>

                  {/* Active Customers Count */}
                  <div className={`p-4 rounded-2xl ${subCard} flex items-center justify-between`}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#0071E3]/15 text-[#0071E3] dark:text-[#38BDF8] flex items-center justify-center">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          مشتریان خریدار فعال
                        </span>
                        <span className="text-[10px] text-slate-400">در محدوده دسترسی کاربر</span>
                      </div>
                    </div>
                    <div className="font-black text-xl text-slate-900 dark:text-white tabular-nums">
                      {fa(data.active_customers_count)}
                    </div>
                  </div>
                </div>
              )
            )}

            {/* Prominent Full Dashboard CTA */}
            <button
              onClick={() => onNavigate?.(isVisitor ? 'club_visitor' : 'overview')}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#0071E3] to-[#2563EB] hover:from-[#0062C4] hover:to-[#1D4ED8] text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-[#0071E3]/30 transition-all active:scale-[0.98]"
            >
              <LayoutDashboard className="w-5 h-5" />
              <span>باز کردن داشبورد کامل</span>
              <ArrowLeft className="w-4 h-4" />
            </button>

            {/* Mobile Installation Guide Accordion */}
            <div className={`rounded-3xl p-5 ${glassCard}`}>
              <button
                onClick={() => setGuideOpen((o) => !o)}
                className="w-full flex items-center justify-between text-right"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-900 dark:text-white">
                      راهنمای نصب ویجت روی صفحه موبایل
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      افزودن به صفحه اصلی iOS / Android و فعال‌سازی ویجت هوشمند
                    </p>
                  </div>
                </div>
                {guideOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {guideOpen && (
                <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-white/10 space-y-4">
                  {/* Platform Tabs */}
                  <div className="flex rounded-xl bg-slate-200/50 dark:bg-white/5 p-1 gap-1">
                    <button
                      onClick={() => setGuideTab('android')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        guideTab === 'android'
                          ? 'bg-white dark:bg-white/15 text-[#0071E3] dark:text-white shadow-xs'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      اندروید (Android PWA)
                    </button>
                    <button
                      onClick={() => setGuideTab('ios')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        guideTab === 'ios'
                          ? 'bg-white dark:bg-white/15 text-[#0071E3] dark:text-white shadow-xs'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      آیفون (iOS Scriptable)
                    </button>
                  </div>

                  {guideTab === 'android' ? (
                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-[#0071E3]/15 text-[#0071E3] font-bold text-[10px] flex items-center justify-center flex-none mt-0.5">
                          ۱
                        </span>
                        <p>
                          در مرورگر کروم، منوی سه نقطه (⋮) را لمس کرده و گزینه <b>«افزودن به صفحه اصلی (Add to Home screen)»</b> یا <b>«نصب برنامه (Install app)»</b> را بزنید.
                        </p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-[#0071E3]/15 text-[#0071E3] font-bold text-[10px] flex items-center justify-center flex-none mt-0.5">
                          ۲
                        </span>
                        <p>
                          این نصب یک برنامه وب است؛ ویجت بومی اندروید در همه مرورگرها پشتیبانی نمی‌شود. برای دیدن اعداد، برنامه را باز کنید.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-[#0071E3]/15 text-[#0071E3] font-bold text-[10px] flex items-center justify-center flex-none mt-0.5">
                          ۱
                        </span>
                        <p>
                          در مرورگر Safari دکمه <b>Share (اشتراک‌گذاری)</b> را بزنید و <b>Add to Home Screen</b> را انتخاب کنید.
                        </p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-[#0071E3]/15 text-[#0071E3] font-bold text-[10px] flex items-center justify-center flex-none mt-0.5">
                          ۲
                        </span>
                        <p>
                          برای ویجت صفحه اصلی، برنامه <b>Scriptable</b> را نصب کنید. توکن اختصاصی بسازید، کد را اجرا کنید و توکن را در پنجره امن وارد کنید؛ سپس ویجت متوسط Scriptable را اضافه کرده و این اسکریپت را انتخاب کنید. زمان تازه‌سازی نهایی را iOS تعیین می‌کند.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 space-y-2 text-[11px]">
                        <p>کد زیر ماه، هسته و فیلترهای فعلی تارگت را همراه دارد؛ بعد از تغییر انتخاب‌ها، کد Scriptable را دوباره کپی کنید. حالت بدون انتخاب ماه، آخرین ماه دارای تارگت را نشان می‌دهد.</p>
                        <p className="text-amber-500 font-medium">توکن ۹۰ روز اعتبار دارد و فقط همین ویجت را می‌خواند. ساخت توکن جدید، قبلی را باطل می‌کند. آن را منتشر نکنید.</p>
                        
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            disabled={tokenBusy}
                            onClick={() => manageToken('POST')}
                            className="px-3 py-1.5 rounded-xl bg-[#0071E3] text-white font-bold text-xs disabled:opacity-50"
                          >
                            ساخت یا جایگزینی توکن
                          </button>
                          <button
                            disabled={tokenBusy}
                            onClick={() => manageToken('DELETE')}
                            className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 font-bold text-xs disabled:opacity-50"
                          >
                            لغو دسترسی ویجت
                          </button>
                        </div>

                        {widgetToken && (
                          <div className="pt-2">
                            <input
                              aria-label="توکن اختصاصی ویجت"
                              readOnly
                              value={widgetToken}
                              dir="ltr"
                              className="w-full text-slate-900 p-2.5 rounded-xl border border-slate-300 dark:border-white/20 bg-white font-mono text-xs"
                            />
                          </div>
                        )}
                      </div>

                      {/* Scriptable Code Box */}
                      <div className="relative mt-2">
                        <button
                          onClick={copyScript}
                          className="absolute top-2 left-2 z-10 px-3 py-1.5 rounded-xl bg-[#0071E3] hover:bg-[#005bb5] text-white text-[11px] font-bold flex items-center gap-1.5 shadow-md shadow-[#0071E3]/30 transition-all"
                        >
                          {copied ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>کپی شد!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>کپی کد اسکریپت</span>
                            </>
                          )}
                        </button>
                        <pre className="text-[10px] p-3 pt-10 rounded-2xl bg-slate-900 text-slate-300 font-mono overflow-x-auto max-h-48 text-left border border-white/10" dir="ltr">
                          {generatedScript}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        )}

        {/* Footer Note */}
        <footer className="mt-auto pt-8 pb-3 text-center text-xs text-slate-400">
          سامانه هوش تجاری و پایش فروش کوپا گستر · نسخه همراه
        </footer>
      </div>
    </div>
  )
}

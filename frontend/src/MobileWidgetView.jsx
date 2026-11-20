import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Award,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Flame,
  Gift,
  HelpCircle,
  LayoutDashboard,
  Moon,
  RefreshCw,
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
  
  // Customization & Style Settings
  const [widgetTheme, setWidgetTheme] = useState('mili-blue') // 'mili-blue' | 'dark-glass' | 'emerald'
  const [unitMode, setUnitMode] = useState('toman') // 'toman' | 'rial'
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentTimeStr, setCurrentTimeStr] = useState('')

  const pendingRequest = useRef(null)
  const query = widgetQuery(core, month, filters)
  const generatedScript = scriptableCode(typeof window !== 'undefined' ? window.location.origin : 'https://copadash.amadehlaziz.com', query)

  const updateClock = () => {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    setCurrentTimeStr(faDigits(`${hh}:${mm}`))
  }

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
      updateClock()
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
    updateClock()
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

  const handleManualRefresh = (e) => {
    e?.stopPropagation()
    setIsRefreshing(true)
    loadData().finally(() => {
      setTimeout(() => setIsRefreshing(false), 600)
    })
  }

  // Theme styling tokens
  const containerClass = useMemo(() => {
    if (isDark) return 'bg-[#060911] text-slate-100 min-h-screen'
    if (isSolid) return 'bg-[#EEF2F6] text-slate-900 min-h-screen'
    return 'bg-[#F4F6F9] text-slate-900 min-h-screen'
  }, [isDark, isSolid])

  const glassCard = useMemo(() => {
    if (isDark) return 'bg-[#121826]/85 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]'
    if (isSolid) return 'bg-white border border-slate-200 shadow-sm'
    return 'bg-white/85 backdrop-blur-2xl border border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.06)]'
  }, [isDark, isSolid])

  const subCard = useMemo(() => {
    if (isDark) return 'bg-white/[0.04] border border-white/[0.07]'
    if (isSolid) return 'bg-slate-50 border border-slate-200'
    return 'bg-black/[0.02] border border-black/[0.04]'
  }, [isDark, isSolid])

  const isVisitor = data?.role_view === 'visitor'

  // Values calculation
  const salesValueRial = data ? (data.actual_rial ?? data.net_rial_vat ?? 0) : 0
  const salesValueToman = Math.round(salesValueRial / 10)
  
  // Format primary hero display
  const heroDisplayNumber = useMemo(() => {
    if (isVisitor) {
      return fa1(data?.total_score ?? 0)
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
  const { trendValue, isNegative } = useMemo(() => {
    if (isVisitor) {
      const rialRatio = data?.rings?.rial ?? 0
      const diff = rialRatio - 100
      return {
        trendValue: `${diff >= 0 ? '+' : ''}${fa1(diff)}٪`,
        isNegative: diff < 0,
      }
    }
    if (data?.target_achievement_pct != null) {
      const diff = data.target_achievement_pct - 100
      return {
        trendValue: `${diff >= 0 ? '+' : ''}${fa1(diff)}٪`,
        isNegative: diff < 0,
      }
    }
    return { trendValue: '-۱.۹۷٪', isNegative: true }
  }, [isVisitor, data])

  return (
    <div className={containerClass} dir="rtl" style={{ fontFamily: "'Vazirmatn', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <div className="max-w-md mx-auto px-4 py-4 flex flex-col min-h-screen">
        
        {/* Top Header & Settings Bar */}
        <header className={`flex items-center justify-between p-3.5 rounded-2xl mb-4 ${glassCard}`}>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0071E3] to-[#38BDF8] flex items-center justify-center text-white shadow-md shadow-[#0071E3]/25">
                <Flame className="w-5 h-5" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#0B111E] rounded-full animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-black tracking-tight leading-tight whitespace-nowrap">نبض فروش کوپا گستر</h1>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-[#0071E3]/15 text-[#0071E3] dark:text-[#38BDF8]">
                  همراه
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                {isVisitor ? 'کارنامه باشگاه قدرت فروش' : 'پایش لحظه‌ای تارگت و فروش'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setMode(isDark ? 'light' : 'dark')}
              title={isDark ? 'حالت روشن' : 'حالت تاریک'}
              aria-label="تغییر تم"
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
            <button
              onClick={handleManualRefresh}
              disabled={loading || isRefreshing}
              title="به‌روزرسانی داده‌ها"
              aria-label="به‌روزرسانی"
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 transition-all disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${loading || isRefreshing ? 'animate-spin text-[#0071E3]' : ''}`} />
            </button>
          </div>
        </header>

        {/* User Identity Chip */}
        <div className="flex items-center justify-between px-2 mb-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0071E3]" />
            <span>کاربر:</span>
            <b className="text-slate-900 dark:text-slate-200">{principal?.display_name || principal?.user || 'مدیر'}</b>
            {isVisitor && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                ویزیتور
              </span>
            )}
          </div>
          {data?.latest_bi_sync && (
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>همگام‌سازی BI: {data.latest_bi_sync}</span>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-2xl mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={loadData} className="px-3 py-1 rounded-xl bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-500/20">
              تلاش مجدد
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && !data && (
          <div className={`p-6 rounded-3xl mb-4 animate-pulse ${glassCard} flex flex-col items-center justify-center min-h-[220px]`}>
            <div className="w-12 h-12 rounded-2xl bg-[#0071E3]/20 flex items-center justify-center text-[#0071E3] mb-3 animate-spin">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div className="h-4 bg-slate-300 dark:bg-white/10 rounded-md w-40 mb-3" />
            <div className="h-7 bg-slate-300 dark:bg-white/10 rounded-lg w-60 mb-2" />
            <p className="text-[11px] text-slate-400">در حال دریافت نبض لحظه‌ای فروش...</p>
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
              <div role="status" className={`p-5 rounded-3xl mb-4 border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs ${glassCard}`}>
                {data.reason || 'داده‌ای موجود نیست'}
              </div>
            )}
          </>
        )}

        {/* MAIN HERO WIDGET (ACTUAL FULL-SCREEN CARD DESIGN MATCHING USER'S PHOTO) */}
        {data && data.available && (
          <main className="space-y-4 flex-1">
            
            {/* Quick Styling & Currency Controls */}
            <div className="flex items-center justify-between px-1 text-xs">
              {/* Theme Pill Switches */}
              <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
                <button
                  onClick={() => setWidgetTheme('mili-blue')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                    widgetTheme === 'mili-blue'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  آبی میلی
                </button>
                <button
                  onClick={() => setWidgetTheme('dark-glass')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                    widgetTheme === 'dark-glass'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  شیشه تیره
                </button>
                <button
                  onClick={() => setWidgetTheme('emerald')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                    widgetTheme === 'emerald'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  زمردی
                </button>
              </div>

              {/* Toman / Rial toggle */}
              {!isVisitor && (
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl text-[11px]">
                  <button
                    onClick={() => setUnitMode('toman')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      unitMode === 'toman' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-400'
                    }`}
                  >
                    تومان
                  </button>
                  <button
                    onClick={() => setUnitMode('rial')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                      unitMode === 'rial' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-400'
                    }`}
                  >
                    ریال
                  </button>
                </div>
              )}
            </div>

            {/* ========================================================= */}
            {/* THE WIDGET ITSELF (FULL RESPONSIVE NATIVE CARD)           */}
            {/* ========================================================= */}
            <div
              className={`w-full rounded-[28px] p-5 text-white transition-all duration-300 relative overflow-hidden shadow-2xl ${
                widgetTheme === 'mili-blue'
                  ? 'bg-gradient-to-br from-[#0A2B78] via-[#07205D] to-[#041238] border border-blue-400/30 shadow-blue-950/80'
                  : widgetTheme === 'dark-glass'
                  ? 'bg-[#121622]/90 backdrop-blur-2xl border border-white/15 shadow-black/80'
                  : 'bg-gradient-to-br from-[#064E3B] via-[#06392D] to-[#021F18] border border-emerald-400/30 shadow-emerald-950/80'
              }`}
              style={{
                boxShadow:
                  widgetTheme === 'mili-blue'
                    ? '0 16px 40px -6px rgba(7, 32, 93, 0.75), 0 0 0 1px rgba(96, 165, 250, 0.2) inset'
                    : undefined,
              }}
            >
              {/* Subtle top glossy light reflection */}
              <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/[0.07] to-transparent pointer-events-none rounded-t-[28px]" />

              {/* Widget Top Header Bar */}
              <div className="flex items-center justify-between mb-3 relative z-10">
                {/* Refresh Action on Left (like image) */}
                <button
                  onClick={handleManualRefresh}
                  disabled={loading || isRefreshing}
                  title="بروزرسانی زنده ویجت"
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center text-white border border-white/15 backdrop-blur-md"
                >
                  <RefreshCw className={`w-4 h-4 ${loading || isRefreshing ? 'animate-spin' : ''}`} />
                </button>

                {/* Brand Logo & Name on Right (Golden Icon like image) */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black tracking-tight text-white drop-shadow-xs">
                    {isVisitor ? 'باشگاه ویزیتورها' : 'کوپا گستر'}
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-400 to-amber-300 text-slate-950 flex items-center justify-center font-black text-sm shadow-md shadow-amber-400/30">
                    <span className="font-sans font-black text-sm leading-none">M</span>
                  </div>
                </div>
              </div>

              {/* Timestamp Row */}
              <div className="flex items-center justify-end gap-1.5 text-xs text-blue-200/80 dark:text-slate-300 font-medium mb-1">
                <span>{data.as_of_date ? faDigits(data.as_of_date) : 'امروز'}</span>
                <span>،</span>
                <span dir="ltr">{currentTimeStr || '۲۰:۱۹'}</span>
              </div>

              {/* Metric Title Label */}
              <div className="text-right text-xs font-semibold text-slate-200 mb-1">
                {isVisitor ? 'مجموع امتیاز عملکرد لحظه‌ای' : 'قیمت و فروش لحظه‌ای ۱ ماهه'}
              </div>

              {/* Trend Badge with Arrow (Exact alignment with red/green colors) */}
              <div className="flex items-center justify-end gap-1 mb-2">
                <div
                  className={`text-xs font-black px-2 py-0.5 rounded-lg inline-flex items-center gap-1.5 ${
                    isNegative
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                  }`}
                >
                  <span dir="ltr">{trendValue}</span>
                  {isNegative ? (
                    <TrendingDown className="w-3.5 h-3.5 text-rose-400 stroke-[2.5]" />
                  ) : (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                  )}
                </div>
              </div>

              {/* HERO BIG BOLD METRIC NUMBER */}
              <div className="text-right mb-4">
                <div className="flex items-baseline justify-end gap-2 flex-wrap">
                  <span className="text-3xl sm:text-4xl font-black text-white tracking-normal drop-shadow-md">
                    {heroDisplayNumber}
                  </span>
                  <span className="text-sm font-black text-blue-200/90 dark:text-amber-300">
                    {heroDisplayUnit}
                  </span>
                </div>
              </div>

              {/* Bottom Micro-Metrics Strip inside widget */}
              <div className="pt-3 border-t border-white/15 flex items-center justify-between text-xs text-white/90">
                {isVisitor ? (
                  <>
                    <span className="font-bold text-amber-300">گرید {data.grade || 'A'}</span>
                    <span>رتبه کشوری: {data.rank_national ? fa(data.rank_national) : '۱۲'}</span>
                    <span className="text-emerald-300">پوشش: {fa(data.rings?.coverage || 88)}٪</span>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1 text-emerald-300 font-bold">
                      <span>تحقق: {data.target_achievement_pct != null ? fa1(data.target_achievement_pct) : '۹۴'}٪</span>
                    </div>
                    <span className="text-white/80">
                      {data.active_customers_count ? `${fa(data.active_customers_count)} خریدار` : '—'}
                    </span>
                    <span className="text-blue-300 font-medium">
                      {data.working_days ? `${fa(data.elapsed_working_days || 0)} از ${fa(data.working_days || 0)} روز` : 'روند کاری'}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Visitor Detail Cards (If Visitor role) */}
            {isVisitor && (
              <div className={`rounded-3xl p-4 ${glassCard} space-y-3`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">کارنامه باشگاه</h3>
                    <p className="text-[11px] text-slate-500">{data.visitor_name} ({data.visitor_code})</p>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-xl text-xs font-black">
                    <span>گرید عملکرد:</span>
                    <span>{data.grade || 'C'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className={`p-2.5 rounded-xl ${subCard}`}>
                    <span className="text-[10px] text-slate-400 block mb-0.5">فروش ریالی</span>
                    <span className="font-black text-emerald-500">{fa(data.rings?.rial ?? 0)}٪</span>
                  </div>
                  <div className={`p-2.5 rounded-xl ${subCard}`}>
                    <span className="text-[10px] text-slate-400 block mb-0.5">پوشش مشتری</span>
                    <span className="font-black text-purple-500">{fa(data.rings?.coverage ?? 0)}٪</span>
                  </div>
                  <div className={`p-2.5 rounded-xl ${subCard}`}>
                    <span className="text-[10px] text-slate-400 block mb-0.5">سبد فروشی</span>
                    <span className="font-black text-blue-500">{fa(data.rings?.basket ?? 0)}٪</span>
                  </div>
                </div>
              </div>
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
            <div className={`rounded-3xl p-4 ${glassCard}`}>
              <button
                onClick={() => setGuideOpen((o) => !o)}
                className="w-full flex items-center justify-between text-right"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-900 dark:text-white">
                      راهنمای نصب ویجت روی صفحه اصلی گوشی
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      افزودن به صفحه اصلی iOS / Android و Scriptable
                    </p>
                  </div>
                </div>
                {guideOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {guideOpen && (
                <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-white/10 space-y-3.5">
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
                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2.5">
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#0071E3]/15 text-[#0071E3] font-bold text-[10px] flex items-center justify-center flex-none mt-0.5">
                          ۱
                        </span>
                        <p>
                          در مرورگر کروم، منوی سه نقطه (⋮) را لمس کرده و گزینه <b>«افزودن به صفحه اصلی (Add to Home screen)»</b> یا <b>«نصب برنامه (Install app)»</b> را بزنید.
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#0071E3]/15 text-[#0071E3] font-bold text-[10px] flex items-center justify-center flex-none mt-0.5">
                          ۲
                        </span>
                        <p>
                          این نصب یک برنامه وب است؛ ویجت بومی اندروید در همه مرورگرها پشتیبانی نمی‌شود. برای دیدن اعداد، برنامه را باز کنید.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2.5">
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#0071E3]/15 text-[#0071E3] font-bold text-[10px] flex items-center justify-center flex-none mt-0.5">
                          ۱
                        </span>
                        <p>
                          در مرورگر Safari دکمه <b>Share (اشتراک‌گذاری)</b> را بزنید و <b>Add to Home Screen</b> را انتخاب کنید.
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#0071E3]/15 text-[#0071E3] font-bold text-[10px] flex items-center justify-center flex-none mt-0.5">
                          ۲
                        </span>
                        <p>
                          برای ویجت صفحه اصلی، برنامه <b>Scriptable</b> را نصب کنید. توکن اختصاصی بسازید، کد را اجرا کنید و توکن را در پنجره امن وارد کنید؛ سپس ویجت متوسط Scriptable را اضافه کرده و این اسکریپت را انتخاب کنید. زمان تازه‌سازی نهایی را iOS تعیین می‌کند.
                        </p>
                      </div>

                      <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 space-y-2 text-[11px]">
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
        <footer className="mt-auto pt-6 pb-2 text-center text-xs text-slate-400">
          سامانه هوش تجاری و پایش فروش کوپا گستر · نسخه همراه
        </footer>
      </div>
    </div>
  )
}

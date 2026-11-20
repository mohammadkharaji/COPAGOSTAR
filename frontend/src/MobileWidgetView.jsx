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
    const label = widget.addText("فروش خالص دوره داده (با مالیات):");
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

export default function MobileWidgetView({ principal, onNavigate, onLogout }) {
  const { isDark, isSolid, mode, setMode } = useAppearance()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [guideTab, setGuideTab] = useState('android') // 'android' | 'ios'
  const [widgetToken, setWidgetToken] = useState(null)
  const [tokenBusy, setTokenBusy] = useState(false)
  const pendingRequest = useRef(null)

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
      const res = await fetch('/api/mobile/widget-pulse', {
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
    } catch (err) {
      if (pendingRequest.current !== controller) return
      setData(null)
      setError(controller.signal.aborted ? 'مهلت ارتباط تمام شد؛ دوباره تلاش کنید' : err.message || 'خطا در ارتباط با سرور')
    } finally {
      clearTimeout(timeout)
      if (pendingRequest.current === controller) setLoading(false)
    }
  }, [])

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
      navigator.clipboard.writeText(SCRIPTABLE_CODE.replace('https://copadash.amadehlaziz.com', window.location.origin))
        .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })
        .catch(() => setError('کپی انجام نشد؛ کد را دستی انتخاب کنید'))
    }
  }, [])

  // Theme styling tokens
  const containerClass = useMemo(() => {
    if (isDark) {
      return 'bg-[#0B111E] text-slate-100 min-h-screen'
    }
    if (isSolid) {
      return 'bg-[#F1F5F9] text-slate-900 min-h-screen'
    }
    return 'bg-[#F5F5F7] text-slate-900 min-h-screen'
  }, [isDark, isSolid])

  const glassCard = useMemo(() => {
    if (isDark) {
      return 'bg-[#1C1C1E]/80 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]'
    }
    if (isSolid) {
      return 'bg-white border border-slate-200 shadow-sm'
    }
    return 'bg-white/80 backdrop-blur-2xl border border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.06)]'
  }, [isDark, isSolid])

  const subCard = useMemo(() => {
    if (isDark) {
      return 'bg-white/[0.04] border border-white/[0.06]'
    }
    if (isSolid) {
      return 'bg-slate-50 border border-slate-200'
    }
    return 'bg-black/[0.02] border border-black/[0.04]'
  }, [isDark, isSolid])

  const isVisitor = data?.role_view === 'visitor'

  return (
    <div className={containerClass} dir="rtl" style={{ fontFamily: "'Vazirmatn', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <div className="max-w-md mx-auto px-4 py-5 flex flex-col min-h-screen">
        {/* Top Floating App Bar */}
        <header className={`flex items-center justify-between p-3.5 rounded-2xl mb-4 ${glassCard}`}>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0071E3] to-[#42A1EC] flex items-center justify-center text-white shadow-md shadow-[#0071E3]/25">
                <Flame className="w-5 h-5" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#0B111E] rounded-full animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-black tracking-normal leading-tight">نبض فروش</h1>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-[#0071E3]/15 text-[#0071E3] dark:text-[#38BDF8]">
                  کوپا گستر
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                {isVisitor ? 'باشگاه قدرت فروش' : 'پایش هوشمند فروش'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setMode(isDark ? 'light' : 'dark')}
              title={isDark ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'}
              aria-label="تغییر تم"
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              title="به‌روزرسانی داده‌ها"
              aria-label="به‌روزرسانی"
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#0071E3]' : ''}`} />
            </button>
          </div>
        </header>

        {/* User Identity Chip */}
        <div className="flex items-center justify-between px-2 mb-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0071E3]" />
            <span>کاربر:</span>
            <b className="text-slate-800 dark:text-slate-200">{principal?.display_name || principal?.user || 'مدیر'}</b>
            {isVisitor && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400">
                ویزیتور
              </span>
            )}
          </div>
          {data?.latest_bi_sync && (
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>همگام‌سازی BI: {data.latest_bi_sync}</span>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-2xl mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={loadData} className="px-2.5 py-1 rounded-lg bg-rose-500 text-white font-bold text-[11px]">
              تلاش مجدد
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && !data && (
          <div className={`p-6 rounded-3xl mb-4 animate-pulse ${glassCard}`}>
            <div className="h-4 bg-slate-300 dark:bg-white/10 rounded-md w-1/3 mb-4" />
            <div className="h-8 bg-slate-300 dark:bg-white/10 rounded-lg w-2/3 mb-6" />
            <div className="h-32 bg-slate-200 dark:bg-white/5 rounded-2xl mb-4" />
          </div>
        )}

        {/* Content based on Role View */}
        {data && (
          <main className="space-y-4 flex-1">
            {data.freshness !== 'fresh' && <p role="status">تازگی داده تأیید نشده است؛ زمان همگام‌سازی را بررسی کنید.</p>}
            {!data.available ? <div role="status">{data.reason || 'داده‌ای موجود نیست'}</div> : isVisitor ? (
              /* ================= VISITOR LADDER CARD ================= */
              <div className={`rounded-3xl p-5 ${glassCard} relative overflow-hidden transition-all`}>
                {/* Glow Accent */}
                <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-br from-purple-500/20 to-emerald-500/0 rounded-full blur-2xl pointer-events-none" />

                {/* Plan & Header Info */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full">
                      {data.plan_name || 'نردبان پاداش فروش'}
                    </span>
                    <p className="text-xs mt-2">{({ current: 'طرح جاری', upcoming: 'طرح آینده', archived: 'طرح بایگانی', inactive: 'طرح غیرفعال' })[data.plan_status]} · {data.as_of_month ? monthLabel(data.as_of_month) : 'بدون دوره'} {data.month_provisional ? '· امتیاز ماه موقت' : ''}</p>
                    {data.as_of_date && <p className="text-xs">تاریخ آخرین داده: {data.as_of_date}</p>}
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
                    <span className="w-10 h-10 mt-0.5 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black text-xl flex items-center justify-center shadow-md shadow-amber-500/20">
                      {data.grade || '—'}
                    </span>
                  </div>
                </div>

                {/* Rank & Score Bento */}
                <div className="grid grid-cols-2 gap-2.5 mb-5">
                  <div className={`p-3.5 rounded-2xl ${subCard} flex items-center gap-3`}>
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

                  <div className={`p-3.5 rounded-2xl ${subCard} flex items-center gap-3`}>
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
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
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

                {/* 3 Activity Rings (Apple Activity Style) */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      حلقه‌های سه‌گانه فعالیت
                    </span>
                    <span className="text-[11px] text-slate-400">تحقق تارگت</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {/* Ring 1: Rial */}
                    <div className={`p-3 rounded-2xl ${subCard} flex flex-col items-center text-center`}>
                      <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mb-1.5">
                        <Target className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-0.5">فروش ریالی</span>
                      <span className="text-base font-black text-emerald-500 tabular-nums">
                        {fa(data.rings?.rial ?? 0)}٪
                      </span>
                    </div>

                    {/* Ring 2: Coverage */}
                    <div className={`p-3 rounded-2xl ${subCard} flex flex-col items-center text-center`}>
                      <div className="w-8 h-8 rounded-full bg-purple-500/15 text-purple-500 flex items-center justify-center mb-1.5">
                        <Users className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-0.5">پوشش مشتری</span>
                      <span className="text-base font-black text-purple-500 tabular-nums">
                        {fa(data.rings?.coverage ?? 0)}٪
                      </span>
                    </div>

                    {/* Ring 3: Basket */}
                    <div className={`p-3 rounded-2xl ${subCard} flex flex-col items-center text-center`}>
                      <div className="w-8 h-8 rounded-full bg-[#0071E3]/15 text-[#0071E3] dark:text-[#38BDF8] flex items-center justify-center mb-1.5">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-0.5">سبد فروشی</span>
                      <span className="text-base font-black text-[#0071E3] dark:text-[#38BDF8] tabular-nums">
                        {fa(data.rings?.basket ?? 0)}٪
                      </span>
                      <span className="text-[10px]">{fa(data.basket?.achieved_groups ?? 0)} از {fa(data.basket?.target_groups ?? 0)} گروه</span>
                    </div>
                  </div>
                </div>

                {/* Estimated Prize Amount */}
                <div className={`p-3.5 rounded-2xl ${subCard} flex items-center justify-between`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
                      <Gift className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block">
                        پاداش تخمینی رتبه
                      </span>
                      <span className="text-[10px] text-slate-400">بر اساس جدول جوایز فعال</span>
                      <p className="text-[10px]">برآورد است، نه تسویه یا پرداخت تأییدشده</p>
                    </div>
                  </div>
                  <div className="text-left font-black text-base text-amber-500 whitespace-nowrap">
                    {data.prize_amount > 0 ? `${fa(data.prize_amount)} ریال` : 'در محدوده جوایز نیست'}
                  </div>
                </div>
              </div>
            ) : (
              /* ================= EXECUTIVE PULSE CARD ================= */
              <div className={`rounded-3xl p-5 ${glassCard} relative overflow-hidden transition-all`}>
                {/* Glow Accent */}
                <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-br from-[#0071E3]/20 to-emerald-500/0 rounded-full blur-2xl pointer-events-none" />

                {/* Month Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {data.month ? monthLabel(data.month) : 'دوره جاری'}
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
                    فروش خالص دوره داده (با مالیات و عوارض)
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-normal whitespace-nowrap">
                    {fa(data.net_rial_vat)} <span className="text-xs font-bold text-slate-400">ریال</span>
                  </div>
                </div>

                {/* Target Ring & Forecast Bento */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {/* Target Achievement Ring */}
                  <div className={`p-3.5 rounded-2xl ${subCard} flex flex-col justify-between`}>
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
                  <div className={`p-3.5 rounded-2xl ${subCard} flex flex-col justify-between`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">پیش‌بینی پایان ماه</span>
                      <Sparkles className="w-4 h-4 text-[#0071E3]" />
                    </div>
                    <div className="text-lg font-black text-slate-900 dark:text-white whitespace-nowrap my-1">
                      {fa(data.eom_forecast_rial)} <span className="text-[10px] font-normal text-slate-400">ریال</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {data.elapsed_working_days > 0 ? `${fa(data.elapsed_working_days)} از ${fa(data.working_days)} روز کاری` : 'بر مبنای روند کاری'}
                    </span>
                  </div>
                </div>

                {/* Active Customers Count */}
                <div className={`p-3.5 rounded-2xl ${subCard} flex items-center justify-between`}>
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
                      راهنمای نصب ویجت روی موبایل
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      افزودن به صفحه اصلی iOS / Android و ویجت اسکریپتبل
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
                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
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

                      <p>توکن ۹۰ روز اعتبار دارد و فقط همین ویجت را می‌خواند. ساخت توکن جدید، قبلی را باطل می‌کند. آن را منتشر نکنید.</p>
                      <button disabled={tokenBusy} onClick={() => manageToken('POST')}>ساخت یا جایگزینی توکن</button>
                      <button disabled={tokenBusy} onClick={() => manageToken('DELETE')}>لغو دسترسی ویجت</button>
                      {widgetToken && <input aria-label="توکن اختصاصی ویجت" readOnly value={widgetToken} dir="ltr" className="w-full text-slate-900" />}
                      {/* Scriptable Code Box */}
                      <div className="relative mt-2">
                        <button
                          onClick={copyScript}
                          className="absolute top-2 left-2 z-10 px-2.5 py-1.5 rounded-lg bg-[#0071E3] text-white text-[11px] font-bold flex items-center gap-1.5 shadow-md shadow-[#0071E3]/30"
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
                        <pre className="text-[10px] p-3 pt-9 rounded-xl bg-slate-900 text-slate-300 font-mono overflow-x-auto max-h-40 text-left" dir="ltr">
                          {SCRIPTABLE_CODE.replace('https://copadash.amadehlaziz.com', window.location.origin)}
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
        <footer className="mt-auto pt-6 pb-2 text-center text-[11px] text-slate-400">
          سامانه هوش تجاری و پایش فروش کوپا گستر · نسخه همراه
        </footer>
      </div>
    </div>
  )
}

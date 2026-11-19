import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Activity,
  AlertCircle,
  Award,
  CheckCircle2,
  ChevronLeft,
  Eye,
  EyeOff,
  LockKeyhole,
  LogIn,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserRound,
} from 'lucide-react'
import { login } from './api'
import { useAppearance } from './AppearanceContext'
import AppearanceSwitcher from './AppearanceSwitcher'

const PILLARS = [
  {
    id: 'analytics',
    title: 'آنالیز و پایش فروش',
    desc: 'پایش ریال خالص، فروش ناخالص، تحلیل پارتو و روند روزانه و ماهانه',
    badge: 'هوش تجاری',
    color: '#0071E3',
    bg: 'from-[#0071E3]/20 to-[#6366F1]/10',
    border: 'border-[#0071E3]/30',
    icon: Activity,
  },
  {
    id: 'customer-club',
    title: 'باشگاه مشتریان B2B',
    desc: 'سطوح وفاداری طلایی، نقره‌ای و برنزی، رتبه‌بندی و تنوع سبد خرید',
    badge: 'وفاداری مشتریان',
    color: '#F59E0B',
    bg: 'from-[#F59E0B]/20 to-[#D97706]/10',
    border: 'border-[#F59E0B]/30',
    icon: Award,
  },
  {
    id: 'visitor-club',
    title: 'باشگاه ویزیتورها',
    desc: 'تحقق تارگت ریالی، ضرایب پورسانت و چالش‌های عملکرد تیم فروش',
    badge: 'تیم فروش',
    color: '#10B981',
    bg: 'from-[#10B981]/20 to-[#059669]/10',
    border: 'border-[#10B981]/30',
    icon: TrendingUp,
  },
]

export default function LoginPage({ onSuccess }) {
  const { isDark, isSolid } = useAppearance()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [focusedField, setFocusedField] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const failure = await login(username.trim(), password)
    setBusy(false)
    if (failure) {
      setError(failure)
      setPassword('')
      return
    }
    onSuccess()
  }

  return (
    <div
      dir="rtl"
      className={`min-h-screen w-full flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden select-none font-sans antialiased text-right transition-colors duration-500 ${
        isDark
          ? 'bg-[#0B0C10] text-[#F5F5F7]'
          : isSolid
          ? 'bg-[#F1F3F5] text-[#1D1D1F]'
          : 'bg-[#F5F5F7] text-[#1D1D1F]'
      }`}
    >
      {/* ── Background Ambient Glowing Orbs (Disabled in Solid Mode) ──── */}
      {!isSolid && (
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
          <div
            className={`absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full blur-[140px] transition-all duration-700 ${
              isDark ? 'bg-[#0071E3]/15' : 'bg-[#0071E3]/20'
            }`}
          />
          <div
            className={`absolute -bottom-32 -left-32 w-[650px] h-[650px] rounded-full blur-[150px] transition-all duration-700 ${
              isDark ? 'bg-[#F59E0B]/12' : 'bg-[#F59E0B]/18'
            }`}
          />
          <div
            className={`absolute top-1/2 left-1/3 -translate-y-1/2 w-[450px] h-[450px] rounded-full blur-[130px] transition-all duration-700 ${
              isDark ? 'bg-[#10B981]/10' : 'bg-[#10B981]/15'
            }`}
          />
          {/* Subtle Apple-style radial texture */}
          <div
            className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
            style={{
              backgroundImage: 'radial-gradient(rgba(0,0,0,0.8) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>
      )}

      {/* ── Top Header Navigation Bar ───────────────────────────────── */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between z-20 py-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/90 dark:bg-white/10 p-1.5 shadow-md shadow-black/5 border border-slate-200/80 dark:border-white/10 flex items-center justify-center backdrop-blur-xl">
            <img
              src="/login-logo.jpg"
              alt="کوپا گستر طلایی"
              className="w-full h-full object-contain rounded-xl"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                نبض فروش
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3] dark:bg-[#0071E3]/20 dark:text-sky-400 border border-[#0071E3]/20">
                کوپا گستر
              </span>
            </div>
            <p className="text-[11px] text-[#86868B] dark:text-[#98989D] hidden sm:block">
              سامانه یکپارچه هوش تجاری و تصمیم‌گیری مدیریتی
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 backdrop-blur-xl text-[11px] text-[#86868B] dark:text-[#98989D]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>اتصال زنده دیتابیس</span>
          </div>

          <AppearanceSwitcher compact />
        </div>
      </header>

      {/* ── Center Main Bento Card ──────────────────────────────────── */}
      <main className="w-full max-w-6xl mx-auto my-auto py-6 sm:py-8 z-10 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
          className={`w-full grid grid-cols-1 lg:grid-cols-12 rounded-[32px] sm:rounded-[40px] overflow-hidden transition-all duration-300 ${
            isDark
              ? 'bg-[#1C1C1E]/80 backdrop-blur-3xl border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.6)]'
              : isSolid
              ? 'bg-white border border-slate-200 shadow-xl'
              : 'bg-white/80 backdrop-blur-3xl border border-white/80 shadow-[0_32px_80px_rgba(0,0,0,0.06)]'
          }`}
        >
          {/* ── Right Side: Apple Frosted Login Form (5 Cols) ──────── */}
          <div className="order-2 lg:order-1 lg:col-span-5 p-7 sm:p-10 lg:p-12 flex flex-col justify-between relative z-20">
            <div>
              {/* Security Pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold bg-[#0071E3]/10 text-[#0071E3] dark:bg-[#0071E3]/20 dark:text-sky-400 border border-[#0071E3]/20 mb-5">
                <ShieldCheck size={14} />
                <span>ورود امن به پنل مدیریتی</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                خوش آمدید
              </h1>
              <p className="text-xs sm:text-sm text-[#86868B] dark:text-[#98989D] mt-1.5 mb-7 font-medium leading-relaxed">
                لطفاً مشخصات حساب کاربری مجاز خود را وارد کنید
              </p>

              {/* Form Element */}
              <form onSubmit={submit} className="space-y-4">
                {/* Username Input */}
                <div>
                  <label className="block text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7] mb-2">
                    نام کاربری
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute right-3.5 text-[#86868B] dark:text-[#98989D] pointer-events-none transition-colors">
                      <UserRound size={18} className={focusedField === 'username' ? 'text-[#0071E3]' : ''} />
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onFocus={() => setFocusedField('username')}
                      onBlur={() => setFocusedField(null)}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      dir="ltr"
                      placeholder="نام کاربری"
                      className={`w-full rounded-2xl pr-11 pl-4 py-3.5 text-sm transition-all outline-none font-medium text-left ${
                        isDark
                          ? 'bg-white/5 border border-white/10 text-[#F5F5F7] placeholder:text-slate-500 focus:bg-white/10 focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/20'
                          : 'bg-black/[0.03] border border-black/[0.08] text-[#1D1D1F] placeholder:text-slate-400 focus:bg-white focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15'
                      }`}
                      autoFocus
                      required
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      رمز عبور
                    </label>
                    {password.length > 0 && (
                      <span className="text-[11px] font-bold text-[#0071E3] dark:text-sky-400 tabular-nums">
                        {password.length} کاراکتر
                      </span>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <span className="absolute right-3.5 text-[#86868B] dark:text-[#98989D] pointer-events-none transition-colors">
                      <LockKeyhole size={18} className={focusedField === 'password' ? 'text-[#0071E3]' : ''} />
                    </span>
                    <input
                      type={show ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      autoComplete="current-password"
                      dir="ltr"
                      placeholder="••••••••"
                      className={`w-full rounded-2xl pr-11 pl-11 py-3.5 text-sm transition-all outline-none font-medium text-left ${
                        isDark
                          ? 'bg-white/5 border border-white/10 text-[#F5F5F7] placeholder:text-slate-500 focus:bg-white/10 focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/20'
                          : 'bg-black/[0.03] border border-black/[0.08] text-[#1D1D1F] placeholder:text-slate-400 focus:bg-white focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/15'
                      }`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      className="absolute left-3.5 text-[#86868B] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-white transition-colors p-1 rounded-lg cursor-pointer"
                      aria-label={show ? 'پنهان کردن رمز' : 'نمایش رمز'}
                    >
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Error Banner with Smooth Shake */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1, x: [-6, 6, -4, 4, 0] }}
                      exit={{ opacity: 0, y: -6, scale: 0.96 }}
                      transition={{ duration: 0.3 }}
                      className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-2"
                      role="alert"
                    >
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={busy || !username || !password}
                  className="w-full mt-3 py-3.5 px-4 rounded-2xl bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.99] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none cursor-pointer"
                >
                  {busy ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>در حال بررسی اعتبار…</span>
                    </>
                  ) : (
                    <>
                      <LogIn size={18} />
                      <span>ورود به داشبورد مدیریتی</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Bottom Security Note */}
            <div className="mt-8 pt-4 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs text-[#86868B] dark:text-[#98989D]">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#0071E3]" />
                <span>دسترسی محافظت‌شده و رمزنگاری‌شده</span>
              </div>
              <span className="text-[11px] font-semibold">سال مالی ۱۴۰۵</span>
            </div>
          </div>

          {/* ── Left Side: Executive Showcase Bento Pane (7 Cols) ───── */}
          <div className="order-1 lg:order-2 lg:col-span-7 relative p-7 sm:p-10 lg:p-12 flex flex-col justify-between text-white overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#090D1A]">
            {/* Ambient Internal Glows */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#0071E3]/25 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#F59E0B]/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#10B981]/15 rounded-full blur-3xl pointer-events-none" />

            {/* Top Showcase Header */}
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
                <span className="text-xs font-bold text-white/90">سامانه جامع نبض فروش</span>
              </div>
              <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-semibold text-white/80 backdrop-blur-md">
                کوپا گستر طلایی
              </span>
            </div>

            {/* 3 Modular Pillars Cards */}
            <div className="relative z-10 my-6 sm:my-8 space-y-3">
              <p className="text-xs font-semibold text-white/60 tracking-wider mb-2">
                ماژول‌های سه‌گانه تصمیم‌گیری هوشمند:
              </p>

              <div className="grid grid-cols-1 gap-2.5">
                {PILLARS.map((pillar) => {
                  const Icon = pillar.icon
                  return (
                    <motion.div
                      key={pillar.id}
                      whileHover={{ x: -4 }}
                      transition={{ duration: 0.2 }}
                      className={`rounded-2xl p-3.5 sm:p-4 bg-gradient-to-r ${pillar.bg} border ${pillar.border} backdrop-blur-xl transition-all shadow-sm flex items-center gap-3.5 group`}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md"
                        style={{ backgroundColor: `${pillar.color}25`, color: pillar.color }}
                      >
                        <Icon size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-extrabold text-xs sm:text-sm text-white">
                            {pillar.title}
                          </h3>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                            style={{
                              color: pillar.color,
                              backgroundColor: `${pillar.color}15`,
                              borderColor: `${pillar.color}35`,
                            }}
                          >
                            {pillar.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/70 mt-1 truncate">
                          {pillar.desc}
                        </p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* Bottom Showcase Footer */}
            <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-white/70">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-amber-400" />
                <span>طراحی یکپارچه بر پایه سیستم اپل هایبرید گلس</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <CheckCircle2 size={14} />
                <span>تطابق کامل محاسبات</span>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* ── Footer Copyright ────────────────────────────────────────── */}
      <footer className="w-full text-center py-2 z-20">
        <p className="text-xs text-[#86868B] dark:text-[#98989D] font-medium">
          © ۱۴۰۵ شرکت کوپا گستر طلایی · تمامی حقوق محفوظ است
        </p>
      </footer>
    </div>
  )
}

import { useState } from 'react'
import { motion } from 'motion/react'
import { Activity, AlertCircle, Building2, Eye, EyeOff, LockKeyhole, LogIn, ShieldCheck, TrendingUp, UserRound } from 'lucide-react'
import { login } from './api'

const FEATURES = [
  [Activity, 'روند فروش روزانه و ماهانه'],
  [Building2, 'عملکرد شعبه‌ها و ویزیتورها'],
  [TrendingUp, 'تحلیل رشد، افت و پارتو'],
]

export default function LoginPage({ onSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    const failure = await login(username.trim(), password)
    setBusy(false)
    if (failure) { setError(failure); setPassword(''); return }
    onSuccess()
  }

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center p-4 sm:p-8 bg-[#F5F5F7] relative overflow-hidden font-sans antialiased selection:bg-[#0071E3]/20">
      {/* ── Ambient macOS Blurred Mesh Orbs ─────────────────── */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-blue-500/30 to-indigo-600/20 blur-[130px] pointer-events-none -z-0" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[560px] h-[560px] rounded-full bg-gradient-to-tr from-cyan-400/20 to-blue-600/25 blur-[140px] pointer-events-none -z-0" />
      <div className="absolute top-[35%] left-[15%] w-[320px] h-[320px] rounded-full bg-indigo-400/10 blur-[110px] pointer-events-none -z-0" />

      {/* ── Main Login Card (Side-by-Side Split Layout) ─────── */}
      <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full flex flex-col md:flex-row overflow-hidden bg-white/70 backdrop-blur-3xl border border-white/50 shadow-2xl rounded-[36px] relative z-10"
        >
          {/* ── Form Section (Half Width) ───────────────────────── */}
          <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white/50 backdrop-blur-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#0071E3]/10 text-[#0071E3] w-fit mb-3">
              <ShieldCheck size={14} />
              <span>ورود امن به سامانه</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1D1D1F]">
              خوش آمدید
            </h1>
            <p className="text-xs sm:text-sm text-[#86868B] mt-1 mb-7">
              برای مشاهدهٔ گزارش‌ها وارد حساب خود شوید
            </p>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1D1D1F] mb-1.5">
                  نام کاربری
                </label>
                <div className="relative flex items-center">
                  <span className="absolute right-3.5 text-[#86868B] pointer-events-none">
                    <UserRound size={18} />
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    dir="ltr"
                    placeholder="نام کاربری"
                    className="w-full bg-black/[0.03] border border-black/[0.04] focus:bg-white focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/20 rounded-2xl pr-11 pl-4 py-3 text-sm text-[#1D1D1F] placeholder:text-[#86868B]/50 transition-all outline-none font-medium text-left"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1D1D1F] mb-1.5">
                  رمز عبور
                </label>
                <div className="relative flex items-center">
                  <span className="absolute right-3.5 text-[#86868B] pointer-events-none">
                    <LockKeyhole size={18} />
                  </span>
                  <input
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    dir="ltr"
                    placeholder="••••••••"
                    className="w-full bg-black/[0.03] border border-black/[0.04] focus:bg-white focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/20 rounded-2xl pr-11 pl-11 py-3 text-sm text-[#1D1D1F] placeholder:text-[#86868B]/50 transition-all outline-none font-medium text-left"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute left-3.5 text-[#86868B] hover:text-[#1D1D1F] transition-colors p-1 rounded-lg"
                    aria-label={show ? 'پنهان کردن رمز' : 'نمایش رمز'}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-700 flex items-center gap-2"
                  role="alert"
                >
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              <button
                type="submit"
                disabled={busy || !username || !password}
                className="w-full mt-2 py-3.5 rounded-2xl bg-[#0071E3] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 hover:bg-[#0077ED] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/35 active:translate-y-0 transition-all disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none cursor-pointer"
              >
                <LogIn size={18} />
                <span>{busy ? 'در حال ورود به سامانه…' : 'ورود به داشبورد'}</span>
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-black/[0.05] flex items-center justify-center gap-1.5 text-xs text-[#86868B]">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>دسترسی محافظت‌شده ویژهٔ کاربران مجاز</span>
            </div>
          </div>

          {/* ── Branding & Features Section (Half Width) ─────────── */}
          <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-between bg-gradient-to-br from-[#0A1128] via-[#102542] to-[#1D3557] text-white relative overflow-hidden">
            {/* Ambient glows inside dark panel */}
            <div className="absolute top-0 right-0 w-60 h-60 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              {/* Logo */}
              <div className="w-14 h-14 rounded-2xl bg-white p-2 shadow-xl shadow-black/30 overflow-hidden flex items-center justify-center border border-white/20">
                <img src="/login-logo.jpg" alt="شرکت کوپا گستر طلایی" className="w-full h-full object-contain" />
              </div>

              <div className="mt-4">
                <h2 className="text-2xl font-extrabold tracking-tight text-white">نبض فروش</h2>
                <p className="text-xs text-white/60 mt-1 font-medium">سامانه هوشمند پایش و تحلیل فروش</p>
              </div>

              {/* Compact Feature Badges */}
              <div className="flex flex-col gap-3 my-7">
                {FEATURES.map(([Icon, text]) => (
                  <div
                    key={text}
                    className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 w-fit hover:bg-white/10 transition-colors shadow-sm"
                  >
                    <div className="w-7 h-7 rounded-xl bg-[#0071E3]/30 border border-[#0071E3]/40 flex items-center justify-center text-[#38BDF8] shrink-0">
                      <Icon size={15} />
                    </div>
                    <span className="text-xs font-semibold text-white/90">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Glowing Analytics Sparkline */}
            <div className="pt-4 border-t border-white/10 relative z-10">
              <div className="flex items-center justify-between text-[11px] text-white/50 mb-2">
                <span>شرکت <b className="text-white/80 font-bold">کوپا گستر طلایی</b></span>
                <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white/70 text-[10px] font-medium">سال مالی ۱۴۰۵</span>
              </div>

              <div className="h-12 w-full relative" aria-hidden="true">
                <svg viewBox="0 0 400 70" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="appleSparkline" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.2" />
                      <stop offset="50%" stopColor="#0071E3" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#34C759" />
                    </linearGradient>
                    <filter id="appleSparkGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>
                  <path
                    d="M0 54 Q40 52 80 48 T160 42 T240 22 T320 30 T390 14 L400 14"
                    fill="none"
                    stroke="url(#appleSparkline)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    filter="url(#appleSparkGlow)"
                  />
                  <circle cx="400" cy="14" r="4.5" fill="#34C759" className="animate-pulse" />
                </svg>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Footer Copyright ─────────────────────────────────── */}
        <p className="text-xs text-[#86868B] mt-5 text-center z-10 font-medium">
          © ۱۴۰۵ <bdi dir="ltr">M.Kharaji</bdi> · تمامی حقوق محفوظ است
        </p>
      </div>
    </div>
  )
}

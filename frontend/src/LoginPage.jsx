import { useState } from 'react'
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
    <div className="login-root" dir="rtl">
      <main className="login-shell">
        <aside className="login-brand">
          <span className="login-logo"><img src="/login-logo.jpg" alt="شرکت کوپا گستر طلایی" /></span>
          <div>
            <h2>نبض فروش</h2>
            <p>داشبورد مدیریتی فروش</p>
          </div>
          <span className="login-rule" />
          <ul>
            {FEATURES.map(([Icon, text]) => <li key={text}><span><Icon size={17} /></span>{text}</li>)}
          </ul>
          <div className="login-pulse" aria-hidden="true">
            <svg viewBox="0 0 400 70" preserveAspectRatio="none">
              <defs>
                <linearGradient id="login-pulse-line" x1="0" x2="1">
                  <stop offset="0" stopColor="#60a5fa" stopOpacity=".15" />
                  <stop offset=".6" stopColor="#93c5fd" stopOpacity=".7" />
                  <stop offset="1" stopColor="#e4a53a" />
                </linearGradient>
              </defs>
              <path d="M0 52 L60 50 L95 50 L115 28 L135 60 L155 44 L210 44 L240 40 L262 14 L284 56 L304 36 L360 34 L400 26" fill="none" stroke="url(#login-pulse-line)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx="400" cy="26" r="4" fill="#e4a53a" />
            </svg>
          </div>
          <div className="login-brand-foot"><span>شرکت <b>کوپا گستر طلایی</b></span><span>سال مالی ۱۴۰۵</span></div>
        </aside>

        <form className="login-card" onSubmit={submit}>
          <span className="login-badge"><ShieldCheck size={14} />ورود امن</span>
          <h1>خوش آمدید</h1>
          <p>برای مشاهدهٔ گزارش‌ها وارد حساب خود شوید</p>

          <label className="login-field">
            <span>نام کاربری</span>
            <div>
              <UserRound size={18} />
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} dir="ltr" autoFocus required />
            </div>
          </label>

          <label className="login-field">
            <span>رمز عبور</span>
            <div>
              <LockKeyhole size={18} />
              <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" dir="ltr" required />
              <button type="button" className="login-eye" onClick={() => setShow((v) => !v)} aria-label={show ? 'پنهان کردن رمز' : 'نمایش رمز'}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {error && <div className="login-error" role="alert"><AlertCircle size={16} />{error}</div>}

          <button type="submit" className="login-submit" disabled={busy || !username || !password}>
            <LogIn size={18} /><span>{busy ? 'در حال ورود…' : 'ورود به داشبورد'}</span>
          </button>

          <div className="login-foot"><ShieldCheck size={15} />دسترسی فقط برای کاربران مجاز</div>
        </form>
      </main>
      <p className="login-copyright">© ۱۴۰۵ <bdi dir="ltr">M.Kharaji</bdi> · تمامی حقوق محفوظ است</p>
    </div>
  )
}

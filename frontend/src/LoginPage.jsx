import { useState } from 'react'
import { Activity, Building2, Eye, EyeOff, LockKeyhole, LogIn, ShieldCheck, TrendingUp, UserRound } from 'lucide-react'
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
      <i className="login-blob b1" /><i className="login-blob b2" /><i className="login-blob b3" />
      <div className="login-shell">
        <aside className="login-brand">
          <span className="login-logo"><img src="/login-logo.jpg" alt="شرکت کوپا گستر طلایی" /></span>
          <h2>نبض فروش</h2>
          <p>داشبورد مدیریتی فروش</p>
          <ul>
            {FEATURES.map(([Icon, text]) => <li key={text}><span><Icon size={16} /></span>{text}</li>)}
          </ul>
        </aside>

        <form className="login-card" onSubmit={submit}>
          <span className="login-badge"><ShieldCheck size={14} />ورود امن</span>
          <h1>خوش آمدید</h1>
          <p>برای مشاهدهٔ گزارش‌ها وارد حساب خود شوید</p>

          <label className="login-field">
            <span>نام کاربری</span>
            <div>
              <UserRound size={17} />
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} dir="ltr" autoFocus required />
            </div>
          </label>

          <label className="login-field">
            <span>رمز عبور</span>
            <div>
              <LockKeyhole size={17} />
              <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" dir="ltr" required />
              <button type="button" className="login-eye" onClick={() => setShow((v) => !v)} aria-label={show ? 'پنهان کردن رمز' : 'نمایش رمز'}>
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>

          {error && <div className="login-error" role="alert">{error}</div>}

          <button type="submit" className="login-submit" disabled={busy || !username || !password}>
            <LogIn size={17} /><span>{busy ? 'در حال ورود…' : 'ورود به داشبورد'}</span>
          </button>
        </form>
      </div>
    </div>
  )
}

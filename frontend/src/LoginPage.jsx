import { useState } from 'react'
import { Eye, EyeOff, LockKeyhole, LogIn, UserRound } from 'lucide-react'
import { login } from './api'

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
      <form className="login-card" onSubmit={submit}>
        <span className="login-logo"><img src="/logo.jpg" alt="لوگوی کوپا گستر" /></span>
        <h1>نبض فروش</h1>
        <p>برای مشاهدهٔ گزارش‌ها وارد شوید</p>

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
          <LogIn size={17} /><span>{busy ? 'در حال ورود…' : 'ورود'}</span>
        </button>
      </form>
    </div>
  )
}

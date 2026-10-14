import React, { useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/vazirmatn/400.css'
import '@fontsource/vazirmatn/500.css'
import '@fontsource/vazirmatn/700.css'
import '@fontsource/vazirmatn/800.css'
import './styles.css'
import App from './App.jsx'
import LoginPage from './LoginPage.jsx'
import { UNAUTHORIZED, logout } from './api'

function Gate() {
  const [state, setState] = useState('checking')
  const [session, setSession] = useState(0)

  useEffect(() => {
    fetch('/api/auth/me').then((r) => setState(r.ok ? 'in' : 'out')).catch(() => setState('out'))
    const out = () => setState('out')
    window.addEventListener(UNAUTHORIZED, out)
    return () => window.removeEventListener(UNAUTHORIZED, out)
  }, [])

  const signOut = useCallback(async () => {
    await logout()
    history.replaceState(null, '', location.pathname)
    setState('out')
  }, [])

  if (state === 'checking') return null
  if (state === 'out') return <LoginPage onSuccess={() => { setSession((n) => n + 1); setState('in') }} />
  return <App key={session} onLogout={signOut} />
}

createRoot(document.getElementById('root')).render(<Gate />)

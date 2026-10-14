import { useEffect, useState } from 'react'

export const UNAUTHORIZED = 'sr-unauthorized'
const reject = (res) => {
  if (res.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED))
  throw new Error(`${res.status}`)
}

export async function get(path, params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString()
  const res = await fetch(`/api${path}${qs ? `?${qs}` : ''}`)
  if (!res.ok) reject(res)
  return res.json()
}

export async function post(path) {
  const res = await fetch(`/api${path}`, { method: 'POST' })
  if (!res.ok && res.status !== 409) reject(res)
  return res.status
}

export async function login(username, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }),
  })
  if (res.ok) return null
  const body = await res.json().catch(() => ({}))
  return typeof body.detail === 'string' ? body.detail : 'ورود ناموفق بود'
}

export const logout = () => fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})

export function useApi(path, params, enabled = true) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const key = path + JSON.stringify(params)
  useEffect(() => {
    if (!enabled) return undefined
    let live = true
    setState((s) => ({ ...s, loading: true }))
    get(path, params)
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((e) => live && setState({ data: null, error: e.message, loading: false }))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])
  return state
}

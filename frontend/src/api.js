import { useEffect, useState } from 'react'

export const UNAUTHORIZED = 'sr-unauthorized'
const detailOf = (d) => (typeof d === 'string' ? d : Array.isArray(d) ? d.map((x) => x.msg).filter(Boolean).join('، ') : '')
const reject = async (res) => {
  if (res.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED))
  const data = await res.json().catch(() => ({}))
  throw Object.assign(new Error(detailOf(data.detail) || `${res.status}`), { status: res.status })
}

export async function get(path, params = {}) {
  // array values become repeated query parameters (?visitor=a&visitor=b)
  const pairs = Object.entries(params).filter(([, v]) => v !== '' && v != null).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : [[k, v]]))
  const qs = new URLSearchParams(pairs).toString()
  const res = await fetch(`/api${path}${qs ? `?${qs}` : ''}`)
  if (!res.ok) await reject(res)
  return res.json()
}

// JSON mutation (POST/PATCH/DELETE). Errors keep the backend `detail` text as the message; 401 signs the user out like get().
export async function send(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    ...(body !== undefined && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  })
  if (res.ok) return res.json().catch(() => ({}))
  return reject(res)
}

export async function post(path) {
  const res = await fetch(`/api${path}`, { method: 'POST' })
  if (!res.ok && res.status !== 409) await reject(res)
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

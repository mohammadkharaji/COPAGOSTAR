import { useEffect, useState } from 'react'

export async function get(path, params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString()
  const res = await fetch(`/api${path}${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export async function post(path) {
  const res = await fetch(`/api${path}`, { method: 'POST' })
  if (!res.ok && res.status !== 409) throw new Error(`${res.status}`)
  return res.status
}

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

// AI agent panel — OPTIONAL and REMOVABLE (see backend/app/agent/README.txt). Self-contained: own fetch, own styling.
// Renders nothing unless the backend reports the agent enabled (GET /api/agent/status), so it is inert when the feature is off.
import { useEffect, useRef, useState } from 'react'
import { Bot, Send, X } from 'lucide-react'
import { UNAUTHORIZED } from '../api'

const call = async (path, body) => {
  const res = await fetch(`/api/agent${path}`, body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : undefined)
  if (res.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED))
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'خطا در دستیار هوشمند')
  return data
}

export default function AgentPanel() {
  const [status, setStatus] = useState(null)
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef(null)
  useEffect(() => { call('/status').then(setStatus).catch(() => setStatus(null)) }, [])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs, busy, open])
  if (!status?.enabled) return null

  const send = async (e) => {
    e.preventDefault()
    const question = text.trim()
    if (!question || busy) return
    const history = msgs.filter((m) => !m.error).map(({ role, content }) => ({ role, content }))
    setMsgs((m) => [...m, { role: 'user', content: question }])
    setText('')
    setBusy(true)
    try {
      const r = await call('/ask', { question, history })
      setMsgs((m) => [...m, { role: 'assistant', content: r.answer, date: r.freshness?.last_data_date }])
    } catch (err) {
      setMsgs((m) => [...m, { role: 'assistant', content: err.message, error: true }])
    } finally { setBusy(false) }
  }

  return (
    <div dir="rtl" className="fixed bottom-4 left-4 z-50">
      {open ? (
        <div className="flex h-[32rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-sm text-white">
            <span className="flex items-center gap-2"><Bot size={16} /> دستیار گزارش‌گیری</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="بستن"><X size={16} /></button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
            {!status.configured && <p className="text-amber-700">دستیار هنوز پیکربندی نشده است.</p>}
            {!msgs.length && status.configured && <p className="text-slate-500">درباره‌ی فروش بپرسید؛ پاسخ‌ها فقط از داده‌ی داشبورد و فقط‌خواندنی است.</p>}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'text-left' : ''}>
                <div className={`inline-block max-w-full whitespace-pre-wrap rounded-xl px-3 py-2 text-right leading-7 ${m.role === 'user' ? 'bg-slate-100' : m.error ? 'bg-red-50 text-red-700' : 'bg-sky-50'}`}>{m.content}</div>
                {m.date && <div className="mt-1 text-xs text-slate-400">آخرین داده: {m.date}</div>}
              </div>
            ))}
            {busy && <p className="text-slate-400">در حال بررسی…</p>}
            <div ref={end} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-slate-200 p-2">
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} disabled={!status.configured}
              placeholder="پرسش خود را بنویسید" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500" />
            <button type="submit" disabled={busy || !text.trim() || !status.configured} aria-label="ارسال"
              className="rounded-lg bg-slate-900 px-3 text-white disabled:opacity-40"><Send size={16} className="rotate-180" /></button>
          </form>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} aria-label="دستیار هوشمند"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg"><Bot size={22} /></button>
      )}
    </div>
  )
}

// AI agent panel — OPTIONAL and REMOVABLE (see backend/app/agent/README.txt). Self-contained: own fetch, own styling.
// Renders nothing unless the backend reports the agent enabled (GET /api/agent/status), so it is inert when the feature is off.
import { useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, Send, Sparkles, X } from 'lucide-react'
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
  const [full, setFull] = useState(false)
  const end = useRef(null)
  useEffect(() => { call('/status').then(setStatus).catch(() => setStatus(null)) }, [])
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs, busy, open])
  useEffect(() => {
    if (!full) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setFull(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [full])
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
    <div dir="rtl" className={open && full ? 'fixed inset-0 z-50' : 'fixed bottom-4 left-4 z-50'}>
      {open ? (
        <div className={`flex flex-col overflow-hidden border border-slate-200 bg-white shadow-2xl ${full ? 'h-full w-full' : 'h-[32rem] w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl'}`}>
          <div className="flex items-center justify-between bg-gradient-to-l from-blue-700 via-indigo-600 to-violet-600 px-4 py-3 text-sm text-white">
            <span className="flex items-center gap-2 font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20"><Sparkles size={15} /></span>
              دستیار گزارش‌گیری
            </span>
            <span className="flex items-center gap-1">
              <button type="button" onClick={() => setFull((f) => !f)} aria-label={full ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'} title={full ? 'خروج از تمام‌صفحه (Esc)' : 'تمام‌صفحه'}
                className="rounded-lg p-1.5 hover:bg-white/20">{full ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
              <button type="button" onClick={() => { setOpen(false); setFull(false) }} aria-label="بستن" className="rounded-lg p-1.5 hover:bg-white/20"><X size={16} /></button>
            </span>
          </div>
          <div className={`flex-1 overflow-y-auto bg-slate-50/60 p-3 text-sm ${full ? 'mx-auto w-full max-w-4xl space-y-4 p-6 text-base' : 'space-y-3'}`}>
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
          <form onSubmit={send} className={`flex gap-2 border-t border-slate-200 bg-white p-2 ${full ? 'mx-auto w-full max-w-4xl p-4' : ''}`}>
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} disabled={!status.configured}
              placeholder="پرسش خود را بنویسید" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
            <button type="submit" disabled={busy || !text.trim() || !status.configured} aria-label="ارسال"
              className="rounded-lg bg-gradient-to-l from-blue-600 to-indigo-600 px-3 text-white disabled:opacity-40"><Send size={16} className="rotate-180" /></button>
          </form>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} aria-label="دستیار هوشمند" title="دستیار هوشمند"
          className="group relative flex h-12 items-center gap-2 rounded-full bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-600 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 ring-2 ring-white/70 transition hover:scale-105 hover:shadow-xl hover:shadow-indigo-500/50">
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-indigo-400/30" />
          <Sparkles size={20} className="transition group-hover:rotate-12" />
          <span>دستیار هوشمند</span>
        </button>
      )}
    </div>
  )
}

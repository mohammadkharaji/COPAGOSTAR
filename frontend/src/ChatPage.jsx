import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Database, Eraser, Loader2, Sparkles, TriangleAlert } from 'lucide-react'
import { postJson } from './api'

// Starter questions: short on purpose, so they read as suggestions rather than documentation.
const SAMPLES = [
  'خلاصه فروش کل چقدر است؟',
  'چند مشتری فعال داریم؟',
  'فروش این ماه را با ماه قبل مقایسه کن',
]

function Bubble({ role, text }) {
  return (
    <li className={`chat-msg ${role}`}>
      {role === 'assistant' && <span className="chat-avatar" aria-hidden="true"><Sparkles size={15} /></span>}
      <div className="chat-body">
        <p>{text}</p>
      </div>
    </li>
  )
}

export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const scroller = useRef(null)
  const input = useRef(null)

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, busy])

  const ask = async (text) => {
    const q = text.trim()
    if (!q || busy) return
    setError('')
    setQuestion('')
    setMessages((m) => [...m, { role: 'user', text: q }])
    setBusy(true)
    try {
      const res = await postJson('/chat', { question: q })
      setMessages((m) => [...m, {
        role: 'assistant', text: res.answer, usedDb: res.used_db, usedMemory: res.used_memory,
      }])
    } catch (ex) {
      setError(ex?.message || 'پاسخ گرفتن ممکن نشد.')
    } finally {
      setBusy(false)
      input.current?.focus()
    }
  }

  const onSubmit = (e) => {
    e.preventDefault()
    ask(question)
  }

  // Enter sends, Shift+Enter adds a line — the usual chat habit.
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      ask(question)
    }
  }

  const empty = messages.length === 0 && !busy

  return (
    <div className="chat">
      <div className="chat-head">
        <div>
          <b>دستیار تحلیل فروش</b>
          <small>پاسخ‌ها بر پایهٔ دادهٔ همین حساب ساخته می‌شوند؛ فقط شعب و هسته‌های مجاز شما خوانده می‌شود.</small>
        </div>
        {messages.length > 0 && (
          <button type="button" className="chat-clear" onClick={() => { setMessages([]); setError('') }}>
            <Eraser size={15} /> گفتگوی جدید
          </button>
        )}
      </div>

      <div className="chat-scroll" ref={scroller} aria-live="polite">
        {empty && (
          <div className="chat-empty">
            <span className="chat-empty-icon" aria-hidden="true"><Sparkles size={22} /></span>
            <p>هر سؤالی دربارهٔ فروش بپرسید. اگر پاسخ در حافظهٔ دستیار نباشد، خودش داده را می‌خواند.</p>
            <div className="chat-samples">
              {SAMPLES.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <ul className="chat-list">
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} text={m.text} />
            ))}
          </ul>
        )}

        {busy && (
          <div className="chat-msg assistant">
            <span className="chat-avatar" aria-hidden="true"><Sparkles size={15} /></span>
            <div className="chat-body chat-typing"><Loader2 size={15} className="spin" /> در حال تحلیل…</div>
          </div>
        )}
      </div>

      {error && (
        <p className="chat-error" role="alert"><TriangleAlert size={15} /> {error}</p>
      )}

      <form className="chat-compose" onSubmit={onSubmit}>
        <textarea
          ref={input}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="مثلاً: فروش شعبه تهران در مهر چقدر بود؟"
          rows={1}
          maxLength={2000}
          disabled={busy}
          aria-label="سؤال شما"
        />
        <button type="submit" disabled={busy || !question.trim()} aria-label="ارسال سؤال">
          <ArrowUp size={18} />
        </button>
      </form>
      <p className="chat-hint">
        <Database size={13} /> هر پاسخ از دادهٔ زندهٔ داشبورد خوانده می‌شود · Enter ارسال، Shift+Enter خط جدید
      </p>
    </div>
  )
}
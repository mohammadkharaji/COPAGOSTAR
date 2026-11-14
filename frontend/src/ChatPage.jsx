import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Database, Eraser, Loader2, Sparkles, TriangleAlert } from 'lucide-react'
import { motion } from 'motion/react'
import { postJson } from './api'

// Starter questions: short on purpose, so they read as suggestions rather than documentation.
const SAMPLES = [
  'خلاصه فروش کل چقدر است؟',
  'چند مشتری فعال داریم؟',
  'فروش این ماه را با ماه قبل مقایسه کن',
]

function Bubble({ role, text }) {
  const isUser = role === 'user'
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex items-start gap-3 w-full ${isUser ? 'justify-start flex-row-reverse' : 'justify-start'}`}
    >
      {!isUser && (
        <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#0071E3] to-[#42A1EC] text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/25" aria-hidden="true">
          <Sparkles size={16} />
        </span>
      )}
      <div
        className={`px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-[80%] text-right ${
          isUser
            ? 'bg-[#0071E3] text-white rounded-br-sm shadow-sm shadow-blue-500/20'
            : 'bg-[#F5F5F7] border border-black/[0.04] text-[#1D1D1F] rounded-bl-sm'
        }`}
      >
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    </motion.li>
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
    <div className="w-full max-w-[1600px] mx-auto px-6">
      <div className="bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[28px] p-6 max-w-4xl mx-auto flex flex-col h-[calc(100vh-200px)] min-h-[580px]">
        {/* Apple Header */}
        <div className="flex items-center justify-between pb-4 border-b border-black/[0.05] shrink-0 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0071E3] to-[#42A1EC] text-white flex items-center justify-center shadow-sm shadow-blue-500/30">
              <Sparkles size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#1D1D1F]">دستیار هوشمند تحلیل فروش</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#0071E3]/10 text-[#0071E3]">
                  هوش مصنوعی
                </span>
              </div>
              <p className="text-xs text-[#86868B] mt-0.5">پاسخ‌ها بر پایهٔ داده‌های امن شعب و هسته‌های مجاز حساب شما خوانده می‌شوند.</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-black/[0.04] hover:bg-black/[0.08] text-[#1D1D1F] transition-colors"
              onClick={() => { setMessages([]); setError('') }}
            >
              <Eraser size={14} />
              <span>گفتگوی جدید</span>
            </button>
          )}
        </div>

        {/* Chat message scroll area */}
        <div className="flex-1 overflow-y-auto py-5 space-y-4 px-2" ref={scroller} aria-live="polite">
          {empty && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4 py-8">
              <span className="w-14 h-14 rounded-3xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center shadow-inner">
                <Sparkles size={28} />
              </span>
              <div>
                <h3 className="text-base font-bold text-[#1D1D1F]">پرسش درباره داده‌های فروش</h3>
                <p className="text-xs text-[#86868B] mt-1 leading-relaxed">
                  هر سؤالی دربارهٔ فروش، شعب، کالاها و روندها بپرسید تا با تحلیل داده پاسخ شما ارائه شود.
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full pt-2">
                <span className="text-[11px] text-[#86868B] font-semibold text-right">نمونه سؤالات پیشنهادی:</span>
                {SAMPLES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => ask(s)}
                    className="text-right px-4 py-2.5 rounded-xl text-xs font-medium bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] border border-black/[0.04] transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.length > 0 && (
            <ul className="space-y-4">
              {messages.map((m, i) => (
                <Bubble key={i} role={m.role} text={m.text} />
              ))}
            </ul>
          )}

          {busy && (
            <div className="flex items-start gap-3 w-full">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#0071E3] to-[#42A1EC] text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/25">
                <Sparkles size={16} />
              </span>
              <div className="px-4 py-3 rounded-2xl bg-[#F5F5F7] border border-black/[0.04] text-[#86868B] text-sm flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-[#0071E3]" />
                <span>در حال تحلیل داده‌های فروش…</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 mb-3 shrink-0" role="alert">
            <TriangleAlert size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Compose area */}
        <div className="shrink-0 pt-3 border-t border-black/[0.05]">
          <form className="relative bg-[#F5F5F7] border border-black/[0.06] rounded-2xl p-2 flex items-center gap-2 focus-within:ring-2 focus-within:ring-[#0071E3]/25 focus-within:border-[#0071E3] transition-all" onSubmit={onSubmit}>
            <textarea
              ref={input}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="سؤال خود را بنویسید (مثلاً: فروش شعبه تهران در مهر چقدر بود؟)..."
              rows={1}
              maxLength={2000}
              disabled={busy}
              aria-label="سؤال شما"
              className="w-full bg-transparent border-none text-sm text-[#1D1D1F] placeholder-[#86868B] px-3 py-1.5 focus:outline-none resize-none"
            />
            <button
              type="submit"
              disabled={busy || !question.trim()}
              aria-label="ارسال سؤال"
              className="w-9 h-9 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] disabled:opacity-40 text-white flex items-center justify-center transition-all shrink-0 active:scale-95 shadow-sm shadow-blue-500/25"
            >
              <ArrowUp size={18} />
            </button>
          </form>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#86868B] mt-2.5">
            <Database size={12} />
            <span>هر پاسخ از داده‌های زنده داشبورد خوانده می‌شود · Enter ارسال، Shift+Enter خط جدید</span>
          </p>
        </div>
      </div>
    </div>
  )
}

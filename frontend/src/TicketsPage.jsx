import { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { postJson, useApi } from './api'
import { useAppearance } from './AppearanceContext'
import { fa } from './format'
import { AppleCard } from './ui'

export function TicketsPage({ isAdmin }) {
  const { isDark } = useAppearance()
  const [openId, setOpenId] = useState(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [reply, setReply] = useState('')
  const [err, setErr] = useState('')
  const [tick, setTick] = useState(0)
  const list = useApi('/tickets', { v: tick })
  const one = useApi(openId ? `/tickets/${openId}` : null, { v: tick })
  const refresh = () => setTick((n) => n + 1)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 20000)
    return () => clearInterval(t)
  }, [])
  const setStatus = async (action) => {
    setErr('')
    try {
      await postJson(`/tickets/${openId}/status`, { action })
      refresh()
    } catch (ex) { setErr(ex?.message || 'تغییر وضعیت انجام نشد') }
  }
  const send = async (e) => {
    e.preventDefault()
    setErr('')
    try {
      await postJson('/tickets', { subject: subject.trim(), body: body.trim() })
      setSubject(''); setBody(''); refresh()
    } catch (ex) { setErr(ex?.message || 'ثبت تیکت انجام نشد') }
  }
  const sendReply = async (e) => {
    e.preventDefault()
    setErr('')
    try {
      await postJson(`/tickets/${openId}/messages`, { body: reply.trim() })
      setReply(''); refresh()
    } catch (ex) { setErr(ex?.message || 'ارسال پاسخ انجام نشد') }
  }
  const statusLabel = { open: 'باز', answered: 'پاسخ داده شده', closed: 'بسته' }
  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5">
      {err && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 px-5 py-3 text-sm flex items-center justify-between">
          <span>{err}</span>
          <button type="button" onClick={() => setErr('')} className="text-xs font-semibold hover:underline">بستن</button>
        </div>
      )}

      {/* New Ticket Form (User view) */}
      {!isAdmin && (
        <AppleCard
          title="ثبت تیکت جدید"
          subtitle="پیام و درخواست پشتیبانی شما برای مدیر سامانه ارسال می‌شود"
          badge="پشتیبانی"
        >
          <form className="space-y-4" onSubmit={send}>
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>موضوع تیکت</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="عنوان مشکل یا پرسش خود را بنویسید..."
                minLength={3}
                maxLength={120}
                required
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none transition-all ${
                  isDark
                    ? 'bg-black/30 border-emerald-500/20 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50'
                    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-600'
                }`}
              />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>شرح درخواست یا مشکل</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="توضیحات کامل درخواست خود را بنویسید..."
                maxLength={4000}
                rows={4}
                required
                className={`w-full border rounded-xl p-4 text-sm focus:outline-none transition-all resize-y ${
                  isDark
                    ? 'bg-black/30 border-emerald-500/20 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50'
                    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-600'
                }`}
              />
            </div>
            <div className="flex justify-start">
              <button
                type="submit"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-xs active:scale-[0.98] transition-all"
              >
                <Send size={15} />
                <span>ثبت تیکت</span>
              </button>
            </div>
          </form>
        </AppleCard>
      )}

      {/* Bento Grid: Master-Detail Tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start w-full">
        {/* Ticket List */}
        <div className={`${openId ? 'lg:col-span-5' : 'lg:col-span-12'} w-full`}>
          <AppleCard
            title={isAdmin ? 'همه تیکت‌ها' : 'تیکت‌های من'}
            subtitle="فهرست تیکت‌های پشتیبانی"
            badge={list.data ? `${fa(list.data.tickets.length)} تیکت` : 'در حال بارگذاری'}
          >
            {!list.data && !list.error && <p className={`text-sm py-6 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>در حال بارگذاری…</p>}
            {list.data && list.data.tickets.length === 0 && (
              <p className={`text-sm py-8 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>تیکتی ثبت نشده است.</p>
            )}
            {list.data && list.data.tickets.length > 0 && (
              <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                {list.data.tickets.map((t) => {
                  const active = openId === t.id
                  return (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setOpenId(t.id)}
                      className={`w-full text-right p-4 rounded-xl border transition-all flex flex-col gap-2 ${
                        active
                          ? isDark
                            ? 'bg-emerald-500/15 border-emerald-500/30 shadow-xs'
                            : 'bg-emerald-50 border-emerald-300 shadow-xs'
                          : isDark
                          ? 'bg-black/25 hover:bg-black/40 border-white/5 hover:border-white/10'
                          : 'bg-white/60 hover:bg-white border-slate-200/80 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-bold text-sm truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t.subject}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
                          t.status === 'open'
                            ? isDark ? 'bg-sky-500/15 text-sky-400 border border-sky-500/25' : 'bg-sky-50 text-sky-700'
                            : t.status === 'answered'
                            ? isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-emerald-50 text-emerald-700'
                            : isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {statusLabel[t.status] ?? t.status}
                        </span>
                      </div>
                      <div className={`flex items-center justify-between text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        <span>{isAdmin ? `${t.owner ?? ''} · ` : ''}{t.updated_at?.slice(0, 16).replace('T', ' ')}</span>
                        {active && <span className="text-emerald-500 font-medium text-[11px]">انتخاب‌شده</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </AppleCard>
        </div>

        {/* Selected Ticket Conversation Thread */}
        {openId && one.data && (
          <div className="lg:col-span-7 w-full">
            <AppleCard
              title={`تیکت: ${one.data.subject}`}
              subtitle={isAdmin ? `مالک: ${one.data.owner ?? ''}` : 'گفت‌وگو با پشتیبانی'}
              badge={statusLabel[one.data.status] ?? one.data.status}
              action={
                isAdmin && (
                  <div className="flex items-center gap-2">
                    {one.data.status === 'closed' ? (
                      <button
                        type="button"
                        onClick={() => setStatus('reopen')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                          isDark ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        باز کردن تیکت
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setStatus('close')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                          isDark ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        بستن تیکت
                      </button>
                    )}
                  </div>
                )
              }
            >
              {isAdmin && (
                <div className={`mb-4 text-xs px-3.5 py-2 rounded-xl border ${
                  isDark ? 'bg-black/30 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  تیکت‌های بسته‌شده پس از ۷ روز از سرور حذف می‌شوند.
                </div>
              )}

              {/* Message thread */}
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 mb-5">
                {one.data.messages.map((m, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-xl border text-right space-y-1.5 ${
                      m.is_admin
                        ? isDark ? 'bg-emerald-500/10 border-emerald-500/20 mr-4' : 'bg-emerald-50/80 border-emerald-200 mr-4'
                        : isDark ? 'bg-black/30 border-white/5 ml-4' : 'bg-slate-50 border-slate-200 ml-4'
                    }`}
                  >
                    <div className={`flex items-center justify-between text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        {m.is_admin ? '🛡️ پشتیبانی' : `👤 ${m.author}`}
                      </span>
                      <span dir="ltr">{m.created_at?.slice(0, 16).replace('T', ' ')}</span>
                    </div>
                    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{m.body}</p>
                  </div>
                ))}
              </div>

              {/* Reply box */}
              {one.data.status === 'closed' && !isAdmin ? (
                <div className={`p-4 rounded-xl text-center text-xs ${isDark ? 'bg-black/30 text-slate-500' : 'bg-slate-100 text-slate-500'}`}>
                  این تیکت بسته شده است. برای پیگیری، تیکت جدید ثبت کنید.
                </div>
              ) : (
                <form className={`space-y-3 pt-2 border-t ${isDark ? 'border-white/5' : 'border-slate-200'}`} onSubmit={sendReply}>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="پاسخ خود را بنویسید..."
                    maxLength={4000}
                    rows={3}
                    required
                    className={`w-full border rounded-xl p-4 text-sm focus:outline-none transition-all resize-y ${
                      isDark
                        ? 'bg-black/30 border-emerald-500/20 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50'
                        : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-600'
                    }`}
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-xs active:scale-[0.98] transition-all"
                    >
                      <Send size={14} />
                      <span>ارسال پاسخ</span>
                    </button>
                  </div>
                </form>
              )}
            </AppleCard>
          </div>
        )}
      </div>
    </div>
  )
}

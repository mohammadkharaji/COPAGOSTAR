import { useMemo, useState } from 'react'
import {
  ShieldCheck, UserPlus, Users, KeyRound, History, Search, Check, AlertCircle, Edit2, UserX, UserCheck,
  Trash2, Sparkles, Filter, TrendingUp, BarChart3, MessageSquare, Award, Layers
} from 'lucide-react'
import { motion } from 'motion/react'
import { send, useApi } from './api'
import { useAppearance } from './AppearanceContext'
import { fa } from './format'
import { NAV } from './ExecutiveDashboard'

const PAGE_LABEL = Object.fromEntries(NAV.map(([id, label]) => [id, label]))

const PERMISSION_GROUPS = [
  {
    id: 'sales',
    title: 'فروش',
    icon: TrendingUp,
    items: [
      { id: 'overview', label: 'نمای کلی' },
      { id: 'trend', label: 'روند روزانه' },
      { id: 'monthly', label: 'روند ماهانه' },
      { id: 'growth', label: 'آنالیز رشد و افت' },
      { id: 'target', label: 'تارگت' },
    ],
  },
  {
    id: 'analysis',
    title: 'تحلیل',
    icon: BarChart3,
    items: [
      { id: 'branch', label: 'شعب و مناطق' },
      { id: 'product', label: 'کالا و برند' },
      { id: 'profile', label: 'تحلیل شعبه و برند' },
      { id: 'pareto', label: 'تحلیل پارتو' },
      { id: 'inactive', label: 'مشتریان غیرفعال' },
      { id: 'potential', label: 'مشتریان بالقوه' },
      { id: 'returns', label: 'برگشتی حواله' },
      { id: 'quantity', label: 'تحلیل تعداد کالا' },
    ],
  },
  {
    id: 'customer',
    title: 'مشتری و فاکتور',
    icon: Users,
    items: [
      { id: 'invoice', label: 'تحلیل فاکتور' },
      { id: 'customer', label: 'پروفایل مشتری' },
      { id: 'visitor', label: 'پروفایل ویزیتور' },
    ],
  },
  {
    id: 'support',
    title: 'پشتیبانی',
    icon: MessageSquare,
    items: [
      { id: 'tickets', label: 'تیکت‌ها' },
    ],
  },
  {
    id: 'ai',
    title: 'تحلیل هوشمند',
    icon: Sparkles,
    items: [
      { id: 'chat', label: 'دستیار هوشمند' },
    ],
  },
  {
    id: 'clubs',
    title: 'باشگاه‌ها',
    icon: Award,
    items: [
      { id: 'club_b2b', label: 'باشگاه مشتریان B2B' },
      { id: 'club_visitor', label: 'باشگاه ویزیتورها' },
    ],
  },
  {
    id: 'system',
    title: 'سیستم / مدیریت',
    icon: ShieldCheck,
    items: [
      { id: 'health', label: 'سلامت داده' },
      { id: 'admin', label: 'مدیریت کاربران و نقش‌ها', isAdminFlag: true },
    ],
  },
]
const SCOPE_LABEL = { all: 'همهٔ داده‌ها', branch: 'شعبه‌های تعیین‌شده', supervisor: 'سرپرست‌های تعیین‌شده' }
const SCOPE_HINT = {
  all: 'کاربر همهٔ ردیف‌های داده را در هسته‌های مجاز می‌بیند.',
  branch: 'هر کاربر فقط داده‌های شعبه‌هایی را می‌بیند که برایش انتخاب می‌شود.',
  supervisor: 'هر کاربر فقط داده‌های سرپرست‌هایی را می‌بیند که برایش انتخاب می‌شود.',
}
const KNOWN_ACTIONS = ['login', 'login.failed', 'role.create', 'role.update', 'role.delete', 'role.defaults', 'user.create', 'user.update', 'user.deactivate', 'user.reset_password']
const AUDIT_PAGE = 50

const when = (ts) => {
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleString('fa-IR')
}
const toggleIn = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

function AppleCard({ title, subtitle, badge, action, children, className = '' }) {
  const { isDark, isSolid } = useAppearance()
  return (
    <div
      className={`apple-card rounded-2xl sm:rounded-3xl border transition-all p-4 sm:p-6 overflow-hidden w-full max-w-full ${
        isDark
          ? 'bg-[#0B100E]/75 backdrop-blur-2xl border-emerald-500/15 text-[#F5F5F7] shadow-[0_8px_30px_rgba(0,0,0,0.45)]'
          : isSolid
          ? 'bg-white border-slate-200 text-[#1D1D1F] shadow-xs'
          : 'bg-white/85 backdrop-blur-xl border-black/[0.04] text-[#1D1D1F] shadow-[0_8px_30px_rgb(0,0,0,0.04)]'
      } ${className}`}
    >
      {(title || subtitle || badge || action) && (
        <div className="flex items-center justify-between mb-4 sm:mb-5 flex-wrap gap-2">
          <div>
            {title && <h2 className={`text-base font-bold ${isDark ? 'text-slate-100' : 'text-[#1D1D1F]'}`}>{title}</h2>}
            {subtitle && <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}>{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {badge && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {badge}
              </span>
            )}
            {action}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

function useAction() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const run = async (fn, ok) => {
    setBusy(true)
    setMsg(null)
    try {
      const r = await fn()
      setMsg({ tone: 'ok', text: typeof ok === 'function' ? ok(r) : ok })
      return true
    } catch (e) {
      setMsg({ tone: 'err', text: e.message })
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, msg, setMsg, run }
}

function Msg({ msg }) {
  if (!msg) return null
  const ok = msg.tone === 'ok'
  return (
    <div className={`px-4 py-3 rounded-2xl text-xs font-semibold flex items-center justify-between mb-4 ${
      ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-800' : 'bg-rose-500/10 border border-rose-500/20 text-rose-800'
    }`} role={ok ? 'status' : 'alert'}>
      <span>{msg.text}</span>
    </div>
  )
}

function Checks({ items, value, onChange, label }) {
  const { isDark } = useAppearance()
  return (
    <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1" role="group" aria-label={label}>
      {items.map(([id, text, hint]) => {
        const checked = value.includes(id)
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(toggleIn(value, id))}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all text-right flex items-center gap-2 cursor-pointer ${
              checked
                ? isDark
                  ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400 font-bold'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                : isDark
                ? 'bg-white/[0.04] border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
                : 'bg-[#F5F5F7] border-black/[0.04] text-[#1D1D1F] hover:bg-[#E8E8ED]'
            }`}
          >
            <span className={`w-3.5 h-3.5 rounded-md flex items-center justify-center text-[10px] ${
              checked ? 'bg-emerald-500 text-white font-bold' : isDark ? 'border border-white/20 bg-white/5' : 'border border-black/[0.2] bg-white'
            }`}>
              {checked && '✓'}
            </span>
            <span>{text}</span>
            {hint && <small className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}>({hint})</small>}
          </button>
        )
      })}
    </div>
  )
}

function ScopePicker({ mode, options, branches, supervisors, onBranches, onSupervisors }) {
  const { isDark } = useAppearance()
  const [q, setQ] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const people = useMemo(() => {
    const byName = new Map()
    ;(options.supervisors ?? []).forEach(({ name, branch }) => {
      const e = byName.get(name) ?? { name, branches: [] }
      if (branch && !e.branches.includes(branch)) e.branches.push(branch)
      byName.set(name, e)
    })
    return [...byName.values()]
  }, [options.supervisors])
  if (!mode) return <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}>برای تعیین دامنهٔ داده، ابتدا نقش را انتخاب کنید.</p>
  if (mode === 'all') return <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}>{SCOPE_HINT.all}</p>
  if (mode === 'branch') {
    const list = options.branches ?? []
    return (
      <div className="space-y-3">
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}>{SCOPE_HINT.branch}</p>
        {!list.length && <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}>فهرست شعبه‌ها هنوز از داده خوانده نشده است.</p>}
        <Checks items={list.map((b) => [b, b])} value={branches} onChange={onBranches} label="شعبه‌ها" />
        {branches.length > 0 && <p className="text-xs text-emerald-400 font-semibold">{fa(branches.length)} شعبه انتخاب شده است.</p>}
        {branches.length === 0 && <div className="text-xs text-amber-700 bg-amber-500/10 p-3 rounded-xl" role="status">هیچ شعبه‌ای انتخاب نشده است؛ این کاربر هیچ دادهٔ فروشی نمی‌بیند.</div>}
      </div>
    )
  }
  const needle = q.trim().toLowerCase()
  const shown = people.filter((p) => (!branchFilter || p.branches.includes(branchFilter)) && (!needle || p.name.toLowerCase().includes(needle)))
  return (
    <div className="space-y-3">
      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}>{SCOPE_HINT.supervisor}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجوی سرپرست…"
          className={`rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/25 ${
            isDark ? 'bg-white/5 border border-white/10 text-slate-100 placeholder-slate-500' : 'bg-[#F5F5F7] border border-black/[0.06] text-[#1D1D1F]'
          }`}
        />
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className={`rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/25 ${
            isDark ? 'bg-[#0F1412] border border-white/10 text-slate-100' : 'bg-[#F5F5F7] border border-black/[0.06] text-[#1D1D1F]'
          }`}
        >
          <option value="">همهٔ شعبه‌ها</option>
          {(options.branches ?? []).map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
            isDark ? 'bg-white/10 hover:bg-white/15 text-slate-200' : 'bg-black/[0.05] hover:bg-black/[0.08] text-[#1D1D1F]'
          }`}
          onClick={() => onSupervisors([...new Set([...supervisors, ...shown.map((p) => p.name)])])}
          disabled={!shown.length}
        >
          انتخاب نمایش‌داده‌شده‌ها
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
            isDark ? 'bg-white/10 hover:bg-white/15 text-slate-200' : 'bg-black/[0.05] hover:bg-black/[0.08] text-[#1D1D1F]'
          }`}
          onClick={() => onSupervisors([])}
          disabled={!supervisors.length}
        >
          پاک کردن انتخاب
        </button>
      </div>
      {!people.length && <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}>فهرست سرپرست‌ها هنوز از داده خوانده نشده است.</p>}
      <Checks items={shown.map((p) => [p.name, p.name, p.branches.join('، ')])} value={supervisors} onChange={onSupervisors} label="سرپرست‌ها" />
      {supervisors.length > 0 && <p className="text-xs text-emerald-400 font-semibold">{fa(supervisors.length)} سرپرست انتخاب شده است.</p>}
      {supervisors.length === 0 && <div className="text-xs text-amber-700 bg-amber-500/10 p-3 rounded-xl" role="status">هیچ سرپرستی انتخاب نشده است؛ این کاربر هیچ دادهٔ فروشی نمی‌بیند.</div>}
    </div>
  )
}

/* ---------- کاربران ---------- */
const NEW_USER = { id: null, username: '', display_name: '', password: '', role_id: '', is_active: true, branches: [], supervisors: [] }

function UsersTab({ options, roles, ver, bump }) {
  const users = useApi('/admin/users', { v: ver })
  const [form, setForm] = useState(null)
  const [q, setQ] = useState('')
  const act = useAction()
  const roleOf = (id) => roles.find((r) => r.id === Number(id))
  const mode = roleOf(form?.role_id)?.scope_mode ?? ''
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const changeRole = (id) => {
    const next = roleOf(id)?.scope_mode ?? ''
    setForm((f) => ({ ...f, role_id: id, ...(next !== mode ? { branches: [], supervisors: [] } : {}) }))
  }
  const open = (u) => {
    act.setMsg(null)
    setForm(u ? { id: u.id, username: u.username, display_name: u.display_name ?? '', password: '', role_id: String(u.role_id), is_active: u.is_active, branches: u.branches ?? [], supervisors: u.supervisors ?? [] } : { ...NEW_USER })
  }
  const submit = async (e) => {
    e.preventDefault()
    const f = form
    const body = {
      display_name: f.display_name.trim(), role_id: Number(f.role_id), is_active: f.is_active,
      branches: mode === 'branch' ? f.branches : [], supervisors: mode === 'supervisor' ? f.supervisors : [],
    }
    const ok = await act.run(async () => {
      if (f.id == null) {
        await send('POST', '/admin/users', { ...body, username: f.username.trim(), password: f.password })
      } else {
        await send('PATCH', `/admin/users/${f.id}`, body)
        if (f.password) await send('POST', `/admin/users/${f.id}/reset-password`, { password: f.password })
      }
    }, f.id == null ? 'کاربر ایجاد شد.' : f.password ? 'تغییرات ذخیره و رمز عبور بازنشانی شد.' : 'تغییرات ذخیره شد.')
    bump()
    if (ok) setForm(null)
  }
  const deactivate = async (u) => {
    if (!window.confirm(`کاربر «${u.username}» غیرفعال شود؟ نشست‌های باز او بسته می‌شود.`)) return
    await act.run(() => send('POST', `/admin/users/${u.id}/deactivate`), `کاربر «${u.username}» غیرفعال شد.`)
    bump()
  }
  const reactivate = async (u) => {
    await act.run(() => send('PATCH', `/admin/users/${u.id}`, { is_active: true }), `کاربر «${u.username}» دوباره فعال شد.`)
    bump()
  }
  const scopeText = (u) => (u.scope_mode === 'all' ? 'همهٔ داده‌ها' : u.scope_mode === 'branch' ? `${fa(u.branches.length)} شعبه` : u.scope_mode === 'supervisor' ? `${fa(u.supervisors.length)} سرپرست` : '—')
  const emptyScope = (u) => (u.scope_mode === 'branch' && !u.branches.length) || (u.scope_mode === 'supervisor' && !u.supervisors.length)
  const needle = q.trim().toLowerCase()
  const rows = (users.data ?? []).filter((u) => !needle || `${u.username} ${u.display_name ?? ''} ${u.role}`.toLowerCase().includes(needle))

  return (
    <AppleCard
      title="کاربران سامانه"
      subtitle="مدیریت حساب‌ها، نقش‌ها و سطوح دسترسی به داده‌ها"
      badge={users.data ? `${fa(users.data.length)} کاربر` : 'در حال بارگذاری'}
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-sm shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer"
            onClick={() => open(null)}
            disabled={!roles.length}
          >
            <UserPlus size={15} />
            <span>کاربر جدید</span>
          </button>
        </div>
      }
    >
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="relative w-72">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی کاربر یا نقش…"
            className={`w-full border rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/25 ${
              isDark ? 'bg-white/5 border-white/10 text-slate-100 placeholder-slate-500' : 'bg-[#F5F5F7] border-black/[0.06] text-[#1D1D1F]'
            }`}
          />
        </div>
      </div>

      {!roles.length && <div className="text-xs text-amber-800 bg-amber-500/10 p-3 rounded-xl mb-4" role="status">برای ساخت کاربر ابتدا در زبانهٔ «نقش‌ها» یک نقش بسازید.</div>}
      <Msg msg={act.msg} />

      {form && (
        <form className={`mb-6 p-5 rounded-2xl border space-y-4 ${
          isDark ? 'bg-[#0F1412] border-emerald-500/15' : 'bg-[#F5F5F7] border-black/[0.05]'
        }`} onSubmit={submit}>
          <h3 className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-[#1D1D1F]'}`}>{form.id == null ? 'کاربر جدید' : `ویرایش «${form.username}»`}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}>نام کاربری</label>
              <input
                dir="ltr"
                value={form.username}
                onChange={(e) => set({ username: e.target.value })}
                required={form.id == null}
                disabled={form.id != null}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/25 ${
                  isDark ? 'bg-white/5 border-white/10 text-slate-100' : 'bg-white border-black/[0.08] text-[#1D1D1F]'
                }`}
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}>نام نمایشی</label>
              <input
                value={form.display_name}
                onChange={(e) => set({ display_name: e.target.value })}
                maxLength={100}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/25 ${
                  isDark ? 'bg-white/5 border-white/10 text-slate-100' : 'bg-white border-black/[0.08] text-[#1D1D1F]'
                }`}
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}>{form.id == null ? 'رمز عبور (حداقل ۸ نویسه)' : 'رمز عبور جدید (اختیاری)'}</label>
              <input
                type="password"
                dir="ltr"
                value={form.password}
                onChange={(e) => set({ password: e.target.value })}
                required={form.id == null}
                minLength={8}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/25 ${
                  isDark ? 'bg-white/5 border-white/10 text-slate-100' : 'bg-white border-black/[0.08] text-[#1D1D1F]'
                }`}
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}>نقش</label>
              <select
                value={form.role_id}
                onChange={(e) => changeRole(e.target.value)}
                required
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/25 ${
                  isDark ? 'bg-[#0F1412] border-white/10 text-slate-100' : 'bg-white border-black/[0.08] text-[#1D1D1F]'
                }`}
              >
                <option value="">انتخاب نقش…</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="user_active_check"
              checked={form.is_active}
              onChange={(e) => set({ is_active: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="user_active_check" className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-[#1D1D1F]'}`}>حساب فعال</label>
          </div>

          <div className={`p-4 rounded-xl border space-y-2 ${
            isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-black/[0.05]'
          }`}>
            <span className={`text-xs font-bold block ${isDark ? 'text-slate-100' : 'text-[#1D1D1F]'}`}>دامنهٔ داده{mode ? ` · ${SCOPE_LABEL[mode] ?? mode}` : ''}</span>
            <ScopePicker
              key={mode} mode={mode} options={options} branches={form.branches} supervisors={form.supervisors}
              onBranches={(v) => set({ branches: v })} onSupervisors={(v) => set({ supervisors: v })}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-sm shadow-emerald-500/25 transition-all cursor-pointer"
              disabled={act.busy}
            >
              {form.id == null ? 'ایجاد کاربر' : 'ذخیره تغییرات'}
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                isDark ? 'bg-white/10 hover:bg-white/15 text-slate-200' : 'bg-black/[0.05] hover:bg-black/[0.08] text-[#1D1D1F]'
              }`}
              onClick={() => { setForm(null); act.setMsg(null) }}
            >
              انصراف
            </button>
          </div>
        </form>
      )}

      {users.error && <div className="banner err" role="alert">دریافت کاربران ناموفق بود.</div>}
      {users.loading && !users.data && <div className="banner">در حال بارگذاری…</div>}
      {users.data && (rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-black/[0.06] text-[#86868B]">
                <th className="py-3 px-3 font-semibold">نام کاربری</th>
                <th className="py-3 px-3 font-semibold">نام نمایشی</th>
                <th className="py-3 px-3 font-semibold">نقش</th>
                <th className="py-3 px-3 font-semibold">دامنهٔ داده</th>
                <th className="py-3 px-3 font-semibold">وضعیت</th>
                <th className="py-3 px-3 font-semibold">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-black/[0.03] hover:bg-black/[0.015] transition-colors">
                  <td className="py-3 px-3 font-medium text-[#1D1D1F]" dir="ltr">{u.username}</td>
                  <td className="py-3 px-3 text-[#1D1D1F]">{u.display_name || '—'}</td>
                  <td className="py-3 px-3">
                    <span className="font-semibold text-[#1D1D1F]">{u.role}</span>
                    {u.is_admin && <span className="mr-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700">مدیر</span>}
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[#86868B]">{scopeText(u)}</span>
                    {emptyScope(u) && <span className="mr-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-700">بدون دامنه</span>}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      u.is_active ? 'bg-emerald-500/15 text-emerald-700' : 'bg-rose-500/15 text-rose-700'
                    }`}>
                      {u.is_active ? 'فعال' : 'غیرفعال'}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-black/[0.04] hover:bg-black/[0.08] text-[#1D1D1F] transition-colors"
                        onClick={() => open(u)}
                      >
                        ویرایش
                      </button>
                      {u.is_active ? (
                        <button
                          type="button"
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 transition-colors"
                          onClick={() => deactivate(u)}
                          disabled={act.busy}
                        >
                          غیرفعال‌سازی
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 transition-colors"
                          onClick={() => reactivate(u)}
                          disabled={act.busy}
                        >
                          فعال‌سازی
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="text-center py-10 text-xs text-[#86868B]">{users.data.length ? 'کاربری با این جستجو پیدا نشد.' : 'هنوز کاربری ساخته نشده است.'}</div>)}
    </AppleCard>
  )
}

/* ---------- نقش‌ها ---------- */
const NEW_ROLE = { id: null, name: '', description: '', pages: [], cores: [], scope_mode: 'all', is_admin: false, user_count: 0, original_mode: 'all' }

function RolePermissionsTree({ form, set, options }) {
  const allConfiguredPages = useMemo(() => {
    const list = []
    PERMISSION_GROUPS.forEach((g) => {
      g.items.forEach((it) => {
        if (!it.isAdminFlag) list.push(it.id)
      })
    })
    return list
  }, [])

  const otherPages = useMemo(() => {
    const existing = new Set(allConfiguredPages)
    return (options?.pages ?? []).filter((p) => !existing.has(p)).map((p) => ({
      id: p,
      label: PAGE_LABEL[p] ?? p,
    }))
  }, [allConfiguredPages, options?.pages])

  const selectAllAll = () => {
    const all = [...new Set([...allConfiguredPages, ...otherPages.map((p) => p.id)])]
    set({ pages: all, is_admin: true })
  }

  const deselectAllAll = () => {
    set({ pages: [], is_admin: false })
  }

  const totalPermissions = allConfiguredPages.length + 1 + otherPages.length
  const selectedCount = form.pages.length + (form.is_admin ? 1 : 0)

  return (
    <div className="space-y-3">
      {/* Top Bar for Permission Tree */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${isDark ? 'text-slate-100' : 'text-[#1D1D1F]'}`}>سطوح دسترسی به منوها و زیرمنوها</span>
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
            isDark ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/25' : 'text-emerald-800 bg-emerald-50 border border-emerald-200'
          }`}>
            {fa(selectedCount)} از {fa(totalPermissions)} فعال
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-xs text-emerald-400 font-semibold hover:underline bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1 rounded-xl transition-all cursor-pointer"
            onClick={selectAllAll}
          >
            انتخاب همهٔ منوها
          </button>
          <button
            type="button"
            className={`text-xs font-semibold hover:underline px-3 py-1 rounded-xl transition-all cursor-pointer ${
              isDark ? 'text-slate-400 bg-white/5 hover:bg-white/10' : 'text-[#86868B] bg-black/[0.04] hover:bg-black/[0.08]'
            }`}
            onClick={deselectAllAll}
          >
            پاک کردن همه
          </button>
        </div>
      </div>

      {/* Grid of Apple Bento Cards for Groups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {PERMISSION_GROUPS.map((group) => {
          const GroupIcon = group.icon
          const groupItemCount = group.items.length
          const groupSelectedCount = group.items.filter((it) =>
            it.isAdminFlag ? Boolean(form.is_admin) : form.pages.includes(it.id)
          ).length

          const selectGroup = () => {
            const pageIdsToAdd = group.items.filter((it) => !it.isAdminFlag).map((it) => it.id)
            const nextPages = [...new Set([...form.pages, ...pageIdsToAdd])]
            const hasAdmin = group.items.some((it) => it.isAdminFlag)
            set({
              pages: nextPages,
              ...(hasAdmin ? { is_admin: true } : {}),
            })
          }

          const deselectGroup = () => {
            const pageIdsToRemove = new Set(group.items.filter((it) => !it.isAdminFlag).map((it) => it.id))
            const nextPages = form.pages.filter((p) => !pageIdsToRemove.has(p))
            const hasAdmin = group.items.some((it) => it.isAdminFlag)
            set({
              pages: nextPages,
              ...(hasAdmin ? { is_admin: false } : {}),
            })
          }

          return (
            <div
              key={group.id}
              className={`border rounded-2xl p-4 shadow-xs space-y-3 flex flex-col justify-between transition-all ${
                isDark ? 'bg-white/[0.03] border-white/10 text-[#F5F5F7]' : 'bg-white border-slate-200/80 text-[#1D1D1F]'
              }`}
            >
              {/* Group Header */}
              <div className={`flex items-center justify-between pb-2 border-b ${isDark ? 'border-white/10' : 'border-slate-200/80'}`}>
                <div className="flex items-center gap-2.5">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-black/[0.04] text-[#1D1D1F]'}`}>
                    <GroupIcon size={15} />
                  </span>
                  <div>
                    <h4 className={`text-xs font-bold ${isDark ? 'text-[#F5F5F7]' : 'text-[#1D1D1F]'}`}>{group.title}</h4>
                    <span className={`text-[10px] block mt-0.5 ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}>
                      {fa(groupSelectedCount)} از {fa(groupItemCount)} انتخاب‌شده
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    className="text-[11px] text-emerald-400 font-semibold hover:underline px-1.5 py-0.5 cursor-pointer"
                    onClick={selectGroup}
                  >
                    انتخاب همه
                  </button>
                  <span className={`text-xs ${isDark ? 'text-white/20' : 'text-slate-300'}`}>|</span>
                  <button
                    type="button"
                    className={`text-[11px] font-semibold hover:underline px-1.5 py-0.5 cursor-pointer ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}
                    onClick={deselectGroup}
                  >
                    پاک کردن
                  </button>
                </div>
              </div>

              {/* Group Items / Sub-menus */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.items.map((item) => {
                  const isChecked = item.isAdminFlag ? Boolean(form.is_admin) : form.pages.includes(item.id)
                  const toggle = () => {
                    if (item.isAdminFlag) {
                      set({ is_admin: !form.is_admin })
                    } else {
                      set({ pages: toggleIn(form.pages, item.id) })
                    }
                  }
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={toggle}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all text-right flex items-center justify-between gap-2 select-none cursor-pointer ${
                        isChecked
                          ? isDark
                            ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400 font-bold shadow-xs'
                            : 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold shadow-xs'
                          : isDark
                          ? 'bg-white/5 border-white/10 text-[#F5F5F7] hover:bg-white/10'
                          : 'bg-[#F5F5F7] border-black/[0.04] text-[#1D1D1F] hover:bg-[#E8E8ED]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] shrink-0 transition-colors ${
                            isChecked
                              ? 'bg-emerald-500 text-white font-bold shadow-xs'
                              : isDark
                              ? 'border border-white/20 bg-white/10'
                              : 'border border-black/[0.2] bg-white'
                          }`}
                        >
                          {isChecked && '✓'}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.isAdminFlag && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-800 font-semibold shrink-0">
                          سطح ارشد
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Other Pages Card (if any unexpected or extra page exists) */}
        {otherPages.length > 0 && (
          <div className={`border rounded-2xl p-4 shadow-xs space-y-3 flex flex-col justify-between ${
            isDark ? 'bg-white/[0.03] border-white/10 text-slate-100' : 'bg-white border-slate-200/80 text-[#1D1D1F]'
          }`}>
            <div className={`flex items-center justify-between pb-2 border-b ${isDark ? 'border-white/10' : 'border-slate-200/80'}`}>
              <div className="flex items-center gap-2.5">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-white/10 text-slate-100' : 'bg-black/[0.04] text-[#1D1D1F]'}`}>
                  <Layers size={15} />
                </span>
                <div>
                  <h4 className={`text-xs font-bold ${isDark ? 'text-slate-100' : 'text-[#1D1D1F]'}`}>سایر صفحات</h4>
                  <span className={`text-[10px] block mt-0.5 ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}>
                    {fa(otherPages.filter((p) => form.pages.includes(p.id)).length)} از {fa(otherPages.length)} انتخاب‌شده
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  className="text-[11px] text-emerald-400 font-semibold hover:underline px-1.5 py-0.5 cursor-pointer"
                  onClick={() => set({ pages: [...new Set([...form.pages, ...otherPages.map((p) => p.id)])] })}
                >
                  انتخاب همه
                </button>
                <span className={`text-xs ${isDark ? 'text-white/20' : 'text-slate-300'}`}>|</span>
                <button
                  type="button"
                  className={`text-[11px] font-semibold hover:underline px-1.5 py-0.5 cursor-pointer ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}
                  onClick={() => set({ pages: form.pages.filter((p) => !otherPages.some((op) => op.id === p)) })}
                >
                  پاک کردن
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {otherPages.map((item) => {
                const isChecked = form.pages.includes(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => set({ pages: toggleIn(form.pages, item.id) })}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all text-right flex items-center justify-between gap-2 select-none cursor-pointer ${
                      isChecked
                        ? isDark
                          ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400 font-bold shadow-xs'
                          : 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold shadow-xs'
                        : isDark
                        ? 'bg-white/5 border-white/10 text-slate-100 hover:bg-white/10'
                        : 'bg-[#F5F5F7] border-black/[0.04] text-[#1D1D1F] hover:bg-[#E8E8ED]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] shrink-0 transition-colors ${
                          isChecked ? 'bg-emerald-500 text-white font-bold shadow-xs' : isDark ? 'border border-white/20 bg-white/10' : 'border border-black/[0.2] bg-white'
                        }`}
                      >
                        {isChecked && '✓'}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RolesTab({ options, roles, bump }) {
  const { isDark } = useAppearance()
  const [form, setForm] = useState(null)
  const act = useAction()
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const pageItems = (options.pages ?? []).map((id) => [id, PAGE_LABEL[id] ?? id])
  const coreItems = Object.entries(options.cores ?? {})
  const locked = form && form.id != null && form.user_count > 0
  const open = (r) => {
    act.setMsg(null)
    setForm(r ? { ...r, description: r.description ?? '', original_mode: r.scope_mode } : { ...NEW_ROLE })
  }
  const submit = async (e) => {
    e.preventDefault()
    const f = form
    const body = { name: f.name.trim(), description: f.description.trim(), pages: f.pages, cores: f.cores, is_admin: f.is_admin }
    if (f.id == null || f.scope_mode !== f.original_mode) body.scope_mode = f.scope_mode
    const ok = await act.run(
      () => (f.id == null ? send('POST', '/admin/roles', body) : send('PATCH', `/admin/roles/${f.id}`, body)),
      f.id == null ? 'نقش ایجاد شد.' : 'نقش ذخیره شد.',
    )
    bump()
    if (ok) setForm(null)
  }
  const remove = async (r) => {
    if (!window.confirm(`نقش «${r.name}» حذف شود؟`)) return
    await act.run(() => send('DELETE', `/admin/roles/${r.id}`), `نقش «${r.name}» حذف شد.`)
    bump()
  }
  const seed = async () => {
    await act.run(() => send('POST', '/admin/roles/defaults'), (r) => (r.created?.length ? `نقش‌های ساخته‌شده: ${r.created.join('، ')}` : 'همهٔ نقش‌های پیش‌فرض از قبل وجود دارند.'))
    bump()
  }

  return (
    <AppleCard
      title="نقش‌ها و دسترسی‌ها"
      subtitle="تعریف گروه‌های کاربری و محدوده‌های دسترسی به صفحات و هسته‌ها"
      badge={`${fa(roles.length)} نقش`}
      action={
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-sm shadow-emerald-500/25 transition-all cursor-pointer"
            onClick={() => open(null)}
          >
            نقش جدید
          </button>
          <button
            type="button"
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              isDark ? 'bg-white/10 hover:bg-white/15 text-slate-200' : 'bg-black/[0.05] hover:bg-black/[0.08] text-[#1D1D1F]'
            }`}
            onClick={seed}
            disabled={act.busy}
          >
            ساخت نقش‌های پیش‌فرض
          </button>
        </div>
      }
    >
      <Msg msg={act.msg} />

      {form && (
        <form className={`mb-6 p-5 rounded-2xl border space-y-4 ${
          isDark ? 'bg-[#0F1412] border-emerald-500/15' : 'bg-[#F5F5F7] border-black/[0.05]'
        }`} onSubmit={submit}>
          <h3 className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-[#1D1D1F]'}`}>{form.id == null ? 'نقش جدید' : `ویرایش «${form.name}»`}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}>نام نقش</label>
              <input
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                required
                minLength={2}
                maxLength={60}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/25 ${
                  isDark ? 'bg-white/5 border-white/10 text-slate-100' : 'bg-white border-black/[0.08] text-[#1D1D1F]'
                }`}
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}>توضیح</label>
              <input
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                maxLength={300}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/25 ${
                  isDark ? 'bg-white/5 border-white/10 text-slate-100' : 'bg-white border-black/[0.08] text-[#1D1D1F]'
                }`}
              />
            </div>
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}>دامنهٔ داده</label>
              <select
                value={form.scope_mode}
                onChange={(e) => set({ scope_mode: e.target.value })}
                disabled={locked}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/25 ${
                  isDark ? 'bg-[#0F1412] border-white/10 text-slate-100' : 'bg-white border-black/[0.08] text-[#1D1D1F]'
                }`}
              >
                {(options.scope_modes ?? ['all', 'branch', 'supervisor']).map((m) => <option key={m} value={m}>{SCOPE_LABEL[m] ?? m}</option>)}
              </select>
            </div>
          </div>
          {locked && <p className="text-xs text-amber-700">دامنهٔ داده تا وقتی نقش به کاربری داده شده تغییر نمی‌کند ({fa(form.user_count)} کاربر).</p>}

          <RolePermissionsTree form={form} set={set} options={options} />

          <div className={`p-4 rounded-xl border space-y-2 ${
            isDark ? 'bg-white/[0.02] border-white/10' : 'bg-white border-black/[0.05]'
          }`}>
            <span className={`text-xs font-bold block mb-2 ${isDark ? 'text-slate-100' : 'text-[#1D1D1F]'}`}>هسته‌های مجاز</span>
            <Checks items={coreItems} value={form.cores} onChange={(v) => set({ cores: v })} label="هسته‌های مجاز" />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="role_admin_check"
              checked={form.is_admin}
              onChange={(e) => set({ is_admin: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="role_admin_check" className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-[#1D1D1F]'}`}>
              دسترسی مدیریت (کاربران، نقش‌ها، گزارش رویدادها و به‌روزرسانی داده)
            </label>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-sm shadow-emerald-500/25 transition-all cursor-pointer"
              disabled={act.busy}
            >
              {form.id == null ? 'ایجاد نقش' : 'ذخیره'}
            </button>
            <button
              type="button"
              className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                isDark ? 'bg-white/10 hover:bg-white/15 text-slate-200' : 'bg-black/[0.05] hover:bg-black/[0.08] text-[#1D1D1F]'
              }`}
              onClick={() => { setForm(null); act.setMsg(null) }}
            >
              انصراف
            </button>
          </div>
        </form>
      )}

      {roles.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-black/[0.06] text-[#86868B]">
                <th className="py-3 px-3 font-semibold">نقش</th>
                <th className="py-3 px-3 font-semibold">صفحه‌ها</th>
                <th className="py-3 px-3 font-semibold">هسته‌ها</th>
                <th className="py-3 px-3 font-semibold">دامنهٔ داده</th>
                <th className="py-3 px-3 font-semibold">کاربران</th>
                <th className="py-3 px-3 font-semibold">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} className="border-b border-black/[0.03] hover:bg-black/[0.015] transition-colors">
                  <td className="py-3 px-3">
                    <b className="font-bold text-[#1D1D1F]">{r.name}</b>
                    {r.is_admin && <span className="mr-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700">مدیر</span>}
                    {r.description && <small className="block text-[#86868B] text-[11px] mt-0.5">{r.description}</small>}
                  </td>
                  <td className="py-3 px-3 text-[#1D1D1F]" title={r.pages.map((p) => PAGE_LABEL[p] ?? p).join('، ')}>
                    {fa(r.pages.length)} از {fa((options.pages ?? []).length)}
                  </td>
                  <td className="py-3 px-3 text-[#1D1D1F]">{r.cores.map((c) => options.cores?.[c] ?? c).join('، ') || '—'}</td>
                  <td className="py-3 px-3 text-[#86868B]">{SCOPE_LABEL[r.scope_mode] ?? r.scope_mode}</td>
                  <td className="py-3 px-3 tabular-nums font-semibold text-[#1D1D1F]">{fa(r.user_count)}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-black/[0.04] hover:bg-black/[0.08] text-[#1D1D1F] transition-colors"
                        onClick={() => open(r)}
                      >
                        ویرایش
                      </button>
                      <button
                        type="button"
                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 disabled:opacity-40 transition-colors"
                        onClick={() => remove(r)}
                        disabled={act.busy || r.user_count > 0}
                        title={r.user_count > 0 ? 'نقشی که به کاربر داده شده حذف نمی‌شود' : undefined}
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="text-center py-10 text-xs text-[#86868B]">هنوز نقشی ساخته نشده است. با «ساخت نقش‌های پیش‌فرض» می‌توانید شروع کنید.</div>}
    </AppleCard>
  )
}

/* ---------- گزارش رویدادها ---------- */
function AuditTab() {
  const [draft, setDraft] = useState({ actor: '', action: '' })
  const [applied, setApplied] = useState({ actor: '', action: '' })
  const [offset, setOffset] = useState(0)
  const audit = useApi('/admin/audit', { limit: AUDIT_PAGE, offset, actor: applied.actor, action: applied.action })
  const apply = (e) => {
    e.preventDefault()
    const next = { actor: draft.actor.trim(), action: draft.action.trim() }
    setOffset(0)
    setApplied(next)
  }
  const reset = () => { setDraft({ actor: '', action: '' }); setApplied({ actor: '', action: '' }); setOffset(0) }
  const d = audit.data
  const count = d?.count ?? 0
  const last = Math.min(offset + AUDIT_PAGE, count)
  return (
    <AppleCard
      title="گزارش رویدادها (Audit Logs)"
      subtitle="ثبت تمامی ورودها، تغییرات کاربران و نقش‌ها با جزئیات IP و زمان (پالایش خودکار و نگهداری ۱۴ روز اخیر)"
      badge={d ? `${fa(count)} رویداد (۱۴ روز اخیر)` : 'در حال بارگذاری'}
    >
      <div className={`flex items-center gap-2 mb-4 px-3.5 py-2.5 rounded-xl text-xs ${
        isDark ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
      }`}>
        <History size={15} className="shrink-0" />
        <span>سیاست نگهداری ۱۴ روزه فعال است: رویدادهای قدیمی‌تر از ۲ هفته به‌طور خودکار پالایش و حذف می‌شوند.</span>
      </div>
      <form className="flex items-center gap-3 mb-5 flex-wrap" onSubmit={apply}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}>کاربر:</span>
          <input
            dir="ltr"
            value={draft.actor}
            onChange={(e) => setDraft({ ...draft, actor: e.target.value })}
            placeholder="مثلاً admin"
            className={`border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/25 ${
              isDark ? 'bg-white/5 border-white/10 text-slate-100 placeholder-slate-500' : 'bg-[#F5F5F7] border-black/[0.06] text-[#1D1D1F]'
            }`}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}>نوع رویداد:</span>
          <input
            dir="ltr"
            list="adm-actions"
            value={draft.action}
            onChange={(e) => setDraft({ ...draft, action: e.target.value })}
            placeholder="مثلاً login"
            className={`border rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/25 ${
              isDark ? 'bg-white/5 border-white/10 text-slate-100 placeholder-slate-500' : 'bg-[#F5F5F7] border-black/[0.06] text-[#1D1D1F]'
            }`}
          />
          <datalist id="adm-actions">{KNOWN_ACTIONS.map((a) => <option key={a} value={a} />)}</datalist>
        </div>
        <button
          type="submit"
          className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition-all shadow-sm shadow-emerald-500/25 cursor-pointer"
        >
          اعمال فیلتر
        </button>
        <button
          type="button"
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            isDark ? 'bg-white/10 hover:bg-white/15 text-slate-200' : 'bg-black/[0.05] hover:bg-black/[0.08] text-[#1D1D1F]'
          }`}
          onClick={reset}
        >
          پاک کردن
        </button>
      </form>

      {audit.error && <div className="banner err" role="alert">دریافت گزارش ناموفق بود.</div>}
      {audit.loading && !d && <div className="banner">در حال بارگذاری…</div>}
      {d && (d.rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className={`border-b ${isDark ? 'border-white/10 text-slate-400' : 'border-black/[0.06] text-[#86868B]'}`}>
                <th className="py-3 px-3 font-semibold">زمان</th>
                <th className="py-3 px-3 font-semibold">کاربر</th>
                <th className="py-3 px-3 font-semibold">رویداد</th>
                <th className="py-3 px-3 font-semibold">هدف</th>
                <th className="py-3 px-3 font-semibold">IP</th>
                <th className="py-3 px-3 font-semibold">جزئیات</th>
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r) => (
                <tr key={r.id} className={`border-b transition-colors ${
                  isDark ? 'border-white/[0.04] hover:bg-white/[0.03]' : 'border-black/[0.03] hover:bg-black/[0.015]'
                }`}>
                  <td className={`py-3 px-3 ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`} title={r.ts}>{when(r.ts)}</td>
                  <td className={`py-3 px-3 font-bold ${isDark ? 'text-slate-100' : 'text-[#1D1D1F]'}`} dir="ltr">{r.actor}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`} dir="ltr">
                      {r.action}
                    </span>
                  </td>
                  <td className={`py-3 px-3 ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`} dir="ltr">{[r.target_type, r.target].filter(Boolean).join(': ') || '—'}</td>
                  <td className={`py-3 px-3 ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`} dir="ltr">{r.ip || '—'}</td>
                  <td className="py-3 px-3">
                    {r.detail && Object.keys(r.detail).length ? (
                      <details className={`cursor-pointer ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                        <summary className="text-[11px] font-semibold hover:underline">نمایش JSON</summary>
                        <pre dir="ltr" className="mt-2 p-3 rounded-xl bg-[#0B100E] border border-emerald-500/20 text-slate-200 text-[10px] overflow-auto max-w-xs">{JSON.stringify(r.detail, null, 2)}</pre>
                      </details>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="text-center py-10 text-xs text-[#86868B]">رویدادی با این فیلتر پیدا نشد.</div>)}

      {d && count > AUDIT_PAGE && (
        <div className={`flex items-center justify-between pt-4 border-t mt-4 ${isDark ? 'border-white/10' : 'border-black/[0.05]'}`}>
          <button
            type="button"
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40 cursor-pointer ${
              isDark ? 'bg-white/10 hover:bg-white/15 text-slate-200' : 'bg-black/[0.05] hover:bg-black/[0.08] text-[#1D1D1F]'
            }`}
            disabled={offset === 0 || audit.loading}
            onClick={() => setOffset(Math.max(0, offset - AUDIT_PAGE))}
          >
            صفحهٔ قبل
          </button>
          <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}>
            ردیف {fa(offset + 1)} تا {fa(last)} از {fa(count)}
          </span>
          <button
            type="button"
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40 cursor-pointer ${
              isDark ? 'bg-white/10 hover:bg-white/15 text-slate-200' : 'bg-black/[0.05] hover:bg-black/[0.08] text-[#1D1D1F]'
            }`}
            disabled={offset + AUDIT_PAGE >= count || audit.loading}
            onClick={() => setOffset(offset + AUDIT_PAGE)}
          >
            صفحهٔ بعد
          </button>
        </div>
      )}
    </AppleCard>
  )
}

export default function AdminPage() {
  const { isDark, isSolid } = useAppearance()
  const [tab, setTab] = useState('users')
  const [ver, setVer] = useState(0)
  const bump = () => setVer((n) => n + 1)
  const options = useApi('/admin/options', {})
  const roles = useApi('/admin/roles', { v: ver })
  const failed = options.error || roles.error
  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 space-y-6">
      {/* Apple Tabs Bar */}
      <div className={`apple-card rounded-2xl sm:rounded-3xl border p-2.5 sm:p-3 flex items-center justify-between flex-wrap gap-3 transition-all ${
        isDark
          ? 'bg-[#0B100E]/75 backdrop-blur-2xl border-emerald-500/15 text-[#F5F5F7] shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
          : isSolid
          ? 'bg-white border-slate-200 text-[#1D1D1F] shadow-xs'
          : 'bg-white/85 backdrop-blur-xl border-black/[0.04] text-[#1D1D1F] shadow-[0_4px_20px_rgb(0,0,0,0.03)]'
      }`}>
        <div className={`flex items-center gap-1 p-1 rounded-2xl ${isDark ? 'bg-white/[0.06]' : 'bg-[#E8E8ED]/80'}`}>
          {[
            ['users', 'کاربران', Users],
            ['roles', 'نقش‌ها و دسترسی‌ها', KeyRound],
            ['audit', 'گزارش رویدادها', History],
          ].map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                tab === k
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-500/25'
                  : isDark
                  ? 'text-slate-300 hover:text-white hover:bg-white/10'
                  : 'text-[#1D1D1F] hover:bg-black/[0.05]'
              }`}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <span className={`text-xs font-medium px-2 ${isDark ? 'text-slate-400' : 'text-[#86868B]'}`}>مدیریت امنیت و کاربران سامانه</span>
      </div>

      {failed && <div className="banner err" role="alert">دریافت اطلاعات مدیریت ناموفق بود: {failed}</div>}
      {tab === 'audit' && <AuditTab />}
      {tab !== 'audit' && !failed && (!options.data || !roles.data) && <div className="banner">در حال بارگذاری…</div>}
      {tab === 'users' && options.data && roles.data && <UsersTab options={options.data} roles={roles.data} ver={ver} bump={bump} />}
      {tab === 'roles' && options.data && roles.data && <RolesTab options={options.data} roles={roles.data} bump={bump} />}
    </div>
  )
}

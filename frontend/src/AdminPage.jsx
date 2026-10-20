import { useMemo, useState } from 'react'
import { send, useApi } from './api'
import { fa } from './format'
import { NAV } from './ExecutiveDashboard'
import { Panel, Toggle } from './ui'

const PAGE_LABEL = Object.fromEntries(NAV.map(([id, label]) => [id, label]))
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

// Runs one mutation at a time and keeps the result message (backend `detail` text on failure).
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
  return <div className={`adm-msg ${msg.tone}`} role={msg.tone === 'err' ? 'alert' : 'status'}>{msg.text}</div>
}

function Checks({ items, value, onChange, label }) {
  return (
    <div className="adm-checks" role="group" aria-label={label}>
      {items.map(([id, text, hint]) => (
        <label key={id} className="adm-check">
          <input type="checkbox" checked={value.includes(id)} onChange={() => onChange(toggleIn(value, id))} />
          <span>{text}</span>{hint && <small>{hint}</small>}
        </label>
      ))}
    </div>
  )
}

function ScopePicker({ mode, options, branches, supervisors, onBranches, onSupervisors }) {
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
  if (!mode) return <p className="adm-hint">برای تعیین دامنهٔ داده، ابتدا نقش را انتخاب کنید.</p>
  if (mode === 'all') return <p className="adm-hint">{SCOPE_HINT.all}</p>
  if (mode === 'branch') {
    const list = options.branches ?? []
    return (
      <>
        <p className="adm-hint">{SCOPE_HINT.branch}</p>
        {!list.length && <p className="adm-hint">فهرست شعبه‌ها هنوز از داده خوانده نشده است.</p>}
        <Checks items={list.map((b) => [b, b])} value={branches} onChange={onBranches} label="شعبه‌ها" />
        {branches.length > 0 && <p className="adm-hint">{fa(branches.length)} شعبه انتخاب شده است.</p>}
        {branches.length === 0 && <div className="adm-msg warn" role="status">هیچ شعبه‌ای انتخاب نشده است؛ این کاربر هیچ دادهٔ فروشی نمی‌بیند.</div>}
      </>
    )
  }
  const needle = q.trim().toLowerCase()
  const shown = people.filter((p) => (!branchFilter || p.branches.includes(branchFilter)) && (!needle || p.name.toLowerCase().includes(needle)))
  return (
    <>
      <p className="adm-hint">{SCOPE_HINT.supervisor}</p>
      <div className="adm-scope-tools">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی سرپرست…" aria-label="جستجوی سرپرست" />
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} aria-label="فیلتر شعبه">
          <option value="">همهٔ شعبه‌ها</option>
          {(options.branches ?? []).map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <button type="button" className="btn ghost" onClick={() => onSupervisors([...new Set([...supervisors, ...shown.map((p) => p.name)])])} disabled={!shown.length}>انتخاب نمایش‌داده‌شده‌ها</button>
        <button type="button" className="btn ghost" onClick={() => onSupervisors([])} disabled={!supervisors.length}>پاک کردن انتخاب</button>
      </div>
      {!people.length && <p className="adm-hint">فهرست سرپرست‌ها هنوز از داده خوانده نشده است.</p>}
      <Checks items={shown.map((p) => [p.name, p.name, p.branches.join('، ')])} value={supervisors} onChange={onSupervisors} label="سرپرست‌ها" />
      {supervisors.length > 0 && <p className="adm-hint">{fa(supervisors.length)} سرپرست انتخاب شده است.</p>}
      {supervisors.length === 0 && <div className="adm-msg warn" role="status">هیچ سرپرستی انتخاب نشده است؛ این کاربر هیچ دادهٔ فروشی نمی‌بیند.</div>}
    </>
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
    <Panel title="کاربران" note={users.data ? `${fa(users.data.length)} کاربر` : ''} full>
      <div className="adm-bar">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی کاربر…" aria-label="جستجوی کاربر" />
        <button type="button" className="btn" onClick={() => open(null)} disabled={!roles.length}>کاربر جدید</button>
      </div>
      {!roles.length && <div className="adm-msg warn" role="status">برای ساخت کاربر ابتدا در زبانهٔ «نقش‌ها» یک نقش بسازید.</div>}
      <Msg msg={act.msg} />

      {form && (
        <form className="adm-form" onSubmit={submit} aria-label={form.id == null ? 'کاربر جدید' : 'ویرایش کاربر'}>
          <h3>{form.id == null ? 'کاربر جدید' : `ویرایش «${form.username}»`}</h3>
          <div className="adm-grid">
            <label className="field"><span>نام کاربری</span>
              <input dir="ltr" value={form.username} onChange={(e) => set({ username: e.target.value })} required={form.id == null} disabled={form.id != null} autoComplete="off" />
            </label>
            <label className="field"><span>نام نمایشی</span>
              <input value={form.display_name} onChange={(e) => set({ display_name: e.target.value })} maxLength={100} />
            </label>
            <label className="field"><span>{form.id == null ? 'رمز عبور (حداقل ۸ نویسه)' : 'رمز عبور جدید (اختیاری)'}</span>
              <input type="password" dir="ltr" value={form.password} onChange={(e) => set({ password: e.target.value })} required={form.id == null} minLength={8} autoComplete="new-password" />
            </label>
            <label className="field"><span>نقش</span>
              <select value={form.role_id} onChange={(e) => changeRole(e.target.value)} required>
                <option value="">انتخاب نقش…</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label className="adm-check adm-inline">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set({ is_active: e.target.checked })} /><span>حساب فعال</span>
            </label>
          </div>
          <fieldset className="adm-fieldset">
            <legend>دامنهٔ داده{mode ? ` · ${SCOPE_LABEL[mode] ?? mode}` : ''}</legend>
            <ScopePicker
              key={mode} mode={mode} options={options} branches={form.branches} supervisors={form.supervisors}
              onBranches={(v) => set({ branches: v })} onSupervisors={(v) => set({ supervisors: v })}
            />
          </fieldset>
          <div className="adm-actions">
            <button type="submit" className="btn" disabled={act.busy}>{form.id == null ? 'ایجاد کاربر' : 'ذخیره'}</button>
            <button type="button" className="btn ghost" onClick={() => { setForm(null); act.setMsg(null) }}>انصراف</button>
          </div>
        </form>
      )}

      {users.error && <div className="banner err" role="alert">دریافت کاربران ناموفق بود.</div>}
      {users.loading && !users.data && <div className="banner">در حال بارگذاری…</div>}
      {users.data && (rows.length ? (
        <div className="table-wrap adm-table">
          <table>
            <thead><tr><th>نام کاربری</th><th>نام نمایشی</th><th>نقش</th><th>دامنهٔ داده</th><th>وضعیت</th><th>عملیات</th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td dir="ltr">{u.username}</td>
                  <td>{u.display_name || '—'}</td>
                  <td>{u.role}{u.is_admin && <span className="adm-badge admin">مدیر</span>}</td>
                  <td>{scopeText(u)}{emptyScope(u) && <span className="adm-badge warn">بدون دامنه</span>}</td>
                  <td><span className={`adm-badge ${u.is_active ? 'ok' : 'off'}`}>{u.is_active ? 'فعال' : 'غیرفعال'}</span></td>
                  <td className="adm-row-actions">
                    <button type="button" className="btn ghost" onClick={() => open(u)}>ویرایش</button>
                    {u.is_active
                      ? <button type="button" className="btn ghost danger" onClick={() => deactivate(u)} disabled={act.busy}>غیرفعال‌سازی</button>
                      : <button type="button" className="btn ghost" onClick={() => reactivate(u)} disabled={act.busy}>فعال‌سازی</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="empty">{users.data.length ? 'کاربری با این جستجو پیدا نشد.' : 'هنوز کاربری ساخته نشده است.'}</div>)}
    </Panel>
  )
}

/* ---------- نقش‌ها ---------- */
const NEW_ROLE = { id: null, name: '', description: '', pages: [], cores: [], scope_mode: 'all', is_admin: false, user_count: 0, original_mode: 'all' }

function RolesTab({ options, roles, bump }) {
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
    <Panel title="نقش‌ها" note={`${fa(roles.length)} نقش`} full>
      <div className="adm-bar">
        <button type="button" className="btn" onClick={() => open(null)}>نقش جدید</button>
        <button type="button" className="btn ghost" onClick={seed} disabled={act.busy}>ساخت نقش‌های پیش‌فرض</button>
      </div>
      <Msg msg={act.msg} />

      {form && (
        <form className="adm-form" onSubmit={submit} aria-label={form.id == null ? 'نقش جدید' : 'ویرایش نقش'}>
          <h3>{form.id == null ? 'نقش جدید' : `ویرایش «${form.name}»`}</h3>
          <div className="adm-grid">
            <label className="field"><span>نام نقش</span>
              <input value={form.name} onChange={(e) => set({ name: e.target.value })} required minLength={2} maxLength={60} />
            </label>
            <label className="field adm-wide"><span>توضیح</span>
              <input value={form.description} onChange={(e) => set({ description: e.target.value })} maxLength={300} />
            </label>
            <label className="field"><span>دامنهٔ داده</span>
              <select value={form.scope_mode} onChange={(e) => set({ scope_mode: e.target.value })} disabled={locked}>
                {(options.scope_modes ?? ['all', 'branch', 'supervisor']).map((m) => <option key={m} value={m}>{SCOPE_LABEL[m] ?? m}</option>)}
              </select>
            </label>
          </div>
          {locked && <p className="adm-hint">دامنهٔ داده تا وقتی نقش به کاربری داده شده تغییر نمی‌کند ({fa(form.user_count)} کاربر).</p>}
          <fieldset className="adm-fieldset">
            <legend>صفحه‌های مجاز</legend>
            <div className="adm-scope-tools">
              <button type="button" className="btn ghost" onClick={() => set({ pages: pageItems.map(([id]) => id) })}>انتخاب همه</button>
              <button type="button" className="btn ghost" onClick={() => set({ pages: [] })}>پاک کردن</button>
            </div>
            <Checks items={pageItems} value={form.pages} onChange={(v) => set({ pages: v })} label="صفحه‌های مجاز" />
          </fieldset>
          <fieldset className="adm-fieldset">
            <legend>هسته‌های مجاز</legend>
            <Checks items={coreItems} value={form.cores} onChange={(v) => set({ cores: v })} label="هسته‌های مجاز" />
          </fieldset>
          <label className="adm-check adm-inline">
            <input type="checkbox" checked={form.is_admin} onChange={(e) => set({ is_admin: e.target.checked })} />
            <span>دسترسی مدیریت (کاربران، نقش‌ها، گزارش رویدادها و به‌روزرسانی داده)</span>
          </label>
          <p className="adm-hint">دسترسی مدیریت جدا از دیدن گزارش‌هاست؛ دیدن همهٔ صفحه‌ها یا همهٔ داده‌ها به‌تنهایی مدیر نمی‌سازد.</p>
          <div className="adm-actions">
            <button type="submit" className="btn" disabled={act.busy}>{form.id == null ? 'ایجاد نقش' : 'ذخیره'}</button>
            <button type="button" className="btn ghost" onClick={() => { setForm(null); act.setMsg(null) }}>انصراف</button>
          </div>
        </form>
      )}

      {roles.length ? (
        <div className="table-wrap adm-table">
          <table>
            <thead><tr><th>نقش</th><th>صفحه‌ها</th><th>هسته‌ها</th><th>دامنهٔ داده</th><th>کاربران</th><th>عملیات</th></tr></thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.name}</b>{r.is_admin && <span className="adm-badge admin">مدیر</span>}{r.description && <small className="adm-sub">{r.description}</small>}</td>
                  <td title={r.pages.map((p) => PAGE_LABEL[p] ?? p).join('، ')}>{fa(r.pages.length)} از {fa((options.pages ?? []).length)}</td>
                  <td>{r.cores.map((c) => options.cores?.[c] ?? c).join('، ') || '—'}</td>
                  <td>{SCOPE_LABEL[r.scope_mode] ?? r.scope_mode}</td>
                  <td>{fa(r.user_count)}</td>
                  <td className="adm-row-actions">
                    <button type="button" className="btn ghost" onClick={() => open(r)}>ویرایش</button>
                    <button type="button" className="btn ghost danger" onClick={() => remove(r)} disabled={act.busy || r.user_count > 0} title={r.user_count > 0 ? 'نقشی که به کاربر داده شده حذف نمی‌شود' : undefined}>حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="empty">هنوز نقشی ساخته نشده است. با «ساخت نقش‌های پیش‌فرض» می‌توانید شروع کنید.</div>}
    </Panel>
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
    <Panel title="گزارش رویدادها" note={d ? `${fa(count)} رویداد` : ''} full>
      <form className="adm-bar adm-filters" onSubmit={apply}>
        <label className="field"><span>کاربر (مطابقت کامل)</span>
          <input dir="ltr" value={draft.actor} onChange={(e) => setDraft({ ...draft, actor: e.target.value })} autoComplete="off" />
        </label>
        <label className="field"><span>رویداد (مطابقت کامل)</span>
          <input dir="ltr" list="adm-actions" value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })} autoComplete="off" />
          <datalist id="adm-actions">{KNOWN_ACTIONS.map((a) => <option key={a} value={a} />)}</datalist>
        </label>
        <button type="submit" className="btn">اعمال فیلتر</button>
        <button type="button" className="btn ghost" onClick={reset}>پاک کردن</button>
      </form>
      {audit.error && <div className="banner err" role="alert">دریافت گزارش ناموفق بود.</div>}
      {audit.loading && !d && <div className="banner">در حال بارگذاری…</div>}
      {d && (d.rows.length ? (
        <div className="table-wrap adm-table">
          <table>
            <thead><tr><th>زمان</th><th>کاربر</th><th>رویداد</th><th>هدف</th><th>IP</th><th>جزئیات</th></tr></thead>
            <tbody>
              {d.rows.map((r) => (
                <tr key={r.id}>
                  <td title={r.ts}>{when(r.ts)}</td>
                  <td dir="ltr">{r.actor}</td>
                  <td dir="ltr">{r.action}</td>
                  <td dir="ltr">{[r.target_type, r.target].filter(Boolean).join(': ') || '—'}</td>
                  <td dir="ltr">{r.ip || '—'}</td>
                  <td>
                    {r.detail && Object.keys(r.detail).length
                      ? <details className="adm-detail"><summary>نمایش</summary><pre dir="ltr">{JSON.stringify(r.detail, null, 2)}</pre></details>
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="empty">رویدادی با این فیلتر پیدا نشد.</div>)}
      {d && count > AUDIT_PAGE && (
        <div className="toolbar adm-pager">
          <button type="button" className="btn ghost" disabled={offset === 0 || audit.loading} onClick={() => setOffset(Math.max(0, offset - AUDIT_PAGE))}>صفحهٔ قبل</button>
          <span className="tbl-count" role="status" aria-live="polite">ردیف {fa(offset + 1)} تا {fa(last)} از {fa(count)}</span>
          <button type="button" className="btn ghost" disabled={offset + AUDIT_PAGE >= count || audit.loading} onClick={() => setOffset(offset + AUDIT_PAGE)}>صفحهٔ بعد</button>
        </div>
      )}
    </Panel>
  )
}

export default function AdminPage() {
  const [tab, setTab] = useState('users')
  const [ver, setVer] = useState(0)
  const bump = () => setVer((n) => n + 1)
  const options = useApi('/admin/options', {})
  const roles = useApi('/admin/roles', { v: ver })
  const failed = options.error || roles.error
  return (
    <div className="adm">
      <Toggle label="بخش‌های مدیریت" value={tab} onChange={setTab} options={[['users', 'کاربران'], ['roles', 'نقش‌ها'], ['audit', 'گزارش رویدادها']]} />
      {failed && <div className="banner err" role="alert">دریافت اطلاعات مدیریت ناموفق بود: {failed}</div>}
      {tab === 'audit' && <AuditTab />}
      {tab !== 'audit' && !failed && (!options.data || !roles.data) && <div className="banner">در حال بارگذاری…</div>}
      {tab === 'users' && options.data && roles.data && <UsersTab options={options.data} roles={roles.data} ver={ver} bump={bump} />}
      {tab === 'roles' && options.data && roles.data && <RolesTab options={options.data} roles={roles.data} bump={bump} />}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { fa } from './format'

export const pct = (v, d = 1) => (v == null ? '—' : `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: d }).format(v * 100)}٪`)
export const rial = (v) => fa(v)

export function Kpi({ label, value, unit, tone, hint }) {
  return (
    <div className={`kpi ${tone ?? ''}`}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      <span className="kpi-unit">{unit}</span>
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  )
}

export function ChartTip({ active, payload, label, labelFn, unit, valueFn }) {
  if (!active || !payload?.length) return null
  return (
    <div className="tip backdrop-blur-xl border border-white/10 dark:bg-[#1C1C1E]/95 dark:text-white bg-slate-900/95 text-white">
      <b className="block mb-1 font-bold">{labelFn ? labelFn(label) : label}</b>
      {payload.map((p) => {
        let displayVal
        if (valueFn) {
          displayVal = valueFn(p.value, p)
        } else if (typeof p.value === 'number') {
          if (p.value !== 0 && (Math.abs(p.value) < 10 || p.value % 1 !== 0)) {
            displayVal = Number(p.value).toLocaleString('fa-IR', { maximumFractionDigits: 2 })
          } else {
            displayVal = fa(p.value)
          }
        } else {
          displayVal = fa(p.value)
        }
        return (
          <div key={p.dataKey} className="flex items-center gap-1.5 py-0.5 text-xs">
            <i style={{ background: p.color || p.fill }} className="w-2 h-2 rounded-xs inline-block ml-1.5 shrink-0" />
            <span className="font-medium text-slate-200">{p.name}:</span>
            <span className="font-bold tabular-nums text-white">{displayVal}</span>
            {unit && <span className="text-[11px] text-slate-300 font-normal">{unit}</span>}
          </div>
        )
      })}
    </div>
  )
}

export function Panel({ title, note, full, children }) {
  return (
    <div className={`panel ${full ? 'full' : ''}`}>
      <div className="panel-head"><h2>{title}</h2>{note && <span>{note}</span>}</div>
      {children}
    </div>
  )
}

export function Status({ state, children }) {
  if (state.error) return <div className="banner err" role="alert">دریافت داده ناموفق بود.</div>
  if (state.loading && !state.data) return <div className="banner">در حال بارگذاری…</div>
  if (!state.data) return null
  return children(state.data)
}

export function Toggle({ value, options, onChange, label }) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map(([k, v]) => (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)} type="button">{v}</button>
      ))}
    </div>
  )
}

const cell = (c, r) => (c.value ? c.value(r) : c.render(r))
const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

function downloadCsv(name, columns, rows) {
  const head = columns.map((c) => csvEscape(c.unit ? `${c.label} (${c.unit})` : c.label)).join(',')
  const body = rows.map((r) => columns.map((c) => csvEscape(cell(c, r))).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + head + '\r\n' + body], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `${name}.csv` })
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// columns: { label, render, value?, unit? } — value is the raw sortable/exportable number (or text); unit is added to the CSV header.
export function Table({ columns, rows, onRow, highlight, name = 'گزارش', pageSize, footer }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState(null)
  const [page, setPage] = useState(0)
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let out = needle
      ? rows.filter((r) => columns.map((c) => `${c.render(r)} ${c.value ? c.value(r) : ''}`).join(' ').toLowerCase().includes(needle))
      : rows
    if (sort) {
      const c = columns[sort.i]
      const dir = sort.dir === 'asc' ? 1 : -1
      out = [...out].sort((a, b) => {
        const x = cell(c, a), y = cell(c, b)
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), 'fa')) * dir
      })
    }
    return out
  }, [rows, columns, q, sort])
  // Optional client-side paging: search, sort and CSV still work on all rows; only the rendered slice is paged.
  useEffect(() => { setPage(0) }, [rows, q, sort])
  const pages = pageSize ? Math.max(1, Math.ceil(shown.length / pageSize)) : 1
  const cur = Math.min(page, pages - 1)
  const visible = pageSize ? shown.slice(cur * pageSize, (cur + 1) * pageSize) : shown
  const nextSort = (i) => setSort((s) => (!s || s.i !== i ? { i, dir: 'desc' } : s.dir === 'desc' ? { i, dir: 'asc' } : null))
  if (!rows.length) return <div className="empty">داده‌ای برای این فیلترها وجود ندارد.</div>
  return (
    <div className="smart-table-surface p-4 sm:p-5 my-4 transition-all">
      <div className="tbl-tools flex items-center justify-between gap-3 mb-3 flex-wrap">
        {rows.length > 6 && (
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجو در جدول…"
            aria-label="جستجو در جدول"
            className="rounded-xl px-3 py-1.5 text-xs bg-black/[0.04] dark:bg-white/10 border-0 text-[#1D1D1F] dark:text-[#F5F5F7] focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
          />
        )}
        <span className="tbl-count text-xs text-[#86868B] dark:text-[#98989D] tabular-nums font-semibold mr-auto">
          {q ? `${fa(shown.length)} از ${fa(rows.length)} ردیف` : `${fa(rows.length)} ردیف`}
        </span>
        <button
          type="button"
          className="tbl-export rounded-xl px-3.5 py-1.5 text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 transition-colors shadow-2xs cursor-pointer"
          onClick={() => downloadCsv(name, columns, shown)}
        >
          خروجی CSV (اکسل)
        </button>
      </div>

      <div className="table-wrap w-full overflow-x-auto no-scrollbar rounded-2xl">
        <table className="w-full text-right border-collapse tabular-nums">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={c.label} className="whitespace-nowrap select-none" aria-sort={sort?.i === i ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="th-sort font-bold flex items-center gap-1 hover:text-emerald-400 transition-colors cursor-pointer" onClick={() => nextSort(i)}>
                    <span>{c.label}</span>
                    <span aria-hidden="true" className="text-emerald-400">{sort?.i === i ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={i} className={`transition-colors ${highlight?.(r) ? 'sel' : ''}`} onClick={onRow ? () => onRow(r) : undefined} style={onRow ? undefined : { cursor: 'default' }}>
                {columns.map((c) => <td key={c.label} className="whitespace-nowrap">{c.render(r)}</td>)}
              </tr>
            ))}
          </tbody>
          {footer && rows.length > 0 && (
            <tfoot>
              <tr className="font-extrabold bg-black/[0.04] dark:bg-white/[0.05] border-t-2 border-black/[0.08] dark:border-white/10 text-[#1D1D1F] dark:text-[#F5F5F7]">
                {columns.map((c, i) => (
                  <td key={c.label} className="whitespace-nowrap py-3 px-3">
                    {typeof footer[i] === 'function' ? footer[i](rows) : (footer[i] ?? (i === 0 ? 'مجموع' : '—'))}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
        {!shown.length && <div className="empty text-center py-8 text-xs text-[#86868B]">ردیفی با این جستجو پیدا نشد.</div>}
      </div>

      {pageSize && shown.length > pageSize && (
        <div className="toolbar flex items-center justify-between gap-3 mt-4 pt-3 border-t border-black/[0.04] dark:border-white/5">
          <button className="btn ghost text-xs px-3 py-1.5 rounded-xl border border-black/[0.08] dark:border-white/10" type="button" disabled={cur === 0} onClick={() => setPage(cur - 1)}>
            صفحهٔ قبل
          </button>
          <span className="tbl-count text-xs text-[#86868B] dark:text-[#98989D] tabular-nums" role="status" aria-live="polite">
            صفحهٔ {fa(cur + 1)} از {fa(pages)} · ردیف {fa(cur * pageSize + 1)} تا {fa(Math.min((cur + 1) * pageSize, shown.length))} از {fa(shown.length)}
          </span>
          <button className="btn ghost text-xs px-3 py-1.5 rounded-xl border border-black/[0.08] dark:border-white/10" type="button" disabled={cur + 1 >= pages} onClick={() => setPage(cur + 1)}>
            صفحهٔ بعد
          </button>
        </div>
      )}
    </div>
  )
}

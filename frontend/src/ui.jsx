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

export function ChartTip({ active, payload, label, labelFn, unit }) {
  if (!active || !payload?.length) return null
  return (
    <div className="tip">
      <b>{labelFn ? labelFn(label) : label}</b>
      {payload.map((p) => (
        <div key={p.dataKey}><i style={{ background: p.color || p.fill }} />{p.name}: {fa(p.value)} {unit}</div>
      ))}
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
export function Table({ columns, rows, onRow, highlight, name = 'گزارش', pageSize }) {
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
    <>
      <div className="tbl-tools">
        {rows.length > 6 && <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو در جدول…" aria-label="جستجو در جدول" />}
        <span className="tbl-count">{q ? `${fa(shown.length)} از ${fa(rows.length)} ردیف` : `${fa(rows.length)} ردیف`}</span>
        <button type="button" className="tbl-export" onClick={() => downloadCsv(name, columns, shown)}>خروجی CSV (اکسل)</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={c.label} aria-sort={sort?.i === i ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="th-sort" onClick={() => nextSort(i)}>
                    {c.label}<span aria-hidden="true">{sort?.i === i ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={i} className={highlight?.(r) ? 'sel' : ''} onClick={onRow ? () => onRow(r) : undefined} style={onRow ? undefined : { cursor: 'default' }}>
                {columns.map((c) => <td key={c.label}>{c.render(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && <div className="empty">ردیفی با این جستجو پیدا نشد.</div>}
      </div>
      {pageSize && shown.length > pageSize && (
        <div className="toolbar" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn ghost" type="button" disabled={cur === 0} onClick={() => setPage(cur - 1)}>صفحهٔ قبل</button>
          <span className="tbl-count" role="status" aria-live="polite">
            صفحهٔ {fa(cur + 1)} از {fa(pages)} · ردیف {fa(cur * pageSize + 1)} تا {fa(Math.min((cur + 1) * pageSize, shown.length))} از {fa(shown.length)}
          </span>
          <button className="btn ghost" type="button" disabled={cur + 1 >= pages} onClick={() => setPage(cur + 1)}>صفحهٔ بعد</button>
        </div>
      )}
    </>
  )
}

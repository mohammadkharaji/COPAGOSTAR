import { fa, faDigits, monthLabel } from '../format'
import { Table } from '../ui'

// The leaderboard the ladder plan returns: one row per visitor, one column per month of the plan.
export default function LadderLeaderboard({ data, onSelect }) {
  const months = data?.months ?? []
  const rows = (data?.rows ?? []).map((r) => ({ ...r, _key: r.code }))

  const columns = [
    { label: 'رتبه', render: (r) => <span className="font-bold text-[#1D1D1F]">{fa(r.rank_national ?? '—')}</span>, value: (r) => r.rank_national ?? 0 },
    { label: 'درجه', render: (r) => <b className="font-bold text-[#1D1D1F]">{r.grade ?? '—'}</b>, value: (r) => r.grade ?? '' },
    { label: 'نام', render: (r) => r.name, value: (r) => r.name },
    { label: 'شعبه', render: (r) => r.branch ?? '—', value: (r) => r.branch ?? '' },
    ...months.map((m) => ({
      label: m.completed ? monthLabel(m.month) : `${monthLabel(m.month)} (در جریان)`,
      render: (r) => <span className="tabular-nums">{fa(Number((r.months?.[m.month] ?? 0).toFixed(2)))}</span>,
      value: (r) => r.months?.[m.month] ?? 0,
    })),
    { label: 'جمع', render: (r) => <span className="tabular-nums font-extrabold text-[#0071E3]">{fa(Number((r.total ?? 0).toFixed(2)))}</span>, value: (r) => r.total ?? 0 },
    { label: 'میانگین', render: (r) => <span className="tabular-nums">{fa(Number((r.average ?? 0).toFixed(2)))}</span>, value: (r) => r.average ?? 0 },
    { label: 'ماه‌ها', render: (r) => faDigits(r.tenure ?? 0), value: (r) => r.tenure ?? 0 },
    { label: 'جایزه', render: (r) => (r.prize ? fa(r.prize) : '—'), value: (r) => r.prize ?? 0 },
  ]

  return <Table name="جدول رتبه‌بندی نردبان" rows={rows} columns={columns} onRow={onSelect ? (r) => onSelect(r.code) : undefined} />
}

import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { motion } from 'motion/react'
import { Award, CircleDollarSign, Users, Sparkles, Store, TrendingUp, Calendar, Plus, Trash2 } from 'lucide-react'
import { postJson, useApi } from './api'
import { fa, faDigits, monthLabel } from './format'
import { Table } from './ui'

// One page per club, both backed by the same /api/club/<kind>/... routes. `kind` is 'b2b' or 'visitor'.
const CLUBS = {
  b2b: { title: 'باشگاه مشتریان (B2B)', codeLabel: 'کد مشتری' },
  visitor: { title: 'باشگاه ویزیتورها', codeLabel: 'کد ویزیتور' },
}
const TIER_TONE = { 'پله ۱': '#b45309', 'پله ۲': '#64748b', 'پله ۳': '#ca8a04', 'پله ۴': '#6d28d9' }

function AppleCard({ title, subtitle, badge, action, children, className = '' }) {
  return (
    <div className={`rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 ${className}`}>
      {(title || subtitle || badge || action) && (
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div>
            {title && <h2 className="text-base font-bold text-[#1D1D1F]">{title}</h2>}
            {subtitle && <p className="text-xs text-[#86868B] mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {badge && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#0071E3]/10 text-[#0071E3]">
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

function AppleKpiCard({ label, value, unit, icon: Icon, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-500/10 text-blue-600',
    teal: 'bg-teal-500/10 text-teal-600',
    amber: 'bg-amber-500/10 text-amber-600',
    violet: 'bg-violet-500/10 text-violet-600',
    pink: 'bg-pink-500/10 text-pink-600',
  }
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="rounded-3xl bg-white/85 backdrop-blur-xl border border-black/[0.04] shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-5 flex flex-col justify-between hover:shadow-[0_12px_30px_rgb(0,0,0,0.07)] transition-shadow text-right"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[#86868B]">{label}</span>
        <div className={`w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 ${tones[tone] || tones.blue}`}>
          {Icon ? <Icon size={16} /> : null}
        </div>
      </div>
      <div>
        <div className="text-xl font-extrabold text-[#1D1D1F] tracking-tight tabular-nums truncate">{value}</div>
        <div className="text-[11px] text-[#86868B] mt-1 truncate">{unit}</div>
      </div>
    </motion.div>
  )
}

function Progress({ value, label }) {
  const pctv = Math.round((value ?? 0) * 100)
  return (
    <div className="space-y-1.5" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pctv} aria-label={label}>
      <div className="h-2.5 bg-black/[0.06] rounded-full overflow-hidden p-0.5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#0071E3] to-[#34C759] transition-all duration-500"
          style={{ width: `${Math.min(pctv, 100)}%` }}
        />
      </div>
      <div className="flex justify-between items-center text-[11px] text-[#86868B]">
        <span>{label}</span>
        <span className="font-bold text-[#1D1D1F] tabular-nums">{faDigits(pctv)}٪</span>
      </div>
    </div>
  )
}

function TierBadge({ tier }) {
  if (!tier?.target_points) return null
  const tone = TIER_TONE[tier.level] ?? '#64748b'
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
      style={{ background: `${tone}18`, color: tone, border: `1px solid ${tone}44` }}
    >
      {tier.level}
    </span>
  )
}

function PointsChart({ history, name }) {
  const data = (history ?? []).map((h) => ({ ...h, label: monthLabel(h.month) }))
  if (!data.length) return <div className="text-center py-10 text-xs text-[#86868B]">داده‌ای برای نمایش نیست.</div>
  return (
    <div className="h-72 w-full mt-2" dir="ltr" role="img" aria-label={name}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="appleClubBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0071E3" />
              <stop offset="100%" stopColor="#42A1EC" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#E5E5EA" strokeDasharray="3 3" />
          <XAxis dataKey="label" reversed tickLine={false} axisLine={false} tick={{ fill: '#86868B', fontSize: 12 }} />
          <YAxis orientation="right" tickFormatter={(v) => fa(v)} tickLine={false} axisLine={false} width={50} tick={{ fill: '#86868B', fontSize: 12 }} />
          <Tooltip formatter={(v) => [fa(v), 'امتیاز']} />
          <Bar dataKey="points" name="امتیاز" fill="url(#appleClubBar)" radius={[8, 8, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function PlanForm({ kind, core, onCreated }) {
  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [rate, setRate] = useState('')
  const [target, setTarget] = useState('')
  const [rules, setRules] = useState([])
  const [msg, setMsg] = useState('')
  const setRule = (i, k, v) => setRules((rs) => rs.map((r, n) => (n === i ? { ...r, [k]: v } : r)))
  const submit = (e) => {
    e.preventDefault()
    const body = {
      name, core,
      start_key: Number(start.replace(/\D/g, '')),
      end_key: Number(end.replace(/\D/g, '')),
      rial_per_point: Number(rate),
      target_points: target ? Number(target.replace(/\D/g, '')) : null,
      rules: rules.filter((r) => Number(r.ratio) > 0).map((r) => ({
        label: r.label, metric: r.metric, ratio: Number(r.ratio), factor: Number(r.factor) || 0,
        brand: r.brand || null, main_group: null, new_customers: false,
      })),
    }
    postJson(`/club/${kind}/plans`, body)
      .then(() => { setMsg('طرح ذخیره شد.'); setName(''); setStart(''); setEnd(''); setRate(''); setTarget(''); onCreated() })
      .catch((err) => setMsg(err.message))
  }
  return (
    <form onSubmit={submit} className="mb-6 p-5 rounded-2xl bg-[#F5F5F7] border border-black/[0.05] space-y-4" dir="rtl">
      <h3 className="text-sm font-bold text-[#1D1D1F]">تعریف طرح جدید گیمیفیکیشن</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#86868B] mb-1">نام طرح</label>
          <input className="w-full bg-white border border-black/[0.08] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/25" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#86868B] mb-1">شروع (۱۴۰۵۰۷۰۱)</label>
          <input className="w-full bg-white border border-black/[0.08] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/25" value={start} onChange={(e) => setStart(e.target.value)} required inputMode="numeric" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#86868B] mb-1">پایان (۱۴۰۵۰۷۳۰)</label>
          <input className="w-full bg-white border border-black/[0.08] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/25" value={end} onChange={(e) => setEnd(e.target.value)} required inputMode="numeric" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#86868B] mb-1">ریال به ازای امتیاز</label>
          <input className="w-full bg-white border border-black/[0.08] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/25" value={rate} onChange={(e) => setRate(e.target.value)} required inputMode="numeric" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#86868B] mb-1">هدف امتیاز (اختیاری)</label>
          <input className="w-full bg-white border border-black/[0.08] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/25" value={target} onChange={(e) => setTarget(e.target.value)} inputMode="numeric" />
        </div>
      </div>

      <div className="p-4 rounded-xl bg-white border border-black/[0.05] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#1D1D1F]">پارامترهای امتیازدهی</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0071E3]/10 text-[#0071E3] hover:bg-[#0071E3]/20 transition-colors"
            onClick={() => setRules((rs) => [...rs, { label: '', metric: 'rial', ratio: '100000', factor: '1', brand: '', new_customers: false }])}
          >
            <Plus size={13} />
            <span>افزودن پارامتر</span>
          </button>
        </div>
        <p className="text-[11px] text-[#86868B]">اگر خالی بماند: امتیاز = فروش خالص ÷ ریال به ازای هر امتیاز.</p>
        {rules.map((r, i) => (
          <div className="flex items-center gap-2 flex-wrap bg-[#F5F5F7] p-2.5 rounded-xl border border-black/[0.03]" key={i}>
            <input className="bg-white border border-black/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-[#1D1D1F]" placeholder="عنوان" value={r.label} onChange={(e) => setRule(i, 'label', e.target.value)} />
            <select className="bg-white border border-black/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-[#1D1D1F]" value={r.metric} onChange={(e) => setRule(i, 'metric', e.target.value)}>
              <option value="rial">ریال فروش</option><option value="qty">تعداد قلم</option>
              <option value="lines">سطر فاکتور</option><option value="customers">تعداد مشتری</option>
            </select>
            <input className="bg-white border border-black/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-[#1D1D1F] w-24" placeholder="نسبت" inputMode="numeric" value={r.ratio} onChange={(e) => setRule(i, 'ratio', e.target.value)} />
            <input className="bg-white border border-black/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-[#1D1D1F] w-20" placeholder="ضریب" inputMode="numeric" value={r.factor} onChange={(e) => setRule(i, 'factor', e.target.value)} />
            <input className="bg-white border border-black/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-[#1D1D1F] w-28" placeholder="برند (اختیاری)" value={r.brand} onChange={(e) => setRule(i, 'brand', e.target.value)} />
            <button type="button" className="text-rose-600 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors mr-auto" onClick={() => setRules((rs) => rs.filter((_, n) => n !== i))}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-sm shadow-blue-500/25 transition-all">
          ثبت طرح
        </button>
        {msg && <p className="text-xs font-semibold text-emerald-700" role="status">{msg}</p>}
      </div>
    </form>
  )
}

function PlanDefinition({ kind, core }) {
  const [tick, setTick] = useState(0)
  const plans = useApi(`/club/${kind}/plans`, { core, v: tick })
  const rows = (plans.data?.plans ?? []).map((p) => ({ ...p, _key: p.id }))
  return (
    <AppleCard title="تعریف و مدیریت طرح‌ها" subtitle="طرح‌های فعال گیمیفیکیشن باشگاه" badge={`${rows.length} طرح`}>
      <PlanForm kind={kind} core={core} onCreated={() => setTick((n) => n + 1)} />
      <Table name="طرح‌ها" rows={rows} columns={[
        { label: 'نام', render: (r) => <b className="font-bold text-[#1D1D1F]">{r.name}</b>, value: (r) => r.name },
        { label: 'شروع', render: (r) => faDigits(r.start_key), value: (r) => r.start_key },
        { label: 'پایان', render: (r) => faDigits(r.end_key), value: (r) => r.end_key },
        { label: 'ریال به ازای امتیاز', render: (r) => fa(r.rial_per_point), value: (r) => r.rial_per_point },
        { label: 'هدف امتیاز', render: (r) => (r.target_points ? fa(r.target_points) : '—'), value: (r) => r.target_points ?? 0 },
      ]} />
    </AppleCard>
  )
}

function PointsView({ kind, core }) {
  const plans = useApi(`/club/${kind}/plans`, { core })
  const [planId, setPlanId] = useState(null)
  const chosen = planId ?? plans.data?.plans?.[0]?.id ?? null
  const points = useApi(`/club/${kind}/points`, { plan_id: chosen ?? 0 }, chosen != null)
  const rows = points.data?.rows ?? []
  return (
    <AppleCard
      title="امتیازات اعضا"
      subtitle="فهرست امتیازات اعضای باشگاه بر اساس طرح انتخابی"
      badge={`${rows.length} عضو`}
      action={
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#86868B]">انتخاب طرح:</span>
          <select
            value={chosen ?? ''}
            onChange={(e) => setPlanId(Number(e.target.value))}
            className="bg-[#F5F5F7] border border-black/[0.06] rounded-xl px-3 py-1.5 text-xs text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/25"
          >
            {(plans.data?.plans ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      }
    >
      <Table name="امتیازها" rows={rows} columns={[
        { label: CLUBS[kind].codeLabel, render: (r) => <span className="font-bold text-[#1D1D1F]" dir="ltr">{r.code}</span>, value: (r) => r.code },
        { label: 'نام', render: (r) => r.name, value: (r) => r.name },
        { label: 'فروش (ریال)', render: (r) => <span className="tabular-nums font-semibold text-[#1D1D1F]">{fa(r.sales_rial)}</span>, value: (r) => r.sales_rial },
        { label: 'امتیاز', render: (r) => <span className="tabular-nums font-extrabold text-[#0071E3]">{fa(r.points)}</span>, value: (r) => r.points },
        { label: 'تفکیک', render: (r) => (r.breakdown?.length ? r.breakdown.map((b) => `${b.label}: ${fa(b.points)}`).join(' · ') : '—'), value: (r) => r.breakdown?.length ?? 0 },
      ]} />
    </AppleCard>
  )
}

export function ClubPage({ kind, core }) {
  return (
    <div className="w-full max-w-[1600px] mx-auto px-6 space-y-6" dir="rtl">
      <div className="rounded-[24px] bg-white/85 backdrop-blur-xl border border-black/[0.04] p-5 flex items-center justify-between shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0071E3] to-[#42A1EC] text-white flex items-center justify-center shadow-sm shadow-blue-500/25">
            <Award size={20} />
          </span>
          <div>
            <h1 className="text-base font-bold text-[#1D1D1F]">{CLUBS[kind].title}</h1>
            <p className="text-xs text-[#86868B] mt-0.5">مدیریت قوانین گیمیفیکیشن، پله‌ها و امتیازات</p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#0071E3]/10 text-[#0071E3]">
          سامانه وفاداری
        </span>
      </div>
      <PlanDefinition kind={kind} core={core} />
      <PointsView kind={kind} core={core} />
    </div>
  )
}

/* ---------- Member Panels ---------- */
const sum = (rows, key) => rows.reduce((s, r) => s + (r[key] ?? 0), 0)

function MemberKpis({ code, codeLabel, points, sales, customers }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      <AppleKpiCard label={codeLabel} value={faDigits(code)} unit="شناسه عضویت" icon={Store} tone="blue" />
      <AppleKpiCard label="مجموع امتیازات" value={fa(points)} unit="امتیاز کسب‌شده" icon={Award} tone="teal" />
      <AppleKpiCard label="مجموع فروش" value={fa(sales)} unit="ریال" icon={CircleDollarSign} tone="amber" />
      {customers != null && <AppleKpiCard label="مشتریان فعال" value={fa(customers)} unit="مشتری یکتا" icon={Users} tone="violet" />}
    </div>
  )
}

export function MyClub() {
  const me = useApi('/club/me', {})
  const [i, setI] = useState(0)
  if (me.error) return <div className="w-full max-w-[1600px] mx-auto px-6 p-6" role="alert" dir="rtl"><div className="rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 p-4 text-xs font-semibold">{me.error}</div></div>
  if (me.loading) return <div className="w-full max-w-[1600px] mx-auto px-6 p-6 text-center text-xs text-[#86868B]" dir="rtl">در حال بارگذاری…</div>
  const { code, name, plans = [] } = me.data
  const plan = plans[Math.min(i, plans.length - 1)]
  return (
    <div className="w-full max-w-[1600px] mx-auto px-6 space-y-6" dir="rtl">
      <div className="rounded-[24px] bg-white/85 backdrop-blur-xl border border-black/[0.04] p-5 flex items-center justify-between shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex-wrap gap-3">
        <div>
          <h1 className="text-base font-bold text-[#1D1D1F]">باشگاه مشتریان — امتیاز من</h1>
          <p className="text-xs text-[#86868B] mt-0.5">{name ? `${name} (${code})` : `کد مشتری: ${code}`}</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#34C759]/10 text-[#34C759]">
          عضو فعال باشگاه
        </span>
      </div>

      <MemberKpis code={code} codeLabel="کد مشتری" points={sum(plans, 'points')} sales={sum(plans, 'sales_rial')} />

      {!plan ? (
        <AppleCard title="طرح‌های من">
          <div className="text-center py-10 text-xs text-[#86868B]">طرحی تعریف نشده است.</div>
        </AppleCard>
      ) : (
        <>
          <AppleCard
            title={name || 'طرح من'}
            subtitle={plan.plan.name}
            badge={plan.tier ? `سطح: ${plan.tier.level}` : ''}
            action={
              <div className="flex items-center gap-1.5 p-1 bg-[#E8E8ED]/80 rounded-2xl flex-wrap">
                {plans.map((p, n) => (
                  <button
                    key={p.plan.id}
                    type="button"
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      n === i ? 'bg-[#0071E3] text-white shadow-sm' : 'text-[#1D1D1F] hover:bg-black/[0.05]'
                    }`}
                    onClick={() => setI(n)}
                  >
                    {p.plan.name}
                  </button>
                ))}
              </div>
            }
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <TierBadge tier={plan.tier} />
                <span className="text-lg font-extrabold text-[#1D1D1F]">{fa(plan.points)} امتیاز</span>
                <span className="text-xs text-[#86868B]">{fa(plan.sales_rial)} ریال فروش</span>
              </div>
              {plan.tier?.progress != null && (
                <Progress value={plan.tier.progress} label={`پیشرفت تا ${fa(plan.tier.target_points)} امتیاز`} />
              )}
              {!!plan.breakdown?.length && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-black/[0.04]">
                  {plan.breakdown.map((b, n) => (
                    <span key={n} className="px-3 py-1.5 rounded-xl text-xs bg-[#F5F5F7] text-[#1D1D1F]">
                      <span className="text-[#86868B]">{b.label}: </span>
                      <b>{fa(b.points)} امتیاز</b>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </AppleCard>

          <AppleCard title="امتیاز ماه‌به‌ماه" subtitle="جمع ستون‌ها برابر امتیاز کل طرح است">
            <PointsChart history={plan.history} name="نمودار امتیاز ماهانه" />
          </AppleCard>

          <AppleCard title="جزئیات طرح‌ها" subtitle="خلاصه عملکرد در تمامی طرح‌های عضویت">
            <Table name="طرح‌های من" rows={plans.map((p) => ({ ...p, _key: p.plan.id }))} columns={[
              { label: 'طرح', render: (r) => <b className="font-bold text-[#1D1D1F]">{r.plan.name}</b>, value: (r) => r.plan.name },
              { label: 'شروع', render: (r) => faDigits(r.plan.start_key), value: (r) => r.plan.start_key },
              { label: 'پایان', render: (r) => faDigits(r.plan.end_key), value: (r) => r.plan.end_key },
              { label: 'فروش (ریال)', render: (r) => <span className="tabular-nums font-semibold">{fa(r.sales_rial)}</span>, value: (r) => r.sales_rial },
              { label: 'امتیاز', render: (r) => <span className="tabular-nums font-bold text-[#0071E3]">{fa(r.points)}</span>, value: (r) => r.points },
              { label: 'سطح', render: (r) => <TierBadge tier={r.tier} />, value: (r) => r.tier?.step ?? 0 },
            ]} />
          </AppleCard>
        </>
      )}
    </div>
  )
}

export function MyVisitorClub() {
  const team = useApi('/club/visitor/team', {})
  if (team.error) return <div className="w-full max-w-[1600px] mx-auto px-6 p-6" role="alert" dir="rtl"><div className="rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 p-4 text-xs font-semibold">{team.error}</div></div>
  if (team.loading) return <div className="w-full max-w-[1600px] mx-auto px-6 p-6 text-center text-xs text-[#86868B]" dir="rtl">در حال بارگذاری…</div>
  const { code, plan, points, sales_rial: sales, customers, tier, team: rows = [], history = [] } = team.data
  if (!plan) {
    return (
      <div className="w-full max-w-[1600px] mx-auto px-6 space-y-6" dir="rtl">
        <AppleCard title="باشگاه ویزیتورها — پیشرفت من">
          <div className="text-center py-10 text-xs text-[#86868B]">طرحی تعریف نشده است.</div>
        </AppleCard>
      </div>
    )
  }
  return (
    <div className="w-full max-w-[1600px] mx-auto px-6 space-y-6" dir="rtl">
      <div className="rounded-[24px] bg-white/85 backdrop-blur-xl border border-black/[0.04] p-5 flex items-center justify-between shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex-wrap gap-3">
        <div>
          <h1 className="text-base font-bold text-[#1D1D1F]">باشگاه ویزیتورها — پیشرفت من</h1>
          <p className="text-xs text-[#86868B] mt-0.5">کد ویزیتور: {code}</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#0071E3]/10 text-[#0071E3]">
          پرتفوی ویزیتور
        </span>
      </div>

      <MemberKpis code={code} codeLabel="کد ویزیتور" points={points} sales={sales} customers={customers} />

      <AppleCard title={plan.name} subtitle="پیشرفت من در این طرح" badge={tier ? `سطح: ${tier.level}` : ''}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <TierBadge tier={tier} />
            <strong className="text-lg font-extrabold text-[#1D1D1F]">{fa(points)} امتیاز</strong>
            <span className="text-xs text-[#86868B]">{fa(customers)} مشتری</span>
          </div>
          {tier?.progress != null && (
            <Progress value={tier.progress} label={`پیشرفت تا ${fa(tier.target_points)} امتیاز`} />
          )}
        </div>
      </AppleCard>

      <AppleCard title="رتبه‌بندی مشتریان من" subtitle="بر اساس فروش در بازهٔ طرح">
        <Table name="رتبه‌بندی مشتریان" rows={rows.map((r) => ({ ...r, _key: r.code }))} columns={[
          { label: 'رتبه', render: (r) => <span className="font-bold">{fa(r.rank)}</span>, value: (r) => r.rank },
          { label: 'کد مشتری', render: (r) => <span dir="ltr">{r.code}</span>, value: (r) => r.code },
          { label: 'نام', render: (r) => r.name, value: (r) => r.name },
          { label: 'فروش (ریال)', render: (r) => <span className="tabular-nums font-semibold">{fa(r.sales_rial)}</span>, value: (r) => r.sales_rial },
          { label: 'امتیاز', render: (r) => <span className="tabular-nums font-bold text-[#0071E3]">{fa(r.points)}</span>, value: (r) => r.points },
          { label: 'سهم', render: (r) => faDigits(Math.round((r.sales_rial / (sales || 1)) * 100)) + '٪', value: (r) => r.sales_rial },
        ]} />
      </AppleCard>

      <AppleCard title="امتیاز ماه‌به‌ماه" subtitle="امتیاز پرتفوی ویزیتور در هر ماه">
        <PointsChart history={history} name="نمودار امتیاز ماهانه ویزیتور" />
      </AppleCard>
    </div>
  )
}

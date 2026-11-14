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

function Progress({ value, label, subtitle }) {
  const pctv = Math.min(100, Math.max(0, Math.round((value ?? 0) * 100)))
  return (
    <div className="space-y-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pctv} aria-label={label}>
      <div className="flex justify-between items-center text-xs font-semibold text-[#1D1D1F]">
        <span>{label}</span>
        <span className="tabular-nums font-bold text-[#0071E3]">{faDigits(pctv)}٪</span>
      </div>
      <div className="h-3 bg-black/[0.05] rounded-full overflow-hidden p-0.5 border border-black/[0.03]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#0071E3] via-[#34C759] to-[#30B0C7] transition-all duration-700 shadow-sm"
          style={{ width: `${pctv}%` }}
        />
      </div>
      {subtitle && (
        <div className="text-[11px] font-medium text-[#86868B] text-left" dir="rtl">
          {subtitle}
        </div>
      )}
    </div>
  )
}

function TierBadge({ tier }) {
  if (!tier?.level) return null
  const tone = TIER_TONE[tier.level] ?? '#64748b'
  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-tight shadow-sm"
      style={{ background: `${tone}15`, color: tone, border: `1px solid ${tone}35` }}
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
  const [tierPoints, setTierPoints] = useState('')
  const [rules, setRules] = useState([])
  const [msg, setMsg] = useState('')
  const setRule = (i, k, v) => setRules((rs) => rs.map((r, n) => (n === i ? { ...r, [k]: v } : r)))
  const submit = (e) => {
    e.preventDefault()
    const parsedTiers = tierPoints
      ? tierPoints.split(',').map((x) => Number(x.trim())).filter((x) => !isNaN(x) && x > 0)
      : null
    const body = {
      name, core,
      start_key: Number(start.replace(/\D/g, '')),
      end_key: Number(end.replace(/\D/g, '')),
      rial_per_point: Number(rate),
      target_points: target ? Number(target.replace(/\D/g, '')) : null,
      tier_points: parsedTiers && parsedTiers.length === 4 ? parsedTiers : null,
      rules: rules.filter((r) => Number(r.ratio) > 0).map((r) => ({
        label: r.label, metric: r.metric, ratio: Number(r.ratio), factor: Number(r.factor) || 0,
        brand: r.brand || null, main_group: null, new_customers: false,
      })),
    }
    postJson(`/club/${kind}/plans`, body)
      .then(() => { setMsg('طرح ذخیره شد.'); setName(''); setStart(''); setEnd(''); setRate(''); setTarget(''); setTierPoints(''); onCreated() })
      .catch((err) => setMsg(err.message))
  }
  return (
    <form onSubmit={submit} className="mb-6 p-6 rounded-[24px] bg-[#F5F5F7] border border-black/[0.05] space-y-4" dir="rtl">
      <h3 className="text-sm font-bold text-[#1D1D1F]">تعریف طرح جدید گیمیفیکیشن و وفاداری</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
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
        <div>
          <label className="block text-xs font-medium text-[#86868B] mb-1">پله‌ها (مثال: 10,20,30,40)</label>
          <input className="w-full bg-white border border-black/[0.08] rounded-xl px-3 py-2 text-xs text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#0071E3]/25" placeholder="۴ آستانه عددی" value={tierPoints} onChange={(e) => setTierPoints(e.target.value)} />
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white border border-black/[0.05] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#1D1D1F]">قوانین و ضرایب گیمیفیکیشن (اختیاری)</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0071E3]/10 text-[#0071E3] hover:bg-[#0071E3]/20 transition-colors"
            onClick={() => setRules((rs) => [...rs, { label: '', metric: 'rial', ratio: '100000', factor: '1', brand: '', new_customers: false }])}
          >
            <Plus size={13} />
            <span>افزودن قانون</span>
          </button>
        </div>
        <p className="text-[11px] text-[#86868B]">اگر خالی بماند: امتیاز = فروش خالص (پس از کسر مرجوعی) ÷ ریال به ازای هر امتیاز.</p>
        {rules.map((r, i) => (
          <div className="flex items-center gap-2 flex-wrap bg-[#F5F5F7] p-2.5 rounded-xl border border-black/[0.03]" key={i}>
            <input className="bg-white border border-black/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-[#1D1D1F]" placeholder="عنوان قانون" value={r.label} onChange={(e) => setRule(i, 'label', e.target.value)} />
            <select className="bg-white border border-black/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-[#1D1D1F]" value={r.metric} onChange={(e) => setRule(i, 'metric', e.target.value)}>
              <option value="rial">ریال خالص فروش</option><option value="qty">تعداد قلم خالص</option>
              <option value="lines">سطر فاکتور (غیرمرجوعی)</option><option value="customers">تعداد مشتری یکتا</option>
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
        <button type="submit" className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-sm shadow-blue-500/25 transition-all">
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
        {
          label: 'هدف / پله‌ها',
          render: (r) => (Array.isArray(r.tier_points) ? r.tier_points.map(fa).join(' › ') : r.target_points ? fa(r.target_points) : '—'),
          value: (r) => r.target_points ?? 0,
        },
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
      subtitle="فهرست امتیازات اعضای باشگاه بر اساس فروش خالص (پس از کسر مرجوعی)"
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
        { label: 'فروش خالص (ریال)', render: (r) => <span className="tabular-nums font-semibold text-[#1D1D1F]">{fa(r.sales_rial)}</span>, value: (r) => r.sales_rial },
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

export function MyClub() {
  const me = useApi('/club/me', {})
  const [i, setI] = useState(0)
  if (me.error) return <div className="w-full max-w-[1600px] mx-auto px-6 p-6" role="alert" dir="rtl"><div className="rounded-[28px] bg-rose-50/90 border border-rose-200 text-rose-700 p-5 text-xs font-semibold">{me.error}</div></div>
  if (me.loading) return <div className="w-full max-w-[1600px] mx-auto px-6 p-6 text-center text-xs text-[#86868B]" dir="rtl">در حال بارگذاری…</div>
  const { code, name, plans = [] } = me.data
  const plan = plans[Math.min(i, plans.length - 1)]
  const activeTier = plan?.tier

  return (
    <div className="w-full max-w-[1600px] mx-auto px-6 space-y-6" dir="rtl">
      {/* Header Bento */}
      <div className="rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] p-6 flex items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <span className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0071E3] to-[#42A1EC] text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Store size={24} />
          </span>
          <div>
            <h1 className="text-lg font-extrabold text-[#1D1D1F]">باشگاه مشتریان (B2B) — امتیاز من</h1>
            <p className="text-xs text-[#86868B] mt-1">{name ? `${name} (شناسه: ${code})` : `شناسه مشتری: ${code}`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeTier && <TierBadge tier={activeTier} />}
          <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20">
            عضو رسمی باشگاه
          </span>
        </div>
      </div>

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        <AppleKpiCard label="شناسه مشتری" value={faDigits(code)} unit="کد یکتای عضویت" icon={Store} tone="blue" />
        <AppleKpiCard label="مجموع امتیازات کل طرح‌ها" value={fa(sum(plans, 'points'))} unit="امتیاز فعال کسب‌شده" icon={Award} tone="teal" />
        <AppleKpiCard label="فروش خالص کل (کسر مرجوعی)" value={fa(sum(plans, 'sales_rial'))} unit="ریال خالص" icon={CircleDollarSign} tone="amber" />
        <AppleKpiCard label="وضعیت سطح وفاداری" value={activeTier?.level || 'پله ۱'} unit={activeTier?.points_needed_label || 'فعال'} icon={Sparkles} tone="violet" />
      </div>

      {!plan ? (
        <AppleCard title="طرح‌های من">
          <div className="text-center py-12 text-xs text-[#86868B]">هیچ طرح فعالی برای شما تعریف نشده است.</div>
        </AppleCard>
      ) : (
        <>
          {/* Active Plan Bento Card */}
          <AppleCard
            title={plan.plan.name}
            subtitle={`بازه طرح: ${faDigits(plan.plan.start_key)} تا ${faDigits(plan.plan.end_key)}`}
            badge={plan.tier ? `سطح: ${plan.tier.level}` : ''}
            action={
              <div className="flex items-center gap-1.5 p-1 bg-[#F5F5F7] rounded-2xl border border-black/[0.04] flex-wrap">
                {plans.map((p, n) => (
                  <button
                    key={p.plan.id}
                    type="button"
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      n === i ? 'bg-[#0071E3] text-white shadow-sm' : 'text-[#86868B] hover:text-[#1D1D1F]'
                    }`}
                    onClick={() => setI(n)}
                  >
                    {p.plan.name}
                  </button>
                ))}
              </div>
            }
          >
            <div className="space-y-5">
              <div className="flex items-center gap-4 flex-wrap">
                <TierBadge tier={plan.tier} />
                <div>
                  <span className="text-2xl font-black text-[#1D1D1F] tracking-tight">{fa(plan.points)}</span>
                  <span className="text-xs text-[#86868B] mr-1.5 font-medium">امتیاز کسب‌شده</span>
                </div>
                <div className="mr-auto text-left">
                  <span className="text-xs text-[#86868B]">فروش خالص: </span>
                  <span className="text-sm font-extrabold text-[#1D1D1F] tabular-nums">{fa(plan.sales_rial)}</span>
                  <span className="text-[11px] text-[#86868B] mr-1">ریال</span>
                </div>
              </div>

              {plan.tier?.progress != null && (
                <Progress
                  value={plan.tier.progress}
                  label={`پیشرفت تحقق هدف امتیازی (${fa(plan.tier.target_points)} امتیاز)`}
                  subtitle={plan.tier.points_needed_label}
                />
              )}

              {!!plan.breakdown?.length && (
                <div className="pt-3 border-t border-black/[0.04]">
                  <span className="text-xs font-bold text-[#86868B] block mb-2">تفکیک امتیازات طبق شاخص‌ها:</span>
                  <div className="flex flex-wrap gap-2">
                    {plan.breakdown.map((b, n) => (
                      <span key={n} className="px-3 py-1.5 rounded-xl text-xs bg-[#F5F5F7] border border-black/[0.04] text-[#1D1D1F] flex items-center gap-1.5">
                        <span className="text-[#86868B]">{b.label}:</span>
                        <b className="font-bold text-[#0071E3]">{fa(b.points)}</b>
                        <span className="text-[10px] text-[#86868B]">امتیاز</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </AppleCard>

          {/* Monthly Trend Bento */}
          <AppleCard title="روند امتیازات ماه‌به‌ماه" subtitle="محاسبه‌شده بر مبنای رشد تجمعی فروش خالص (ستون‌ها دقیقاً برابر کل امتیاز هستند)">
            <PointsChart history={plan.history} name="نمودار امتیاز ماهانه" />
          </AppleCard>

          {/* All Plans Table Bento */}
          <AppleCard title="تاریخچه تمامی طرح‌ها" subtitle="خلاصه عملکرد عضو در طرح‌های مختلف باشگاه">
            <Table name="طرح‌های من" rows={plans.map((p) => ({ ...p, _key: p.plan.id }))} columns={[
              { label: 'نام طرح', render: (r) => <b className="font-bold text-[#1D1D1F]">{r.plan.name}</b>, value: (r) => r.plan.name },
              { label: 'شروع', render: (r) => faDigits(r.plan.start_key), value: (r) => r.plan.start_key },
              { label: 'پایان', render: (r) => faDigits(r.plan.end_key), value: (r) => r.plan.end_key },
              { label: 'فروش خالص (ریال)', render: (r) => <span className="tabular-nums font-semibold">{fa(r.sales_rial)}</span>, value: (r) => r.sales_rial },
              { label: 'امتیاز', render: (r) => <span className="tabular-nums font-extrabold text-[#0071E3]">{fa(r.points)}</span>, value: (r) => r.points },
              { label: 'سطح وفاداری', render: (r) => <TierBadge tier={r.tier} />, value: (r) => r.tier?.step ?? 0 },
              { label: 'فاصله تا پله بعد', render: (r) => <span className="text-xs text-[#86868B]">{r.tier?.points_needed_label || '—'}</span>, value: (r) => r.tier?.points_needed ?? 0 },
            ]} />
          </AppleCard>
        </>
      )}
    </div>
  )
}

export function MyVisitorClub() {
  const team = useApi('/club/visitor/team', {})
  if (team.error) return <div className="w-full max-w-[1600px] mx-auto px-6 p-6" role="alert" dir="rtl"><div className="rounded-[28px] bg-rose-50/90 border border-rose-200 text-rose-700 p-5 text-xs font-semibold">{team.error}</div></div>
  if (team.loading) return <div className="w-full max-w-[1600px] mx-auto px-6 p-6 text-center text-xs text-[#86868B]" dir="rtl">در حال بارگذاری…</div>

  const { plan } = team.data
  // Requirement 2: Two clear sections (visitor_summary & portfolio_customers)
  const summary = team.data?.visitor_summary || {
    code: team.data?.code,
    name: team.data?.code,
    points: team.data?.points ?? 0,
    sales_rial: team.data?.sales_rial ?? 0,
    tier: team.data?.tier,
    history: team.data?.history || [],
    customers_count: team.data?.customers ?? 0,
    breakdown: team.data?.breakdown || [],
  }
  const customers = team.data?.portfolio_customers || team.data?.team || []

  if (!plan) {
    return (
      <div className="w-full max-w-[1600px] mx-auto px-6 space-y-6" dir="rtl">
        <AppleCard title="باشگاه ویزیتورها — کارنامه و پرتفوی فروش">
          <div className="text-center py-12 text-xs text-[#86868B]">در حال حاضر هیچ طرح فعالی برای ویزیتورها تعریف نشده است.</div>
        </AppleCard>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto px-6 space-y-6" dir="rtl">
      {/* Visitor Header Bento */}
      <div className="rounded-[28px] bg-white/85 backdrop-blur-xl border border-black/[0.04] p-6 flex items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <span className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0071E3] to-[#42A1EC] text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Award size={24} />
          </span>
          <div>
            <h1 className="text-lg font-extrabold text-[#1D1D1F]">باشگاه ویزیتورها — کارنامه و پرتفوی فروش</h1>
            <p className="text-xs text-[#86868B] mt-1">{summary.name ? `${summary.name} (کد ویزیتور: ${summary.code})` : `کد ویزیتور: ${summary.code}`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {summary.tier && <TierBadge tier={summary.tier} />}
          <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20">
            پرتفوی رسمی فروش
          </span>
        </div>
      </div>

      {/* Visitor KPI Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        <AppleKpiCard label="شناسه ویزیتور" value={faDigits(summary.code)} unit="کد سیستمی بازاریاب" icon={Store} tone="blue" />
        <AppleKpiCard label="امتیاز ویزیتور (یکپارچه با مدیریت)" value={fa(summary.points)} unit="امتیاز کل کسب‌شده" icon={Award} tone="teal" />
        <AppleKpiCard label="فروش خالص کل پرتفوی" value={fa(summary.sales_rial)} unit="ریال خالص (کسر مرجوعی)" icon={CircleDollarSign} tone="amber" />
        <AppleKpiCard label="مشتریان خریدار در دوره" value={fa(summary.customers_count)} unit="مشتری یکتای فعال" icon={Users} tone="violet" />
      </div>

      {/* Section 1: Visitor Progress Bento Card */}
      <AppleCard
        title={`کارنامه اختصاصی در طرح: ${plan.name}`}
        subtitle={`محاسبه مستقیم بر مبنای کل فروش خالص ویزیتور و قوانین گیمیفیکیشن طرح`}
        badge={summary.tier ? `سطح: ${summary.tier.level}` : ''}
      >
        <div className="space-y-5">
          <div className="flex items-center gap-4 flex-wrap">
            <TierBadge tier={summary.tier} />
            <div>
              <span className="text-2xl font-black text-[#1D1D1F] tracking-tight">{fa(summary.points)}</span>
              <span className="text-xs text-[#86868B] mr-1.5 font-medium">امتیاز تجمیعی ویزیتور</span>
            </div>
            <div className="mr-auto text-left">
              <span className="text-xs text-[#86868B]">فروش خالص کل پرتفوی: </span>
              <span className="text-sm font-extrabold text-[#1D1D1F] tabular-nums">{fa(summary.sales_rial)}</span>
              <span className="text-[11px] text-[#86868B] mr-1">ریال</span>
            </div>
          </div>

          {summary.tier?.progress != null && (
            <Progress
              value={summary.tier.progress}
              label={`پیشرفت تحقق هدف امتیازی (${fa(summary.tier.target_points)} امتیاز)`}
              subtitle={summary.tier.points_needed_label}
            />
          )}

          {!!summary.breakdown?.length && (
            <div className="pt-3 border-t border-black/[0.04]">
              <span className="text-xs font-bold text-[#86868B] block mb-2">تفکیک امتیازات ویزیتور طبق قوانین طرح:</span>
              <div className="flex flex-wrap gap-2">
                {summary.breakdown.map((b, n) => (
                  <span key={n} className="px-3 py-1.5 rounded-xl text-xs bg-[#F5F5F7] border border-black/[0.04] text-[#1D1D1F] flex items-center gap-1.5">
                    <span className="text-[#86868B]">{b.label}:</span>
                    <b className="font-bold text-[#0071E3]">{fa(b.points)}</b>
                    <span className="text-[10px] text-[#86868B]">امتیاز</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </AppleCard>

      {/* Section 2: Portfolio Customers Leaderboard */}
      <AppleCard
        title="لیدربورد پرتفوی مشتریان من"
        subtitle="بررسی فروش خالص، امتیاز و فاصله هر مشتری تا ارتقای پله بعدی جهت پیگیری و تارگت‌گذاری"
        badge={`${customers.length} مشتری`}
      >
        <Table name="رتبه‌بندی مشتریان" rows={customers.map((r) => ({ ...r, _key: r.code }))} columns={[
          { label: 'رتبه', render: (r) => <span className="font-bold text-[#1D1D1F]">{fa(r.rank)}</span>, value: (r) => r.rank },
          { label: 'کد مشتری', render: (r) => <span dir="ltr" className="font-mono text-xs">{r.code}</span>, value: (r) => r.code },
          { label: 'نام مشتری', render: (r) => <b className="font-bold text-[#1D1D1F]">{r.name}</b>, value: (r) => r.name },
          { label: 'فروش خالص (ریال)', render: (r) => <span className="tabular-nums font-semibold">{fa(r.sales_rial)}</span>, value: (r) => r.sales_rial },
          { label: 'امتیاز', render: (r) => <span className="tabular-nums font-extrabold text-[#0071E3]">{fa(r.points)}</span>, value: (r) => r.points },
          { label: 'سطح مشتری', render: (r) => <TierBadge tier={r.tier} />, value: (r) => r.tier?.step ?? 0 },
          {
            label: 'فاصله تا پله بعدی',
            render: (r) => (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold ${
                r.points_to_next_tier > 0 ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
              }`}>
                {r.tier?.points_needed_label || (r.points_to_next_tier > 0 ? `${fa(r.points_to_next_tier)} امتیاز تا ${r.next_tier}` : 'بالاترین سطح')}
              </span>
            ),
            value: (r) => r.points_to_next_tier ?? 0,
          },
          { label: 'سهم از پرتفوی', render: (r) => faDigits(Math.round((r.sales_rial / (summary.sales_rial || 1)) * 100)) + '٪', value: (r) => r.sales_rial },
        ]} />
      </AppleCard>

      {/* Monthly Chart */}
      <AppleCard title="روند امتیازات ماهانه پرتفوی" subtitle="روند رشد امتیازات ماهانه بر اساس فروش خالص تجمیعی">
        <PointsChart history={summary.history} name="نمودار امتیاز ماهانه ویزیتور" />
      </AppleCard>
    </div>
  )
}

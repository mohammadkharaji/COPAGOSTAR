import { useEffect, useRef, useState } from 'react'
import { Calendar, CircleDollarSign, RotateCcw, ShoppingBag, TrendingUp, Users } from 'lucide-react'
import { useApi } from './api'
import { useAppearance } from './AppearanceContext'
import { fa } from './format'
import { AppleCard, AppleKpiCard, pct, rial, Status, Table } from './ui'

const faDate = (k) => (/^\d{8}$/.test(String(k)) ? `${String(k).slice(0, 4)}/${String(k).slice(4, 6)}/${String(k).slice(6)}` : k)

export const INACTIVE_PAGE_SIZE = 50
export const INACTIVE_DAYS = [['30', '۳۰ روز'], ['45', '۴۵ روز'], ['60', '۶۰ روز'], ['90', '۹۰ روز']]

function ProfileLink({ onClick, children }) {
  const { isDark } = useAppearance()
  return (
    <button
      type="button"
      className={`font-semibold text-right transition-colors ${
        isDark ? 'text-emerald-400 hover:text-emerald-300 hover:underline' : 'text-emerald-700 hover:text-emerald-800 hover:underline'
      }`}
      onClick={(e) => { e.stopPropagation(); onClick() }}
    >
      {children}
    </button>
  )
}

export function PotentialCustomersPage({ p, openCustomer, openVisitor }) {
  const { isDark } = useAppearance()
  const [days, setDays] = useState('60')
  const { month: _m, start: _s, end: _e, v: _v, ...query } = p
  const r = useApi('/potential-customers', { ...query, days, v: p.v })
  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5">
      {/* Dark Emerald Floating Filter Bar */}
      <div className={`rounded-2xl backdrop-blur-xl border p-3 sm:p-4 flex items-center justify-between gap-4 flex-wrap ${
        isDark
          ? 'bg-[#0B100E]/75 border-emerald-500/15 shadow-[0_4px_20px_rgba(0,0,0,0.35)]'
          : 'bg-white/90 border-slate-200/80 shadow-xs'
      }`}>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>بازهٔ بررسی:</span>
          <div className={`flex items-center gap-1 p-1 rounded-xl flex-wrap ${isDark ? 'bg-black/30' : 'bg-slate-100'}`}>
            {INACTIVE_DAYS.map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setDays(v)}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  days === v
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
                    : isDark ? 'text-slate-300 hover:text-white hover:bg-white/5' : 'text-slate-700 hover:bg-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Status state={r}>{(j) => {
        if (!j.available) return <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-xs text-amber-700">{j.reason}</div>
        const low = j.low_frequency
        const lapsed = j.lapsed
        const rows = (items) => items.map((x) => ({ ...x }))
        return (
          <>
            {/* 4 Compact Dark Emerald KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 w-full">
              <AppleKpiCard
                label="مشتری در حال بازگشت"
                value={fa(lapsed.count)}
                unit={`خرید بین ${faDate(j.lapse_start.replace(/\//g, ''))} تا قبل از بازه`}
                icon={RotateCcw}
                tone="teal"
              />
              <AppleKpiCard
                label="فروش قبلی بازگشتی‌ها"
                value={rial(lapsed.sales_rial)}
                unit="ریال · فروش عادی"
                icon={CircleDollarSign}
                tone="green"
              />
              <AppleKpiCard
                label="مشتری کم‌خرید فعال"
                value={fa(low.count)}
                unit={`تا ${fa(j.max_invoices)} فاکتور در بازهٔ بررسی`}
                icon={Users}
                tone="amber"
              />
              <AppleKpiCard
                label="فروش این گروه در بازه"
                value={rial(low.sales_rial)}
                unit="ریال · فروش عادی در بازه"
                icon={ShoppingBag}
                tone="blue"
              />
            </div>

            <AppleCard
              title="مشتریان در حال بازگشت"
              subtitle="آخرین خرید قبل از بازه، ولی در بازهٔ اخیر‌تر (پیش از این بازه) · با کلیک روی ردیف، پروفایل باز می‌شود"
              badge={`${lapsed.items?.length ?? 0} مشتری`}
            >
              <Table name="مشتریان-در-حال-بازگشت" rows={rows(lapsed.items)} pageSize={INACTIVE_PAGE_SIZE} onRow={(x) => openCustomer(x.code)} columns={[
                { label: 'رتبه', render: (x) => fa(x.rank), value: (x) => x.rank },
                { label: 'کد مشتری', render: (x) => x.code, value: (x) => String(x.code) },
                { label: 'مشتری', render: (x) => <ProfileLink onClick={() => openCustomer(x.code)}>{x.name ?? x.code}</ProfileLink>, value: (x) => String(x.name ?? '') },
                { label: 'ویزیتور', render: (x) => (x.visitor_code ? <ProfileLink onClick={() => openVisitor(x.visitor_code)}>{x.visitor ?? x.visitor_code}</ProfileLink> : '—'), value: (x) => String(x.visitor ?? '') },
                { label: 'شعبه', render: (x) => x.branch ?? '—', value: (x) => String(x.branch ?? '') },
                { label: 'آخرین خرید', render: (x) => x.last_purchase, value: (x) => x.last_purchase },
                { label: 'روز بدون خرید', render: (x) => fa(x.days_since), value: (x) => x.days_since },
                { label: 'تعداد فاکتور', render: (x) => fa(x.invoices), value: (x) => x.invoices },
                { label: 'فروش قبلی (ریال)', render: (x) => <span className={`tabular-nums font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{rial(x.sales_rial)}</span>, value: (x) => x.sales_rial },
              ]} />
            </AppleCard>

            <AppleCard
              title="مشتریان کم‌خرید فعال"
              subtitle={`خرید در بازه با حداکثر ${fa(j.max_invoices)} فاکتور · با کلیک روی ردیف، پروفایل باز می‌شود`}
              badge={`${low.items?.length ?? 0} مشتری`}
            >
              <Table name="مشتریان-کم-خرید" rows={rows(low.items)} pageSize={INACTIVE_PAGE_SIZE} onRow={(x) => openCustomer(x.code)} columns={[
                { label: 'رتبه', render: (x) => fa(x.rank), value: (x) => x.rank },
                { label: 'کد مشتری', render: (x) => x.code, value: (x) => String(x.code) },
                { label: 'مشتری', render: (x) => <ProfileLink onClick={() => openCustomer(x.code)}>{x.name ?? x.code}</ProfileLink>, value: (x) => String(x.name ?? '') },
                { label: 'ویزیتور', render: (x) => (x.visitor_code ? <ProfileLink onClick={() => openVisitor(x.visitor_code)}>{x.visitor ?? x.visitor_code}</ProfileLink> : '—'), value: (x) => String(x.visitor ?? '') },
                { label: 'شعبه', render: (x) => x.branch ?? '—', value: (x) => String(x.branch ?? '') },
                { label: 'فاکتور در بازه', render: (x) => fa(x.window_invoices), value: (x) => x.window_invoices },
                { label: 'فروش در بازه (ریال)', render: (x) => <span className={`tabular-nums font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{rial(x.window_sales_rial)}</span>, value: (x) => x.window_sales_rial },
                { label: 'آخرین خرید', render: (x) => x.last_purchase, value: (x) => x.last_purchase },
                { label: 'فروش کل (ریال)', render: (x) => rial(x.sales_rial), value: (x) => x.sales_rial },
              ]} />
            </AppleCard>
          </>
        )
      }}</Status>
    </div>
  )
}

export function InactiveCustomersPage({ p, openCustomer, openVisitor }) {
  const { isDark } = useAppearance()
  const [days, setDays] = useState('60')
  const [selVisitor, setSelVisitor] = useState(null)
  const listRef = useRef(null)
  useEffect(() => {
    if (selVisitor !== null) listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selVisitor])
  const { month: _m, start: _s, end: _e, v: _v, ...query } = p
  const r = useApi('/inactive-customers', { ...query, days, v: p.v })
  const exportQs = new URLSearchParams(Object.entries({ ...query, days }).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v ? [[k, v]] : []))).toString()

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5">
      {/* Dark Emerald Floating Filter Bar */}
      <div className={`rounded-2xl backdrop-blur-xl border p-3 sm:p-4 flex items-center justify-between gap-4 flex-wrap ${
        isDark
          ? 'bg-[#0B100E]/75 border-emerald-500/15 shadow-[0_4px_20px_rgba(0,0,0,0.35)]'
          : 'bg-white/90 border-slate-200/80 shadow-xs'
      }`}>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>بازه بدون خرید:</span>
          <div className={`flex items-center gap-1 p-1 rounded-xl flex-wrap ${isDark ? 'bg-black/30' : 'bg-slate-100'}`}>
            {INACTIVE_DAYS.map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setDays(v)}
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  days === v
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
                    : isDark ? 'text-slate-300 hover:text-white hover:bg-white/5' : 'text-slate-700 hover:bg-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <a
          className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
            isDark
              ? 'bg-[#0F1412] border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10'
              : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
          }`}
          href={`/api/inactive-customers/export?${exportQs}`}
          download
        >
          <span>📥 خروجی Excel</span>
        </a>
      </div>

      <Status state={r}>{(j) => {
        if (!j.available) return <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-xs text-amber-700">{j.reason}</div>
        return (
          <>
            {/* 4 Compact Dark Emerald KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 w-full">
              <AppleKpiCard
                label="مشتری غیرفعال"
                value={fa(j.inactive_customers)}
                unit={`از ${fa(j.total_customers)} مشتری دارای سابقه`}
                icon={Users}
                tone="red"
              />
              <AppleKpiCard
                label="درصد غیرفعال"
                value={pct(j.inactive_percent, 1)}
                unit="از کل مشتریان دارای سابقه"
                icon={TrendingUp}
                tone="amber"
              />
              <AppleKpiCard
                label="فروش قبلی این مشتریان"
                value={rial(j.lost_sales_rial)}
                unit="ریال · فروش عادی تا قبل از بازه"
                icon={CircleDollarSign}
                tone="teal"
              />
              <AppleKpiCard
                label="بازهٔ بررسی"
                value={`${fa(j.days)} روز`}
                unit={`${faDate(j.window_start.replace(/\//g, ''))} تا ${faDate(j.as_of.replace(/\//g, ''))}`}
                icon={Calendar}
                tone="blue"
              />
            </div>

            {/* Visitor Breakdown Table Bento */}
            <AppleCard
              title="ویزیتورها با بیشترین مشتری غیرفعال"
              subtitle="ویزیتور = آخرین ویزیتور خرید مشتری · برای فیلتر مشتریان، روی تعداد کلیک کنید"
              badge={`${j.by_visitor?.length ?? 0} ویزیتور`}
            >
              <Table name="غیرفعال-ویزیتور" rows={j.by_visitor} pageSize={INACTIVE_PAGE_SIZE} onRow={(x) => x.code && openVisitor(x.code)} columns={[
                { label: 'کد', render: (x) => x.code ?? '—', value: (x) => String(x.code ?? '') },
                { label: 'ویزیتور', render: (x) => <span className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{x.name ?? '—'}</span>, value: (x) => String(x.name ?? '') },
                { label: 'مشتری غیرفعال', render: (x) => <ProfileLink onClick={() => setSelVisitor(x.code ?? '')}>{fa(x.customers)}</ProfileLink>, value: (x) => x.customers },
                { label: 'فروش قبلی (ریال)', render: (x) => <span className={`tabular-nums font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{rial(x.sales_rial)}</span>, value: (x) => x.sales_rial },
              ]} />
            </AppleCard>

            {/* Selected Visitor Inactive List */}
            {selVisitor !== null && (() => {
              const v = j.by_visitor.find((x) => String(x.code ?? '') === selVisitor)
              if (!v) return null
              return (
                <div ref={listRef}>
                  <AppleCard
                    title={`مشتریان غیرفعال ویزیتور: ${v.name ?? v.code ?? ''}`}
                    subtitle={`${fa(v.customers)} مشتری · با کلیک روی ردیف، پروفایل مشتری باز می‌شود`}
                    badge="فیلتر ویزیتور"
                    action={
                      <button
                        type="button"
                        onClick={() => setSelVisitor(null)}
                        className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors ${
                          isDark ? 'bg-white/10 text-slate-200 hover:bg-white/20' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        بستن فیلتر ✕
                      </button>
                    }
                  >
                    <Table name={`غیرفعال-ویزیتور-${selVisitor || 'بدون-کد'}`} rows={v.items} pageSize={INACTIVE_PAGE_SIZE} onRow={(x) => openCustomer(x.code)} columns={[
                      { label: 'رتبه', render: (x) => fa(x.rank), value: (x) => x.rank },
                      { label: 'کد مشتری', render: (x) => x.code, value: (x) => String(x.code) },
                      { label: 'مشتری', render: (x) => <ProfileLink onClick={() => openCustomer(x.code)}>{x.name ?? x.code}</ProfileLink>, value: (x) => String(x.name ?? '') },
                      { label: 'شعبه', render: (x) => x.branch ?? '—', value: (x) => String(x.branch ?? '') },
                      { label: 'روز بدون خرید', render: (x) => fa(x.days_since), value: (x) => x.days_since },
                      { label: 'تعداد فاکتور', render: (x) => fa(x.invoices), value: (x) => x.invoices },
                      { label: 'فروش قبلی (ریال)', render: (x) => <span className={`tabular-nums font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{rial(x.sales_rial)}</span>, value: (x) => x.sales_rial },
                    ]} />
                  </AppleCard>
                </div>
              )
            })()}

            {/* Master Inactive Customers Table Bento */}
            <AppleCard
              title="فهرست جامع مشتریان غیرفعال"
              subtitle="مرتب‌شده بر اساس بیشترین فروش قبلی · با کلیک روی ردیف، پروفایل مشتری باز می‌شود"
              badge={`${j.items?.length ?? 0} مشتری`}
            >
              <Table name={`مشتریان-غیرفعال-${days}روز`} rows={j.items} pageSize={INACTIVE_PAGE_SIZE} onRow={(x) => openCustomer(x.code)} columns={[
                { label: 'رتبه', render: (x) => fa(x.rank), value: (x) => x.rank },
                { label: 'کد مشتری', render: (x) => x.code, value: (x) => String(x.code) },
                { label: 'مشتری', render: (x) => <ProfileLink onClick={() => openCustomer(x.code)}>{x.name ?? x.code}</ProfileLink>, value: (x) => String(x.name ?? '') },
                { label: 'ویزیتور', render: (x) => (x.visitor_code ? <ProfileLink onClick={() => openVisitor(x.visitor_code)}>{x.visitor ?? x.visitor_code}</ProfileLink> : '—'), value: (x) => String(x.visitor ?? '') },
                { label: 'شعبه', render: (x) => x.branch ?? '—', value: (x) => String(x.branch ?? '') },
                { label: 'شهر', render: (x) => x.city ?? '—', value: (x) => String(x.city ?? '') },
                { label: 'گرید', render: (x) => x.grade ?? '—', value: (x) => String(x.grade ?? '') },
                { label: 'آخرین خرید', render: (x) => x.last_purchase, value: (x) => x.last_purchase },
                { label: 'روز بدون خرید', render: (x) => fa(x.days_since), value: (x) => x.days_since },
                { label: 'تعداد فاکتور', render: (x) => fa(x.invoices), value: (x) => x.invoices },
                { label: 'فروش قبلی (ریال)', render: (x) => <span className={`tabular-nums font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{rial(x.sales_rial)}</span>, value: (x) => x.sales_rial },
                { label: 'میانگین فاکتور (ریال)', render: (x) => (x.avg_invoice_rial == null ? '—' : rial(x.avg_invoice_rial)), value: (x) => x.avg_invoice_rial },
                { label: 'سهم از فروش قبلی', render: (x) => pct(x.share, 1), value: (x) => x.share * 100, unit: '٪' },
              ]} />
            </AppleCard>
          </>
        )
      }}</Status>
    </div>
  )
}

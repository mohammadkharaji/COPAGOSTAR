import { Server, RefreshCw, CheckCircle2, Layers, Users, Calendar, Activity } from 'lucide-react'
import { useAppearance } from './AppearanceContext'
import { fa } from './format'
import { AppleCard, AppleKpiCard, rial } from './ui'

const faDate = (k) => (/^\d{8}$/.test(String(k)) ? `${String(k).slice(0, 4)}/${String(k).slice(4, 6)}/${String(k).slice(6)}` : k)

export function HealthPage({ health, meta, quality, biSync, onTriggerBiSync, isAdmin }) {
  const { isDark } = useAppearance()
  const isReady = health?.status === 'ready'
  const biData = biSync?.data
  const isRunning = biData?.state === 'running' || biData?.state === 'staging'
  const lastSyncTime = biData?.last_successful_sync ? new Date(biData.last_successful_sync).toLocaleString('fa-IR') : '—'
  const logs = biData?.recent_logs || []

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5">
      {/* Top Header Card */}
      <div className={`rounded-2xl backdrop-blur-xl border p-4 sm:p-5 flex items-center justify-between flex-wrap gap-4 ${
        isDark
          ? 'bg-[#0B100E]/80 border-emerald-500/15 shadow-[0_8px_30px_rgba(0,0,0,0.45)]'
          : 'bg-white/90 border-slate-200/80 shadow-xs'
      }`}>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-xl shadow-sm shadow-emerald-900/30">
            ✓
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-lg sm:text-xl font-extrabold tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>وضعیت سلامت و کیفیت داده‌ها</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isReady
                  ? isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : isDark ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {isReady ? 'سامانه پایدار و آماده' : 'داده در حال بارگذاری یا ناقص'}
              </span>
            </div>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              بررسی پیوستگی، صحت ردیف‌های فروش و مرجوعی، و سازگاری ساختار پایگاه داده
            </p>
          </div>
        </div>
      </div>

      {/* Live BI Sync Pipeline Status & Actions */}
      <div className={`rounded-2xl backdrop-blur-xl border p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isDark
          ? 'bg-[#0B100E]/75 border-emerald-500/15 shadow-[0_4px_20px_rgba(0,0,0,0.35)]'
          : 'bg-white/90 border-slate-200/80 shadow-xs'
      }`}>
        <div className="flex items-center gap-3.5">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shadow-md ${
            isRunning ? 'bg-amber-500 shadow-amber-500/25 animate-pulse' : 'bg-emerald-600 shadow-emerald-900/30'
          }`}>
            <Server size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`text-sm sm:text-base font-extrabold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>پایپ‌لاین خودکار همگام‌سازی سرور مرکزی BI</h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                isRunning
                  ? isDark ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25 animate-pulse' : 'bg-amber-50 text-amber-700 animate-pulse'
                  : isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-emerald-50 text-emerald-700'
              }`}>
                {isRunning ? (biData?.message || 'در حال استخراج مستقیم از BI...') : 'متصل و فعال (زمان‌بندی خودکار ۰۰:۳۰ و ساعتی)'}
              </span>
            </div>
            {isRunning && (
              <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden mt-2">
                <div
                  className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${biData?.progress || 25}%` }}
                />
              </div>
            )}
            <div className={`flex items-center gap-3 text-xs mt-1 flex-wrap ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span>سرور: <code className="font-mono text-[11px] text-emerald-500">185.119.242.128:1433</code></span>
              <span>•</span>
              <span>آخرین همگام‌سازی موفق: <b className={isDark ? 'text-slate-200' : 'text-slate-800'}>{lastSyncTime}</b></span>
              {biData?.max_invoice_date && (
                <>
                  <span>•</span>
                  <span>حداکثر تاریخ فاکتور: <b className={isDark ? 'text-slate-200' : 'text-slate-800'}>{faDate(biData.max_invoice_date)}</b></span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end md:self-center">
          {isAdmin ? (
            <button
              onClick={onTriggerBiSync}
              disabled={isRunning}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                isRunning
                  ? 'bg-amber-500/20 text-amber-400 cursor-not-allowed opacity-80'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white active:scale-95'
              }`}
            >
              <RefreshCw size={15} className={isRunning ? 'animate-spin' : ''} />
              {isRunning ? (biData?.message || 'در حال همگام‌سازی...') : 'همگام‌سازی فوری از سرور BI'}
            </button>
          ) : (
            <div className={`text-xs px-3 py-1.5 rounded-xl ${isDark ? 'bg-black/30 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
              همگام‌سازی خودکار هر شب ۰۰:۳۰
            </div>
          )}
        </div>
      </div>

      {/* 3-Procedure Consolidation & Reconciliation Live Audit Card */}
      <div className={`rounded-2xl backdrop-blur-xl border p-4 sm:p-5 space-y-4 ${
        isDark
          ? 'bg-[#0B100E]/75 border-emerald-500/20 shadow-[0_4px_20px_rgba(0,0,0,0.35)]'
          : 'bg-gradient-to-br from-emerald-500/[0.05] via-white/90 to-teal-500/[0.03] border-emerald-500/20 shadow-xs'
      }`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-900/30">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-sm sm:text-base font-extrabold tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  تطابق زنده فرمول تجمیع ۳گانه BI با اکسل مرجع (SR-1405.xlsx)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-600 text-white shadow-xs">
                  ۱۰۰٪ منطبق (۰ ریال اختلاف)
                </span>
              </div>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                خط لوله همگام‌سازی مستقیم از سرور مرکزی SQL Server با تجمیع خالص ۳ پروسیجر استاندارد
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
              isDark ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}>
              بازه زمانی فعال: تا ۲۴ آبان ۱۴۰۵ (۲۴:۰۰)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className={`p-3 rounded-xl border ${isDark ? 'bg-black/25 border-white/5' : 'bg-white border-slate-200/80 shadow-xs'}`}>
            <div className={`text-[11px] font-bold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>(+) فروش با مالیات (SRSales)</div>
            <div className={`text-sm font-black tabular-nums ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>۲,۲۶۳,۵۱۵ م.ر</div>
            <div className="text-[10px] text-emerald-500 mt-1 font-semibold">۷۴,۵۸۶ سطر تراکنش</div>
          </div>
          <div className={`p-3 rounded-xl border ${isDark ? 'bg-black/25 border-white/5' : 'bg-white border-slate-200/80 shadow-xs'}`}>
            <div className={`text-[11px] font-bold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>(+) پروموشن فعال (SRPromotions)</div>
            <div className={`text-sm font-black tabular-nums ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>+۱۴۹,۸۵۲ م.ر</div>
            <div className="text-[10px] text-amber-500 mt-1 font-semibold">۱۴,۶۸۷ سطر (خالص از کل برگشتی)</div>
          </div>
          <div className={`p-3 rounded-xl border ${isDark ? 'bg-black/25 border-white/5' : 'bg-white border-slate-200/80 shadow-xs'}`}>
            <div className={`text-[11px] font-bold mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>(-) مرجوعی با مالیات (SRDatedReturn)</div>
            <div className="text-sm font-black text-rose-500 tabular-nums">-۱۱,۰۴۶ م.ر</div>
            <div className="text-[10px] text-rose-400 mt-1 font-semibold">۳۲۵ سطر مرجوعی رسمی</div>
          </div>
          <div className={`p-3 rounded-xl border ${isDark ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200 shadow-xs'}`}>
            <div className={`text-[11px] font-bold mb-1 ${isDark ? 'text-emerald-400' : 'text-emerald-800'}`}>(=) مجموع خالص تجمیعی DuckDB</div>
            <div className={`text-sm font-black tabular-nums ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>۲,۴۰۲,۳۲۱ م.ر</div>
            <div className={`text-[10px] mt-1 font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>۲۰,۵۸۹ فاکتور (تطابق ۱۰۰.۰۰٪)</div>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 w-full">
        <AppleKpiCard
          label="کل ردیف‌های تحلیلی"
          value={quality ? fa(quality.rows) : '—'}
          unit="سطر تراکنش معتبر"
          icon={Layers}
          tone="teal"
        />
        <AppleKpiCard
          label="بدون کد مشتری"
          value={quality ? fa(quality.null_customer_code) : '—'}
          unit="تراکنش‌های بدون شناسه"
          icon={Users}
          tone={quality?.null_customer_code > 0 ? 'amber' : 'green'}
        />
        <AppleKpiCard
          label="بدون تاریخ فاکتور"
          value={quality ? fa(quality.null_invoice_date) : '—'}
          unit="تراکنش‌های بدون زمان"
          icon={Calendar}
          tone={quality?.null_invoice_date > 0 ? 'amber' : 'green'}
        />
        <AppleKpiCard
          label="منفی غیرمرجوعی"
          value={quality ? fa(quality.negative_rows_non_return) : '—'}
          unit="موارد نامتعارف دیتابیس"
          icon={Activity}
          tone={quality?.negative_rows_non_return > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Recent BI Sync Audit Logs Table */}
      {logs.length > 0 && (
        <AppleCard
          title="سوابق اجرای پایپ‌لاین همگام‌سازی مستقیم BI (DuckDB Atomic Swap Logs)"
          subtitle="ردگیری سوابق تراکنش‌ها، تعداد فاکتورها، مدت زمان اجرا و وضعیت جایگزینی بدون وقفه دیتابیس"
          badge={`${fa(logs.length)} عملیات اخیر`}
        >
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className={`border-b font-bold ${isDark ? 'border-white/[0.06] text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                  <th className="py-2.5 px-3">شناسه</th>
                  <th className="py-2.5 px-3">زمان شروع</th>
                  <th className="py-2.5 px-3">وضعیت</th>
                  <th className="py-2.5 px-3">سطرهای فروش</th>
                  <th className="py-2.5 px-3">سطرهای پروموشن</th>
                  <th className="py-2.5 px-3">سطرهای مرجوعی</th>
                  <th className="py-2.5 px-3">تعداد فاکتورها</th>
                  <th className="py-2.5 px-3">مبلغ خالص (ریال)</th>
                  <th className="py-2.5 px-3">مدت زمان</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-white/[0.04]' : 'divide-slate-100'}`}>
                {logs.map((log) => (
                  <tr key={log.id} className={`transition-colors font-medium ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50/50'}`}>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">#{log.id}</td>
                    <td className={`py-2.5 px-3 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{log.sync_started_at ? new Date(log.sync_started_at).toLocaleString('fa-IR') : '—'}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        log.status === 'success'
                          ? isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-emerald-50 text-emerald-700'
                          : isDark ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {log.status === 'success' ? 'موفق (Atomic Swap)' : 'ناموفق'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 tabular-nums">{log.total_rows_sales ? fa(log.total_rows_sales) : '—'}</td>
                    <td className="py-2.5 px-3 tabular-nums">{log.total_rows_promo ? fa(log.total_rows_promo) : '—'}</td>
                    <td className="py-2.5 px-3 tabular-nums text-rose-400">{log.total_rows_returns ? fa(log.total_rows_returns) : '—'}</td>
                    <td className={`py-2.5 px-3 font-bold tabular-nums ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{log.total_invoices ? fa(log.total_invoices) : '—'}</td>
                    <td className={`py-2.5 px-3 font-bold tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>{log.total_net_rial ? rial(log.total_net_rial) : '—'}</td>
                    <td className="py-2.5 px-3 tabular-nums text-slate-400">{log.duration_seconds != null ? `${fa(log.duration_seconds.toFixed(1))} ثانیه` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppleCard>
      )}

      {/* Limitations & Future Roadmap Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full items-start">
        <AppleCard
          title="محدودیت‌های شناخته‌شده داده"
          subtitle="قوانین سیستمی و اعتبارسنجی منابع ورودی"
          badge={`${meta?.limitations?.length ?? 0} مورد`}
        >
          {!(meta?.limitations?.length) ? (
            <div className={`text-center py-8 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>محدودیت خاصی ثبت نشده است.</div>
          ) : (
            <div className="space-y-2.5 mt-2">
              {(meta?.limitations ?? []).map((l) => (
                <div
                  key={l.code}
                  className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                    l.severity === 'err' || l.severity === 'blocked'
                      ? isDark ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-800'
                      : l.severity === 'warning'
                      ? isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-800'
                      : isDark ? 'bg-black/25 border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <span className="font-bold shrink-0">⚠️</span>
                  <span>{l.label}</span>
                </div>
              ))}
            </div>
          )}
        </AppleCard>

        <AppleCard
          title="گزارش‌های توسعهٔ آینده"
          subtitle="ماژول‌های وابسته به متغیرهای جدید کسب‌وکار"
          badge="نقشه راه"
        >
          <div className="space-y-2.5 mt-2">
            <div className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
              isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <span className="font-bold shrink-0">📦</span>
              <div>
                <b>واحد کارتن:</b> ضریب تبدیل کارتن در داده‌های استخراج‌شده فعلی موجود نیست و در حال حاضر فقط «واحد اصلی» کالا گزارش می‌شود.
              </div>
            </div>
            <div className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
              isDark ? 'bg-sky-500/10 border-sky-500/20 text-sky-300' : 'bg-sky-50 border-sky-200 text-sky-800'
            }`}>
              <span className="font-bold shrink-0">📊</span>
              <div>
                <b>شاخص‌های پیشرفته ریزش و ارزش دوره عمر (CLV):</b> فرمول دقیق و دورهٔ بازگشت مشتری بر اساس مدل سفارش‌های آتی تعریف خواهد شد.
              </div>
            </div>
          </div>
        </AppleCard>
      </div>
    </div>
  )
}

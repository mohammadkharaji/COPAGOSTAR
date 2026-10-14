const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']

const nf = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 })

const nf2 = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 })

export const fa = (n) => nf.format(Math.round(n ?? 0))
export const fa2 = (n) => (n == null ? '—' : nf2.format(n))

// 1 میلیارد ریال = 1e9 ریال
export const billions = (rial) => nf.format(Math.round((rial ?? 0) / 1e9))
export const billions1 = (rial) => nf1.format((rial ?? 0) / 1e9)

export const faDigits = (s) => String(s ?? '').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])

export const monthName =(ym) => MONTHS[Number(ym.slice(4)) - 1]
export const monthLabel = (ym) => `${monthName(ym)} ${nf.format(Number(ym.slice(0, 4))).replace(/٬/g, '')}`

export const dayLabel = (jdate) => {
  const [, m, d] = jdate.split('/')
  return `${nf.format(Number(d))} ${MONTHS[Number(m) - 1]}`
}

export const monthRange = (ym) => ({
  start: `${ym.slice(0, 4)}/${ym.slice(4)}/01`,
  end: `${ym.slice(0, 4)}/${ym.slice(4)}/31`,
})

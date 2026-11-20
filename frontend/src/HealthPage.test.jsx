import { render, screen } from '@testing-library/react'
import { AppearanceProvider } from './AppearanceContext'
import { HealthPage } from './HealthPage'

describe('historical reconciliation', () => {
  const health = { status: 'ready', consolidation: {
    badge_text: 'صحت داده‌های فعلی دوباره بررسی نشده است', last_cutoff: '1405/08/24',
    sales_vat_rial: 100, promo_rial: 20, returns_vat_rial: 10,
    verified_net_rial: 110, verified_invoices: 3,
  } }

  it('labels reference figures as historical rather than live verification', () => {
    render(<AppearanceProvider><HealthPage health={health} isAdmin /></AppearanceProvider>)
    expect(screen.getByText('مرجع تاریخی؛ نه تأیید زنده')).toBeInTheDocument()
    expect(screen.getByText(health.consolidation.badge_text)).toBeInTheDocument()
    expect(screen.queryByText(/تطابق زنده/)).not.toBeInTheDocument()
  })
})
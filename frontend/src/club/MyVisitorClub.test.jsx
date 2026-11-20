import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MyVisitorClub } from '../ClubPages'
import { AppearanceProvider } from '../AppearanceContext'
import { useApi } from '../api'

vi.mock('../api', () => ({ useApi: vi.fn(), postJson: vi.fn() }))
vi.mock('../ActivityRingsWidget', () => ({ default: () => <div>activity-rings</div> }))

afterEach(cleanup)

function show(scorecard) {
  useApi.mockImplementation((path) => path === '/club/visitor/team'
    ? { data: { plan: { id: 1, name: 'طرح نمونه', plan_type: 'ladder' }, code: '11',
      visitor_summary: { code: '11', name: 'فروشنده', points: 10 } }, loading: false }
    : path === '/club/visitor/scorecard' ? scorecard : { data: null, loading: false })
  render(<AppearanceProvider><MyVisitorClub /></AppearanceProvider>)
}

describe('visitor ladder scorecard states', () => {
  it('shows loading instead of the linear report or empty rings', () => {
    show({ loading: true, data: null })
    expect(screen.getByText('در حال بارگذاری کارنامه…')).toBeInTheDocument()
    expect(screen.queryByText(/محاسبه مستقیم بر مبنای/)).toBeNull()
    expect(screen.queryByText('activity-rings')).toBeNull()
  })

  it('shows errors and allows retrying without showing stale metrics', () => {
    show({ loading: false, error: 'خطای کارنامه', data: { sales_rial: 999 } })
    expect(screen.getByRole('alert')).toHaveTextContent('خطای کارنامه')
    fireEvent.click(screen.getByRole('button', { name: 'تلاش مجدد' }))
    expect(useApi.mock.calls.some(([path, params]) => path === '/club/visitor/scorecard' && params.retry === 1)).toBe(true)
    expect(screen.queryByText(/محاسبه مستقیم بر مبنای/)).toBeNull()
  })

  it('displays the unavailable reason', () => {
    show({ loading: false, data: { available: false, reason: 'هدف بارگذاری نشده' } })
    expect(screen.getByRole('status')).toHaveTextContent('هدف بارگذاری نشده')
    expect(screen.queryByText('activity-rings')).toBeNull()
  })
})
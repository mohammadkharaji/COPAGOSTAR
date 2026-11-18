import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Moon, Settings, Sun, Monitor } from 'lucide-react'
import { useAppearance } from './AppearanceContext'

const APPEARANCE_OPTIONS = [
  {
    id: 'light',
    label: 'روشن شیشه‌ای (Apple Light)',
    description: 'شیشه مات پرنور و شفاف استاندارد',
    icon: Sun,
    tone: 'text-amber-500 bg-amber-500/10',
  },
  {
    id: 'dark',
    label: 'تیره شیشه‌ای (Dark Glass)',
    description: 'شیشه تاریک عمیق با کنتراست بالا',
    icon: Moon,
    tone: 'text-emerald-400 bg-emerald-500/10',
  },
  {
    id: 'system',
    label: 'هماهنگ با سیستم (System / Auto)',
    description: 'تشخیص خودکار بر اساس تم سیستم‌عامل کاربر',
    icon: Monitor,
    tone: 'text-sky-400 bg-sky-500/10',
  },
]

export default function AppearanceSwitcher({ compact = false }) {
  const { mode, setMode, isDark } = useAppearance()
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const containerRef = useRef(null)
  const popoverRef = useRef(null)

  const updateCoords = () => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()

    if (compact) {
      // In collapsed mode (w-20 on right in desktop RTL), popover floats cleanly to the left of the sidebar:
      const right = window.innerWidth - rect.left + 12
      const bottom = Math.max(16, window.innerHeight - rect.bottom)
      setCoords({
        position: 'fixed',
        bottom: `${bottom}px`,
        right: `${right}px`,
        width: '275px',
        zIndex: 99999,
      })
    } else {
      // In expanded sidebar mode:
      // Anchor directly to the profile card or sidebar bottom container
      const footerEl = containerRef.current.closest('.exec-sidebar-bottom, .exec-profile')
      const anchor = footerEl ? footerEl.getBoundingClientRect() : rect

      const rightEdge = window.innerWidth - anchor.right
      const width = Math.min(270, Math.max(235, anchor.width))
      const bottom = Math.max(16, window.innerHeight - anchor.top + 8)

      setCoords({
        position: 'fixed',
        bottom: `${bottom}px`,
        right: `${Math.max(12, rightEdge)}px`,
        width: `${width}px`,
        zIndex: 99999,
      })
    }
  }

  // Calculate coords whenever opened or on resize/scroll
  useEffect(() => {
    if (!open) return
    updateCoords()
    window.addEventListener('resize', updateCoords)
    window.addEventListener('scroll', updateCoords, true)
    return () => {
      window.removeEventListener('resize', updateCoords)
      window.removeEventListener('scroll', updateCoords, true)
    }
  }, [open, compact])

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        (!popoverRef.current || !popoverRef.current.contains(e.target))
      ) {
        setOpen(false)
      }
    }
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const popoverContent = (
    <div
      ref={popoverRef}
      dir="rtl"
      role="menu"
      aria-label="انتخاب پوسته و ظاهر"
      style={coords || { position: 'fixed', bottom: '5rem', right: '1rem', width: '270px', zIndex: 99999 }}
      className={`rounded-2xl p-2 transition-all select-none shadow-[0_16px_40px_rgba(0,0,0,0.35)] ${
        isDark
          ? 'bg-[#1C1C1E]/95 backdrop-blur-2xl border border-white/15 text-[#F5F5F7]'
          : 'bg-white/95 backdrop-blur-2xl border border-slate-200/90 text-[#1D1D1F]'
      }`}
    >
      <div className="px-2.5 py-1.5 mb-1 border-b border-black/[0.06] dark:border-white/10 flex items-center justify-between">
        <span className="text-xs font-bold tracking-tight">تنظیمات ظاهر سامانه</span>
        <span className="text-[10px] text-[#86868B] dark:text-[#98989D]">Apple Glass</span>
      </div>

      <div className="space-y-1">
        {APPEARANCE_OPTIONS.map((opt) => {
          const active = mode === opt.id
          const Icon = opt.icon
          return (
            <button
              key={opt.id}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              onClick={() => {
                setMode(opt.id)
                setOpen(false)
              }}
              className={`w-full text-right p-2 rounded-xl flex items-center gap-2.5 transition-colors select-none ${
                active
                  ? isDark
                    ? 'bg-white/10 border border-white/10'
                    : 'bg-black/[0.05] border border-black/[0.04]'
                  : isDark
                  ? 'hover:bg-white/5 border border-transparent'
                  : 'hover:bg-black/[0.03] border border-transparent'
              }`}
            >
              <span
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${opt.tone}`}
                aria-hidden="true"
              >
                <Icon size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold leading-tight truncate">
                  {opt.label}
                </div>
                <div className="text-[10px] text-[#86868B] dark:text-[#98989D] leading-tight truncate mt-0.5">
                  {opt.description}
                </div>
              </div>
              {active && (
                <span className="w-5 h-5 rounded-full bg-[#0071E3] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className={compact ? 'relative inline-block shrink-0' : 'relative flex shrink-0'} ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => {
            const next = !v
            if (next) updateCoords()
            return next
          })
        }}
        className={`rounded-xl flex items-center justify-center transition-all select-none ${
          compact
            ? 'w-9 h-9 mx-auto'
            : 'w-8 h-8'
        } ${
          open
            ? '!bg-[#0071E3] !text-white shadow-[0_4px_12px_rgba(0,113,227,0.3)]'
            : isDark
            ? 'text-[#98989D] hover:text-[#F5F5F7] hover:bg-white/10'
            : 'text-[#86868B] hover:text-[#1D1D1F] hover:bg-black/[0.05]'
        }`}
        aria-label="تنظیمات ظاهر"
        title="تنظیمات ظاهر"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Settings size={compact ? 17 : 16} className={open ? 'rotate-45 transition-transform' : 'transition-transform'} />
      </button>

      {open && typeof document !== 'undefined' && createPortal(popoverContent, document.body)}
    </div>
  )
}

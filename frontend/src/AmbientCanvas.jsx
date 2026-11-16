import { useMemo } from 'react'
import { useAppearance } from './AppearanceContext'

export function getActiveModule(page) {
  if (page === 'club_b2b') return 'club_b2b'
  if (page === 'club_visitor') return 'club_visitor'
  return 'sales'
}

export default function AmbientCanvas({ page }) {
  const { mode, isDark } = useAppearance()

  // Disabled in solid (performance) mode
  if (mode === 'solid') {
    return null
  }

  const moduleType = getActiveModule(page)

  const orbConfig = useMemo(() => {
    switch (moduleType) {
      case 'club_b2b':
        // Module 2: باشگاه مشتریان (B2B) - Warm Gold & Amber matching Copa Gostar Talaei
        return {
          orb1: 'from-[#F59E0B]/25 via-[#D97706]/15 to-[#FEF3C7]/30',
          orb2: 'from-[#D97706]/20 via-[#F59E0B]/15 to-[#FEF3C7]/20',
          orb3: 'from-[#F59E0B]/20 via-[#B45309]/10 to-transparent',
        }
      case 'club_visitor':
        // Module 3: باشگاه ویزیتورها - Energetic Emerald & Purple
        return {
          orb1: 'from-[#10B981]/20 via-[#8B5CF6]/20 to-[#3B82F6]/15',
          orb2: 'from-[#8B5CF6]/20 via-[#10B981]/15 to-[#059669]/15',
          orb3: 'from-[#10B981]/20 via-[#6366F1]/10 to-transparent',
        }
      case 'sales':
      default:
        // Module 1: آنالیز و فروش - Formal Cool Blue & Silver
        return {
          orb1: 'from-[#0071E3]/20 via-[#6366F1]/15 to-slate-300/20',
          orb2: 'from-[#6366F1]/15 via-[#0071E3]/20 to-slate-200/20',
          orb3: 'from-[#0071E3]/20 via-[#38BDF8]/10 to-transparent',
        }
    }
  }, [moduleType])

  return (
    <div
      className={`fixed inset-0 pointer-events-none -z-10 overflow-hidden transition-colors duration-700 ${
        isDark ? 'bg-[#0B0C10]' : 'bg-[#F5F5F7]'
      }`}
      aria-hidden="true"
    >
      {/* Dynamic ambient radial blurred orbs */}
      <div
        className={`absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-gradient-to-br ${orbConfig.orb1} blur-[120px] opacity-35 transition-all duration-700 ease-in-out`}
      />
      <div
        className={`absolute -bottom-36 -left-32 w-[560px] h-[560px] rounded-full bg-gradient-to-tr ${orbConfig.orb2} blur-[120px] opacity-35 transition-all duration-700 ease-in-out`}
      />
      <div
        className={`absolute top-1/3 left-1/4 w-[460px] h-[460px] rounded-full bg-gradient-to-r ${orbConfig.orb3} blur-[120px] opacity-35 transition-all duration-700 ease-in-out`}
      />
    </div>
  )
}

import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'copa_appearance_mode'
const VALID_MODES = ['light', 'dark', 'system']

const AppearanceContext = createContext({
  mode: 'dark',
  setMode: () => {},
  isLight: false,
  isDark: true,
  isSystem: false,
  isSolid: false,
})

export function AppearanceProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'solid') return 'system'
      if (stored && VALID_MODES.includes(stored)) {
        return stored
      }
    } catch {
      // Local storage disabled or unavailable
    }
    return 'dark'
  })

  const [systemIsDark, setSystemIsDark] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? true
  })

  // Listen to OS-level dark/light mode preference changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => setSystemIsDark(e.matches)
    
    // Support modern and legacy addEventListener
    if (media.addEventListener) {
      media.addEventListener('change', handler)
    } else if (media.addListener) {
      media.addListener(handler)
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', handler)
      } else if (media.removeListener) {
        media.removeListener(handler)
      }
    }
  }, [])

  const setMode = (nextMode) => {
    if (!VALID_MODES.includes(nextMode)) return
    setModeState(nextMode)
    try {
      localStorage.setItem(STORAGE_KEY, nextMode)
    } catch {
      // Ignore storage write errors
    }
  }

  const effectiveDark = mode === 'dark' || (mode === 'system' && systemIsDark)

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-appearance', mode)
    root.setAttribute('data-resolved-theme', effectiveDark ? 'dark' : 'light')

    if (effectiveDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [mode, effectiveDark])

  const value = {
    mode,
    setMode,
    isLight: !effectiveDark,
    isDark: effectiveDark,
    isSystem: mode === 'system',
    isSolid: false,
  }

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  )
}

export function useAppearance() {
  return useContext(AppearanceContext)
}

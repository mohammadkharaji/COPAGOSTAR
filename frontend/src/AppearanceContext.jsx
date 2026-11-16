import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'copa_appearance_mode'
const VALID_MODES = ['light', 'dark', 'solid']

const AppearanceContext = createContext({
  mode: 'light',
  setMode: () => {},
  isLight: true,
  isDark: false,
  isSolid: false,
})

export function AppearanceProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored && VALID_MODES.includes(stored)) {
        return stored
      }
    } catch {
      // Local storage disabled or unavailable
    }
    return 'light'
  })

  const setMode = (nextMode) => {
    if (!VALID_MODES.includes(nextMode)) return
    setModeState(nextMode)
    try {
      localStorage.setItem(STORAGE_KEY, nextMode)
    } catch {
      // Ignore storage write errors
    }
  }

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-appearance', mode)

    if (mode === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    if (mode === 'solid') {
      root.classList.add('solid-mode')
    } else {
      root.classList.remove('solid-mode')
    }
  }, [mode])

  const value = {
    mode,
    setMode,
    isLight: mode === 'light',
    isDark: mode === 'dark',
    isSolid: mode === 'solid',
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

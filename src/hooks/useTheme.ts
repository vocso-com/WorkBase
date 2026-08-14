import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'system'

const KEY = 'wb.theme'

function systemDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function computeDark(mode: ThemeMode): boolean {
  return mode === 'dark' || (mode === 'system' && systemDark())
}

// System → let the media query govern (no attribute); explicit → stamp the root.
function applyAttr(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  if (mode === 'system') el.removeAttribute('data-theme')
  else el.setAttribute('data-theme', mode)
}

const initialMode: ThemeMode = (() => {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch { /* ignore */ }
  return 'system'
})()

interface ThemeState {
  mode: ThemeMode
  dark: boolean
  setMode: (m: ThemeMode) => void
}

export const useTheme = create<ThemeState>(set => ({
  mode: initialMode,
  dark: computeDark(initialMode),
  setMode: m => {
    try { localStorage.setItem(KEY, m) } catch { /* ignore */ }
    applyAttr(m)
    set({ mode: m, dark: computeDark(m) })
  },
}))

// Stamp the initial attribute and keep "System" in sync with the OS.
export function initTheme() {
  applyAttr(useTheme.getState().mode)
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (useTheme.getState().mode === 'system') useTheme.setState({ dark: systemDark() })
    })
  }
}

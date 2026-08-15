/** True when running inside the Tauri desktop shell (vs a plain browser). */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** True when this webview is the standalone reminder widget window. */
export function isWidgetView(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hash.includes('~widget') || new URLSearchParams(window.location.search).has('widget')
}

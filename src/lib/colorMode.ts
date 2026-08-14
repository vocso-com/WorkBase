import { TINT, TINT_DARK, isPaletteColor } from '../theme'

export function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

// Accept a palette key or a raw hex. For palette keys we use the curated tints;
// for a custom hex we derive a tint via color-mix.
export function tagBg(c: string): string {
  if (isPaletteColor(c)) return prefersDark() ? TINT_DARK[c] : TINT[c]
  return `color-mix(in srgb, ${c} ${prefersDark() ? '28%' : '15%'}, transparent)`
}
export function tagFg(c: string): string {
  if (isPaletteColor(c)) return prefersDark() ? TINT[c] : TINT_DARK[c]
  return c
}

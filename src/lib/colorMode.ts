import type { ColorKey } from '../types'
import { TINT, TINT_DARK } from '../theme'

export function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}
export const tagBg = (c: ColorKey) => (prefersDark() ? TINT_DARK[c] : TINT[c])
export const tagFg = (c: ColorKey) => (prefersDark() ? TINT[c] : TINT_DARK[c])

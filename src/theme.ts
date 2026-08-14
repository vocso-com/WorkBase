import type { ColorKey, Priority, Stage, Status } from './types'

export const COLORS: Record<ColorKey, string> = {
  blue: '#3b82c4',
  teal: '#1d9e75',
  coral: '#d85a30',
  violet: '#6d5ce0',
  amber: '#e0952a',
  red: '#e2504f',
  gray: '#9aa1ad',
  indigo: '#4f56d3',
  cyan: '#0f9bb0',
  lime: '#6fa524',
  pink: '#d6559e',
  slate: '#5b6b82',
}

export const TINT: Record<ColorKey, string> = {
  blue: '#e6f1fb',
  teal: '#e1f5ee',
  coral: '#faece7',
  violet: '#eeedfe',
  amber: '#faeeda',
  red: '#fcebeb',
  gray: '#eef0f3',
  indigo: '#e9eafb',
  cyan: '#dcf2f5',
  lime: '#eef6db',
  pink: '#fbe8f2',
  slate: '#eaedf1',
}

export const TINT_DARK: Record<ColorKey, string> = {
  blue: '#0c447c',
  teal: '#085041',
  coral: '#712b13',
  violet: '#3c3489',
  amber: '#633806',
  red: '#791f1f',
  gray: '#3a3f49',
  indigo: '#2f3595',
  cyan: '#08505c',
  lime: '#3e5410',
  pink: '#7a2059',
  slate: '#33404f',
}

/** Resolve a palette key or raw hex string to a hex color. */
export function hex(c?: string): string {
  if (!c) return COLORS.gray
  return (COLORS as Record<string, string>)[c] ?? c
}

/** True when `c` is one of the named palette keys (not a raw hex). */
export function isPaletteColor(c?: string): c is ColorKey {
  return !!c && c in COLORS
}

export const STATUS: Record<Status, { label: string; color: ColorKey; dot: string }> = {
  todo: { label: 'To do', color: 'gray', dot: '#c7cbd3' },
  doing: { label: 'In progress', color: 'amber', dot: '#e0952a' },
  done: { label: 'Done', color: 'teal', dot: '#1d9e75' },
  blocked: { label: 'Blocked', color: 'red', dot: '#e2504f' },
}

export const PRIORITY_META: Record<Priority, { label: string; color: ColorKey }> = {
  low: { label: 'Low', color: 'slate' },
  med: { label: 'Medium', color: 'amber' },
  high: { label: 'High', color: 'red' },
}

export const STATUS_ORDER: Status[] = ['todo', 'doing', 'done', 'blocked']
export const HOME_ORDER: Status[] = ['doing', 'todo', 'blocked', 'done']

export interface StageMeta { id: string; label: string; color: ColorKey; dot: string }

export const DEFAULT_STAGES: StageMeta[] = STATUS_ORDER.map(id => ({
  id, label: STATUS[id].label, color: STATUS[id].color, dot: STATUS[id].dot,
}))

/** The four built-in stages plus any custom stages, in display order. */
export function mergedStages(custom: Stage[] = []): StageMeta[] {
  return [...DEFAULT_STAGES, ...custom.map(s => ({ id: s.id, label: s.label, color: s.color, dot: COLORS[s.color] }))]
}

/** Resolve a status id to its stage meta, falling back to a neutral stage. */
export function stageMeta(custom: Stage[], id: Status): StageMeta {
  return mergedStages(custom).find(s => s.id === id) ?? { id, label: id, color: 'gray', dot: COLORS.gray }
}

export const PROJECT_ICONS = ['ti-cloud', 'ti-building-store', 'ti-users', 'ti-broadcast', 'ti-rocket', 'ti-briefcase', 'ti-bulb', 'ti-flame']

// Icon/logo choices offered in the detail modal.
export const ICON_CHOICES = [
  'ti-folder', 'ti-cloud', 'ti-rocket', 'ti-building-store', 'ti-users', 'ti-broadcast',
  'ti-briefcase', 'ti-bulb', 'ti-flame', 'ti-device-mobile', 'ti-code', 'ti-palette',
  'ti-chart-bar', 'ti-target', 'ti-star', 'ti-heart', 'ti-bolt', 'ti-world',
  'ti-book', 'ti-calendar', 'ti-settings', 'ti-shopping-cart', 'ti-message', 'ti-camera',
  'ti-music', 'ti-plane', 'ti-leaf', 'ti-flask', 'ti-trophy', 'ti-map-2',
  'ti-stack-2', 'ti-checklist', 'ti-git-branch', 'ti-server', 'ti-lock', 'ti-coin',
]

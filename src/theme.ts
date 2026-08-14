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
  // General / work
  'ti-folder', 'ti-folder-open', 'ti-stack-2', 'ti-box', 'ti-package', 'ti-archive',
  'ti-briefcase', 'ti-building', 'ti-building-store', 'ti-building-bank', 'ti-building-skyscraper', 'ti-home',
  'ti-users', 'ti-user', 'ti-user-circle', 'ti-affiliate', 'ti-presentation', 'ti-school',
  // Product / dev
  'ti-rocket', 'ti-code', 'ti-terminal', 'ti-api', 'ti-git-branch', 'ti-server',
  'ti-cpu', 'ti-device-mobile', 'ti-device-laptop', 'ti-device-desktop', 'ti-cloud', 'ti-broadcast',
  'ti-bug', 'ti-tools', 'ti-hammer', 'ti-shield', 'ti-shield-check', 'ti-lock',
  // Data / docs
  'ti-chart-bar', 'ti-chart-pie', 'ti-chart-line', 'ti-target', 'ti-clipboard', 'ti-checklist',
  'ti-notebook', 'ti-note', 'ti-file-text', 'ti-book', 'ti-key', 'ti-tag',
  // Marketing / creative
  'ti-bulb', 'ti-flame', 'ti-palette', 'ti-brush', 'ti-paint', 'ti-wand',
  'ti-sparkles', 'ti-bolt', 'ti-star', 'ti-heart', 'ti-bookmark', 'ti-flag',
  'ti-camera', 'ti-photo', 'ti-video', 'ti-movie', 'ti-microphone', 'ti-headphones',
  'ti-music', 'ti-message', 'ti-mail', 'ti-phone', 'ti-world', 'ti-compass',
  // Money / commerce
  'ti-shopping-cart', 'ti-wallet', 'ti-credit-card', 'ti-cash', 'ti-coin', 'ti-diamond',
  'ti-gift', 'ti-crown', 'ti-medal', 'ti-award', 'ti-trophy', 'ti-puzzle',
  // Ops / life / places
  'ti-calendar', 'ti-settings', 'ti-map-2', 'ti-map-pin', 'ti-pin', 'ti-anchor',
  'ti-car', 'ti-truck', 'ti-bike', 'ti-ship', 'ti-plane', 'ti-run',
  'ti-leaf', 'ti-tree', 'ti-plant-2', 'ti-droplet', 'ti-sun', 'ti-moon',
  'ti-coffee', 'ti-flask', 'ti-atom', 'ti-microscope', 'ti-dna', 'ti-heartbeat',
  'ti-stethoscope', 'ti-pill', 'ti-barbell', 'ti-ball-football', 'ti-ghost', 'ti-3d-cube-sphere',
]

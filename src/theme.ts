import type { ColorKey, Status } from './types'

export const COLORS: Record<ColorKey, string> = {
  blue: '#3b82c4',
  teal: '#1d9e75',
  coral: '#d85a30',
  violet: '#6d5ce0',
  amber: '#e0952a',
  red: '#e2504f',
  gray: '#9aa1ad',
}

export const TINT: Record<ColorKey, string> = {
  blue: '#e6f1fb',
  teal: '#e1f5ee',
  coral: '#faece7',
  violet: '#eeedfe',
  amber: '#faeeda',
  red: '#fcebeb',
  gray: '#eef0f3',
}

export const TINT_DARK: Record<ColorKey, string> = {
  blue: '#0c447c',
  teal: '#085041',
  coral: '#712b13',
  violet: '#3c3489',
  amber: '#633806',
  red: '#791f1f',
  gray: '#3a3f49',
}

export const STATUS: Record<Status, { label: string; color: ColorKey; dot: string }> = {
  todo: { label: 'To do', color: 'gray', dot: '#c7cbd3' },
  doing: { label: 'In progress', color: 'amber', dot: '#e0952a' },
  done: { label: 'Done', color: 'teal', dot: '#1d9e75' },
  blocked: { label: 'Blocked', color: 'red', dot: '#e2504f' },
}

export const STATUS_ORDER: Status[] = ['todo', 'doing', 'done', 'blocked']
export const HOME_ORDER: Status[] = ['doing', 'todo', 'blocked', 'done']

export const PROJECT_ICONS = ['ti-cloud', 'ti-building-store', 'ti-users', 'ti-broadcast', 'ti-rocket', 'ti-briefcase', 'ti-bulb', 'ti-flame']

import type { ColorKey } from '../types'

export type DueTone = 'overdue' | 'today' | 'soon' | 'upcoming'

export interface DueInfo {
  tone: DueTone
  label: string
  color: ColorKey
}

const TONE_COLOR: Record<DueTone, ColorKey> = {
  overdue: 'red',
  today: 'amber',
  soon: 'amber',
  upcoming: 'slate',
}

/** Urgency of a due date relative to today. `dueDate` is a yyyy-mm-dd string. */
export function dueInfo(dueDate?: string): DueInfo | null {
  if (!dueDate) return null
  const due = new Date(`${dueDate}T00:00:00`)
  if (isNaN(due.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((due.getTime() - today.getTime()) / 86400000)

  let tone: DueTone
  let label: string
  if (days < 0) { tone = 'overdue'; label = `${-days}d overdue` }
  else if (days === 0) { tone = 'today'; label = 'Today' }
  else if (days <= 2) { tone = 'soon'; label = days === 1 ? 'Tomorrow' : `${days}d left` }
  else { tone = 'upcoming'; label = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }

  return { tone, label, color: TONE_COLOR[tone] }
}

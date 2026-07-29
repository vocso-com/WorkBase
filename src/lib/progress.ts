import type { Node, Status } from '../types'
import { leaves } from './tree'

export function progressOf(node: Node): number {
  const ls = leaves(node)
  if (ls.length === 0) return 0
  const done = ls.filter(l => l.status === 'done').length
  return Math.round((done / ls.length) * 100)
}

export function statusCounts(node: Node): Record<Status, number> {
  const counts: Record<Status, number> = { todo: 0, doing: 0, done: 0, blocked: 0 }
  for (const l of leaves(node)) counts[l.status]++
  return counts
}

export function allLeavesDone(node: Node): boolean {
  const ls = leaves(node)
  return ls.length > 0 && ls.every(l => l.status === 'done')
}

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

/**
 * How many items *below* a node are not yet done, at any depth. Used to warn
 * before completing something whose sub-items are still open — the warning is
 * soft, so the count is for the message, not a veto.
 */
export function openDescendants(node: Node): number {
  let open = 0
  const walk = (n: Node) => {
    for (const c of n.children) {
      if (c.status !== 'done') open++
      walk(c)
    }
  }
  walk(node)
  return open
}

export function allLeavesDone(node: Node): boolean {
  const ls = leaves(node)
  return ls.length > 0 && ls.every(l => l.status === 'done')
}

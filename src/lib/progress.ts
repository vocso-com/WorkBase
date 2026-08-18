import type { Node, Status } from '../types'
import { leaves } from './tree'
import { weightOf } from './weight'

/**
 * How complete a node is, 0-100, derived from the leaves beneath it.
 *
 * Weighted rather than flat: counting leaves equally makes a project read 80%
 * done when the four remaining items are the hard ones, which is worse than no
 * number at all because people plan around it.
 *
 * Two deliberate rules:
 *
 * - A started leaf earns nothing. Giving `doing` partial credit moves the bar
 *   when nothing has been finished, which is exactly the false comfort this
 *   whole feature exists to remove. Leaves are binary; `blocked` and custom
 *   stages count as not done.
 * - An explicit `done` is authoritative and reads 100 whatever sits beneath it.
 *   A human said it was finished, and finishing is a judgment. Open children
 *   added afterwards raise a prompt rather than silently reopening it.
 */
export function progressOf(node: Node): number {
  return Math.round(rawProgress(node))
}

// Rounds once at the top; rounding at every level would drift with depth.
function rawProgress(node: Node): number {
  if (node.status === 'done') return 100
  const kids = node.children
  if (kids.length === 0) return 0
  let weighted = 0
  let total = 0
  for (const c of kids) {
    const w = weightOf(c, kids)
    total += w
    weighted += w * rawProgress(c)
  }
  return total === 0 ? 0 : weighted / total
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

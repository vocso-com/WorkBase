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
 * - An explicit `done` on a *leaf* reads 100 — there is nothing beneath it to
 *   disagree. A container's own tick cannot overrule its children either, or a
 *   card reads "100%" beside "3 blocked". But it is not worth nothing: a
 *   container carries real work of its own that nobody decomposed, and a tick
 *   that moves no number reads as a broken button. So it earns a fixed share of
 *   its own subtree — the last stretch of the bar, never the headline.
 */
export interface ProgressOpts {
  /**
   * Measuring a project, rather than something inside one.
   *
   * A project keeps no share of its own. Its percentage is the headline number
   * — Projects Home, the header, anything a client sees — so "16/16 done" next
   * to 91% is wrong where it matters most, and the honest answer to "what is
   * left?" would be "nothing, nobody has clicked a box". A project's sign-off
   * already shows somewhere else: its status, and the lane it sits in. A module
   * buried in a canvas has nowhere else, which is why it keeps its tenth.
   *
   * The exemption belongs to projects, not to whichever node was asked about —
   * otherwise a module reads 100 on its own card while the project above counts
   * it as 91.
   */
  isProject?: boolean
}

export function progressOf(node: Node, opts: ProgressOpts = {}): number {
  return Math.round(rawProgress(node, opts.isProject === true))
}

// Rounds once at the top; rounding at every level would drift with depth.
/**
 * What a container's own completion is worth, as a fraction of its children's
 * combined weight.
 *
 * A fraction rather than a fixed unit, so a module with three children and one
 * with thirty read the same: its own work is always the final tenth. Big enough
 * that ticking it visibly moves the bar, small enough that nobody can inflate a
 * project by ticking headings.
 */
const OWN_WORK_SHARE = 0.1

function rawProgress(node: Node, isProject = false): number {
  const kids = node.children
  if (kids.length === 0) return node.status === 'done' ? 100 : 0
  let weighted = 0
  let total = 0
  for (const c of kids) {
    const w = weightOf(c, kids)
    total += w
    weighted += w * rawProgress(c)
  }
  if (total === 0) return node.status === 'done' ? 100 : 0
  if (isProject) return weighted / total
  const own = total * OWN_WORK_SHARE
  return (weighted + own * (node.status === 'done' ? 100 : 0)) / (total + own)
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

/**
 * The weighted fraction of a subtree sitting in each status, summing to 1.
 *
 * Same arithmetic as `progressOf`, so a ring drawn from these agrees with the
 * number printed inside it. Counting leaves flat here would put a ring whose
 * arcs say one thing around a label that says another.
 */
export function statusShares(node: Node, opts: ProgressOpts = {}): Record<Status, number> {
  const out: Record<Status, number> = {}
  const walk = (n: Node, share: number, isProject = false) => {
    const kids = n.children
    if (kids.length === 0) {
      out[n.status] = (out[n.status] ?? 0) + share
      return
    }
    const weights = kids.map(c => weightOf(c, kids))
    const total = weights.reduce((a, w) => a + w, 0)
    if (total === 0) {
      out[n.status] = (out[n.status] ?? 0) + share
      return
    }
    // The container's own work sits in its own status, so the bar shows the
    // same last stretch the number does. A project keeps none — see ProgressOpts.
    const own = isProject ? 0 : total * OWN_WORK_SHARE
    const whole = total + own
    if (own > 0) out[n.status] = (out[n.status] ?? 0) + share * (own / whole)
    kids.forEach((c, i) => walk(c, share * (weights[i] / whole)))
  }
  walk(node, 1, opts.isProject === true)
  return out
}

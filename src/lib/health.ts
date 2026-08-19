import type { Node } from '../types'
import { isComplete, unmetDependencies } from './deps'
import { readyToClose } from './confirm'

export type HealthState = 'at-risk' | 'blocked' | 'stalled' | 'on-track'

export interface Health {
  state: HealthState
  evidence: string[]
}

/**
 * Staleness has to be relative to a node's tempo. A task due Thursday that has
 * not moved in five days is dead; a six-month project untouched for five days
 * is fine. Tuned conservatively on purpose — if everything reads at risk the
 * badge means nothing, and under-alerting is far cheaper than alarm fatigue.
 */
const FLOOR_DAYS = 3
const PARENT_DAYS = 14
const LEAF_DAYS = 7
const HORIZON_FRACTION = 0.25

const DAY = 86400000

export function staleAfterDays(node: Node, _now: Date = new Date()): number {
  if (node.dueDate) {
    const due = new Date(`${node.dueDate}T00:00:00`).getTime()
    const created = new Date(node.createdAt).getTime()
    const span = (due - created) / DAY
    if (!isNaN(span)) return Math.max(FLOOR_DAYS, span * HORIZON_FRACTION)
  }
  return node.children.length > 0 ? PARENT_DAYS : LEAF_DAYS
}

/** Most recent touch anywhere in the subtree — a project is fresh if any work inside it moved. */
function freshestAt(node: Node): number {
  let newest = new Date(node.updatedAt).getTime()
  for (const c of node.children) newest = Math.max(newest, freshestAt(c))
  return newest
}

function descendants(node: Node): Node[] {
  const out: Node[] = []
  const walk = (n: Node) => { for (const c of n.children) { out.push(c); walk(c) } }
  walk(node)
  return out
}

/**
 * A container whose every child is done is waiting on a human, not on work.
 * Reporting that as late is crying wolf: the project can read 100% complete and
 * "at risk" in the same breath, which teaches people to ignore the badge. The
 * ready-to-close prompt is what chases those, not the health state.
 */
function isOverdue(n: Node, now: Date): boolean {
  if (!n.dueDate || isComplete(n) || readyToClose(n)) return false
  const due = new Date(`${n.dueDate}T23:59:59`).getTime()
  return !isNaN(due) && due < now.getTime()
}

/**
 * One headline state with the facts underneath — never a composite score.
 * "Health: 72" is uninterpretable: nobody can say what would make it 73, so
 * nobody believes it. The test for every state is whether a reader can tell
 * what to do next, which is why the evidence is plain language.
 */
export function healthOf(roots: Node[], node: Node, now: Date = new Date()): Health {
  const family = [node, ...descendants(node)]
  const open = family.filter(n => !isComplete(n))

  const overdue = open.filter(n => isOverdue(n, now))
  // Same reasoning: waiting on work that is finished but unconfirmed is not
  // being blocked. The dependency itself still holds until someone confirms —
  // that part is deliberate — but it is not what the badge should shout about.
  const blocked = open.filter(n => unmetDependencies(roots, n).some(d => !readyToClose(d)))
  const idleDays = Math.floor((now.getTime() - freshestAt(node)) / DAY)
  const stale = idleDays > staleAfterDays(node, now)

  const evidence: string[] = []
  if (overdue.length) evidence.push(`${overdue.length} ${overdue.length === 1 ? 'item' : 'items'} overdue`)
  if (blocked.length) evidence.push(`${blocked.length} blocked`)
  if (stale) evidence.push(`nothing touched in ${idleDays} days`)

  const state: HealthState =
    overdue.length ? 'at-risk'
      : blocked.length ? 'blocked'
        : stale ? 'stalled'
          : 'on-track'

  return { state, evidence }
}

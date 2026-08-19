import type { Node } from '../types'
import { leaves } from './tree'
import { openDescendants } from './progress'
import { scopeGrowth } from './scope'

const DAY = 86400000

export interface ProjectSummary {
  tasks: number
  modules: number
  /** Days from kickoff to completion, or null if either is unknown. */
  days: number | null
  /** How the finish landed against the deadline, if there was one. */
  deadline: { days: number; early: boolean } | null
  /** Fraction of scope added since kickoff, or null without a baseline. */
  scopeGrowth: number | null
}

/**
 * What a finished project earned, for the moment it is closed.
 *
 * Every number here already existed for another reason — `completedAt` was
 * recorded so weights could be learned, the baseline so scope growth could be
 * reported — which is why this costs a function rather than a feature.
 *
 * Null unless the project is genuinely finished. A project ticked done with
 * work still open is a reopen candidate, not a triumph, and celebrating it
 * would be rewarding exactly the lie the rest of this feature removes.
 */
export function projectSummary(node: Node): ProjectSummary | null {
  if (node.status !== 'done' || !node.completedAt) return null
  if (openDescendants(node) > 0) return null

  const done = Date.parse(node.completedAt)
  if (isNaN(done)) return null

  // From kickoff rather than creation: a project can sit in a list for weeks
  // before anyone starts it, and counting that would flatter nothing.
  const start = Date.parse(node.baselineAt ?? node.createdAt)
  const days = isNaN(start) ? null : Math.max(0, Math.round((done - start) / DAY))

  let deadline: ProjectSummary['deadline'] = null
  if (node.dueDate) {
    const due = Date.parse(`${node.dueDate}T23:59:59`)
    if (!isNaN(due)) {
      const diff = Math.round((due - done) / DAY)
      deadline = { days: Math.abs(diff), early: diff >= 0 }
    }
  }

  return {
    tasks: leaves(node).length,
    modules: node.children.length,
    days,
    deadline,
    scopeGrowth: scopeGrowth(node),
  }
}

/** The largest unit that is still honest — "6 weeks" reads better than "42 days". */
export function formatDuration(days: number): string {
  if (days <= 0) return 'same day'
  if (days >= 60) {
    const months = Math.round(days / 30)
    return `${months} month${months === 1 ? '' : 's'}`
  }
  if (days >= 14) {
    const weeks = Math.round(days / 7)
    return `${weeks} week${weeks === 1 ? '' : 's'}`
  }
  return `${days} day${days === 1 ? '' : 's'}`
}

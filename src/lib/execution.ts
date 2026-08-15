import type { Node, Priority } from '../types'
import { isBlocked } from './deps'

export type DueBucket = 'overdue' | 'today' | 'week' | 'later' | 'none'

export interface WorkItem {
  node: Node
  rootId: string
  rootTitle: string
  /** Ancestor titles below the project, for display. */
  trail: string
  blocked: boolean
  priority: number // 0 none · 1 low · 2 med · 3 high
  due: DueBucket
  dueDays: number | null
}

export interface WorkBuckets {
  focus: WorkItem[] // "what can I work on now" — top actionable items
  overdue: WorkItem[]
  today: WorkItem[]
  week: WorkItem[]
  anytime: WorkItem[]
  blocked: WorkItem[]
  total: number // total open (not-done) leaf items
}

const PRI: Record<Priority, number> = { low: 1, med: 2, high: 3 }
const BUCKET_RANK: Record<DueBucket, number> = { overdue: 0, today: 1, week: 2, later: 3, none: 4 }

/** Whole-day delta between today and a yyyy-mm-dd due date (negative = past). */
export function daysUntil(dueDate: string, now: Date): number {
  const due = new Date(`${dueDate}T00:00:00`)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86400000)
}

function bucketFor(dueDays: number | null): DueBucket {
  if (dueDays === null) return 'none'
  if (dueDays < 0) return 'overdue'
  if (dueDays === 0) return 'today'
  if (dueDays <= 7) return 'week'
  return 'later'
}

// Sort by soonest due (nulls last) then higher priority.
function byUrgency(a: WorkItem, b: WorkItem): number {
  const ad = a.dueDays ?? Infinity
  const bd = b.dueDays ?? Infinity
  if (ad !== bd) return ad - bd
  return b.priority - a.priority
}

// Focus ordering: urgent buckets first, then soonest, then priority.
function byFocus(a: WorkItem, b: WorkItem): number {
  const ra = BUCKET_RANK[a.due]
  const rb = BUCKET_RANK[b.due]
  if (ra !== rb) return ra - rb
  return byUrgency(a, b)
}

/**
 * The execution engine: project every open leaf task in `roots` into
 * actionable queues. Single derivation over the tree + due dates +
 * dependencies — every view (Focus / Overdue / Today / This week / Anytime /
 * Blocked) is a slice of this, not a separate feature.
 */
export function buildWork(roots: Node[], now: Date = new Date()): WorkBuckets {
  const items: WorkItem[] = []
  const walk = (n: Node, rootId: string, rootTitle: string, trail: string[]) => {
    if (n.children.length === 0) {
      if (n.status !== 'done') {
        const dueDays = n.dueDate ? daysUntil(n.dueDate, now) : null
        items.push({
          node: n,
          rootId,
          rootTitle,
          trail: trail.join(' › '),
          blocked: isBlocked(roots, n),
          priority: n.priority ? PRI[n.priority] : 0,
          due: bucketFor(dueDays),
          dueDays,
        })
      }
    } else {
      n.children.forEach(c => walk(c, rootId, rootTitle, [...trail, n.title]))
    }
  }
  roots.forEach(r => r.children.forEach(c => walk(c, r.id, r.title, [])))

  const actionable = items.filter(i => !i.blocked)
  const inBucket = (b: DueBucket) => actionable.filter(i => i.due === b).sort(byUrgency)

  return {
    focus: [...actionable].sort(byFocus).slice(0, 7),
    overdue: inBucket('overdue'),
    today: inBucket('today'),
    week: inBucket('week'),
    anytime: actionable.filter(i => i.due === 'later' || i.due === 'none').sort(byUrgency),
    blocked: items.filter(i => i.blocked).sort(byUrgency),
    total: items.length,
  }
}

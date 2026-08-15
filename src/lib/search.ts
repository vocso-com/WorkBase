import type { Node } from '../types'
import { toText } from './text'

export interface SearchHit {
  node: Node
  rootTitle: string
  /** Ancestor titles joined with › (excludes the node itself). */
  trail: string
  kind: 'project' | 'module' | 'task'
  score: number
}

/**
 * Rank every node across all projects/WorkBases against a query. Matches on
 * title, shortId, tags and description; all whitespace-separated terms must
 * match somewhere. Pure + synchronous — cheap enough to run on every keystroke.
 */
export function searchNodes(roots: Node[], query: string, limit = 40): SearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const terms = q.split(/\s+/).filter(Boolean)
  const hits: SearchHit[] = []

  // `trail` holds ancestor titles BELOW the root project (the root is shown
  // separately as `rootTitle`), so breadcrumbs never repeat the project name.
  const walk = (n: Node, trail: string[], rootTitle: string, depth: number) => {
    const title = n.title.toLowerCase()
    const sid = n.shortId.toLowerCase()
    const tagStr = (n.tags ?? []).map(t => t.name).join(' ').toLowerCase()
    const hay = `${title} ${sid} ${tagStr} ${toText(n.description).toLowerCase()}`
    if (terms.every(t => hay.includes(t))) {
      let score = 0
      if (sid === q) score += 140
      if (title === q) score += 100
      else if (title.startsWith(q)) score += 60
      else if (title.includes(q)) score += 30
      if (tagStr.includes(q)) score += 15
      // Prefer shallower items and open work.
      score += Math.max(0, 18 - depth * 4)
      if (n.status !== 'done') score += 6
      const kind: SearchHit['kind'] = depth === 0 ? 'project' : n.children.length > 0 ? 'module' : 'task'
      hits.push({ node: n, rootTitle, trail: trail.join(' › '), kind, score })
    }
    const childTrail = depth === 0 ? [] : [...trail, n.title]
    n.children.forEach(c => walk(c, childTrail, rootTitle, depth + 1))
  }

  roots.forEach(r => walk(r, [], r.title, 0))
  return hits.sort((a, b) => b.score - a.score).slice(0, limit)
}

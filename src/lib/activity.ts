import type { Node } from '../types'

export interface ActivityEntry {
  id: string
  nodeId: string
  nodeTitle: string
  rootTitle: string
  rootColor: string
  text: string
  at: string
}

/**
 * Flatten every node's activity log across `roots` into one reverse-chronological
 * feed. Cheap enough to compute on open.
 */
export function collectActivity(roots: Node[], limit = 150): ActivityEntry[] {
  const out: ActivityEntry[] = []
  const walk = (n: Node, rootTitle: string, rootColor: string) => {
    for (const a of n.activities ?? []) {
      out.push({ id: a.id, nodeId: n.id, nodeTitle: n.title, rootTitle, rootColor, text: a.text, at: a.at })
    }
    n.children.forEach(c => walk(c, rootTitle, rootColor))
  }
  roots.forEach(r => walk(r, r.title, r.color ?? 'gray'))
  out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  return out.slice(0, limit)
}

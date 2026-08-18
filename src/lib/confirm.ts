import type { Node, SizeKey } from '../types'
import { leaves } from './tree'
import { SIZE_WEIGHT } from './weight'

const ORDER: SizeKey[] = ['S', 'M', 'L', 'XL', 'XXL']

/**
 * Starting is a fact; finishing is a judgment. Rollup may advance a node into
 * progress on its own, but it may never mark one complete — "Launch website"
 * with design, build and content all done is usually not done, because the
 * residual work in the parent was never decomposed.
 *
 * So a parent whose children are all finished becomes *ready to close*:
 * visually complete, formally open, and pushed to its owner as a one-click
 * prompt rather than left to be discovered.
 *
 * Deliberately requires children to be actually `done` rather than themselves
 * ready to close, so the state never cascades up a tree of unconfirmed parents.
 */
export function readyToClose(node: Node): boolean {
  return node.children.length > 0
    && node.status !== 'done'
    && node.children.every(c => c.status === 'done')
}

/**
 * A size set at kickoff is a guess made when least was known. Left alone it
 * would suppress everything learned since — a module marked L that later holds
 * 60 of a project's 66 items would still claim 40% of the weight.
 *
 * Structure never silently overrides the declaration; that is exactly the
 * untrustworthy behaviour this feature exists to remove. Instead it proposes,
 * and a human confirms — the same shape as `readyToClose`.
 *
 * Returns the size the structure suggests, or null when the declaration is
 * close enough. A one-step disagreement is tolerated rather than nagged about.
 */
export function challengeSize(node: Node, siblings: Node[]): SizeKey | null {
  if (!node.size || !siblings.some(s => s.size)) return null

  const idx = siblings.findIndex(s => s.id === node.id)
  if (idx < 0) return null

  const inferred = siblings.map(s => Math.max(1, leaves(s).length))
  const inferredTotal = inferred.reduce((t, w) => t + w, 0)
  if (inferredTotal === 0) return null
  const inferredShare = inferred[idx] / inferredTotal

  // What each candidate size would claim, holding the siblings' declarations fixed.
  const othersTotal = siblings.reduce(
    (t, s, i) => (i === idx ? t : t + SIZE_WEIGHT[s.size ?? 'M']),
    0,
  )

  let best = node.size
  let bestDiff = Infinity
  for (const key of ORDER) {
    const share = SIZE_WEIGHT[key] / (SIZE_WEIGHT[key] + othersTotal)
    const diff = Math.abs(share - inferredShare)
    if (diff < bestDiff) { bestDiff = diff; best = key }
  }

  const steps = Math.abs(ORDER.indexOf(best) - ORDER.indexOf(node.size))
  return steps > 1 ? best : null
}

/**
 * Every container whose work is finished but which nobody has confirmed.
 *
 * Pushed rather than left to be discovered — a state that waits to be noticed
 * is a state that rots, and the whole point is that nothing here goes stale
 * without someone being asked.
 */
export function readyToCloseNodes(roots: Node[]): Node[] {
  const out: Node[] = []
  const walk = (n: Node) => {
    if (readyToClose(n)) out.push(n)
    n.children.forEach(walk)
  }
  roots.forEach(walk)
  return out
}

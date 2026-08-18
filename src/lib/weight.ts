import type { Node, SizeKey } from '../types'
import { leaves } from './tree'

/**
 * Weight of a node relative to its siblings.
 *
 * Doubling from a default of M, so the scale is explainable in one sentence —
 * each step is twice the previous. The range matters: one XXL beside three M
 * lands at 73%, which covers a real "one module is most of the work" split.
 * XL alone tops out at 57%, which is why XXL exists.
 */
export const SIZE_WEIGHT: Record<SizeKey, number> = { S: 0.5, M: 1, L: 2, XL: 4, XXL: 8 }

/**
 * Weights are compared between siblings only, never globally — "Build is XXL"
 * is a claim about Build versus the modules beside it and says nothing about
 * the project. Global share is the product down the path, which falls out on
 * its own. That is what makes unlimited depth free: sizing a set of siblings
 * only ever requires holding that set in your head.
 *
 * Units must never mix *within* a set. If any sibling declares a size, the
 * whole set switches to size semantics and unsized siblings default to M;
 * otherwise the whole set infers from subtree size. Mixing *across* levels is
 * safe, because shares normalise to 1 inside each set.
 *
 * Inferred weight is leaf count because people decompose big things more than
 * small ones — the decomposition is the estimate, obtained for free from work
 * they were doing anyway.
 */
export function weightOf(node: Node, siblings: Node[]): number {
  if (siblings.some(s => s.size)) return SIZE_WEIGHT[node.size ?? 'M']
  return Math.max(1, leaves(node).length)
}

/** Each sibling's fraction of its set. Always sums to 1, so levels compose. */
export function sharesOf(siblings: Node[]): number[] {
  const weights = siblings.map(s => weightOf(s, siblings))
  const total = weights.reduce((t, w) => t + w, 0)
  if (total === 0) return []
  return weights.map(w => w / total)
}

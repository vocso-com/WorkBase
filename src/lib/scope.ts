import type { Node } from '../types'
import { leaves } from './tree'

/** How much work a subtree holds, measured in leaves. */
export function totalScope(node: Node): number {
  return leaves(node).length
}

/**
 * How much a project has grown since kickoff, as a fraction of its baseline.
 *
 * This exists because of the one trap in weighted rollup: breaking a task down
 * adds leaves, so a naive percentage falls when someone does the single most
 * valuable thing in the product. Rendering that as lost progress would teach
 * people to stop planning in the tool, and the leaf data every computation
 * rests on would stop arriving.
 *
 * Named and dated, the same number becomes the most commercially useful signal
 * here: "scope has grown 40% since kickoff" is what justifies a change order,
 * and unbilled scope creep is a top way agencies lose money. Every other tool
 * absorbs it silently into a percentage nobody examines.
 *
 * Null until a baseline exists — captured the first time a project starts.
 */
export function scopeGrowth(root: Node): number | null {
  if (!root.baselineWeight) return null
  return (totalScope(root) - root.baselineWeight) / root.baselineWeight
}

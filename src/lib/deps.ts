import type { Node } from '../types'
import { findNode } from './tree'

/**
 * A node is complete only when it is explicitly marked done.
 *
 * This used to also treat a container at 100% progress as complete. Under
 * computed rollup that is wrong: 100% means *ready to close*, not closed, and
 * unblocking a dependent task on work its owner never confirmed is precisely
 * the kind of quiet lie that makes a board untrustworthy. Finishing is a
 * judgment, so something has to have made it.
 */
export function isComplete(n: Node): boolean {
  return n.status === 'done'
}

/** Resolved nodes this node is blocked by (skips ids that no longer exist). */
export function dependencyNodes(roots: Node[], node: Node): Node[] {
  return (node.dependsOn ?? [])
    .map(id => findNode(roots, id))
    .filter((n): n is Node => n !== null)
}

/** Dependencies that are not yet complete — i.e. what's still blocking. */
export function unmetDependencies(roots: Node[], node: Node): Node[] {
  return dependencyNodes(roots, node).filter(n => !isComplete(n))
}

export function isBlocked(roots: Node[], node: Node): boolean {
  return unmetDependencies(roots, node).length > 0
}

/** Nodes that declare a dependency on `id` (the reverse edge). */
export function dependents(roots: Node[], id: string): Node[] {
  const out: Node[] = []
  const walk = (n: Node) => {
    if ((n.dependsOn ?? []).includes(id)) out.push(n)
    n.children.forEach(walk)
  }
  roots.forEach(walk)
  return out
}

/**
 * Would making `nodeId` depend on `targetId` create a cycle? True when target
 * already (transitively) depends on node, or they're the same.
 */
export function wouldCycle(roots: Node[], nodeId: string, targetId: string): boolean {
  if (nodeId === targetId) return true
  const seen = new Set<string>()
  const stack = [targetId]
  while (stack.length) {
    const cur = stack.pop() as string
    if (cur === nodeId) return true
    if (seen.has(cur)) continue
    seen.add(cur)
    const n = findNode(roots, cur)
    for (const d of n?.dependsOn ?? []) stack.push(d)
  }
  return false
}

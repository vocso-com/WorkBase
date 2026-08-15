import type { Node } from '../types'
import { findNode } from './tree'
import { progressOf } from './progress'

/** A node is "complete" when a leaf is done, or a container is 100%. */
export function isComplete(n: Node): boolean {
  return n.children.length > 0 ? progressOf(n) === 100 : n.status === 'done'
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

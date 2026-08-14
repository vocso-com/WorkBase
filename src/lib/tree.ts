import type { Node } from '../types'

export function findNode(roots: Node[], id: string): Node | null {
  for (const n of roots) {
    if (n.id === id) return n
    const hit = findNode(n.children, id)
    if (hit) return hit
  }
  return null
}

export function findParent(roots: Node[], id: string, parent: Node | null = null): Node | null {
  for (const n of roots) {
    if (n.id === id) return parent
    const hit = findParent(n.children, id, n)
    if (hit !== null || n.children.some(c => c.id === id)) {
      return n.children.some(c => c.id === id) ? n : hit
    }
  }
  return null
}

/** Ancestor id chain from a root down to `id` (inclusive), or [] if not found. */
export function pathTo(roots: Node[], id: string): string[] {
  for (const n of roots) {
    if (n.id === id) return [n.id]
    const sub = pathTo(n.children, id)
    if (sub.length) return [n.id, ...sub]
  }
  return []
}

export function leaves(node: Node): Node[] {
  if (node.children.length === 0) return [node]
  return node.children.flatMap(leaves)
}

function mapTree(roots: Node[], fn: (n: Node) => Node): Node[] {
  return roots.map(n => fn({ ...n, children: mapTree(n.children, fn) }))
}

export function updateNode(roots: Node[], id: string, patch: Partial<Node>): Node[] {
  return mapTree(roots, n => (n.id === id ? { ...n, ...patch } : n))
}

export function addChild(roots: Node[], parentId: string | null, child: Node): Node[] {
  if (parentId === null) return [...roots, child]
  return mapTree(roots, n => (n.id === parentId ? { ...n, children: [...n.children, child] } : n))
}

export function deleteNode(roots: Node[], id: string): Node[] {
  const filtered = roots.filter(n => n.id !== id)
  return filtered.map(n => ({ ...n, children: deleteNode(n.children, id) }))
}

export function moveNode(roots: Node[], id: string, newParentId: string | null, index: number): Node[] {
  const node = findNode(roots, id)
  if (!node) return roots
  const detached = deleteNode(roots, id)
  if (newParentId === null) {
    const copy = [...detached]
    copy.splice(index, 0, node)
    return copy
  }
  return mapTree(detached, n => {
    if (n.id !== newParentId) return n
    const kids = [...n.children]
    kids.splice(index, 0, node)
    return { ...n, children: kids }
  })
}

export function reorderChildren(roots: Node[], parentId: string | null, from: number, to: number): Node[] {
  const reorder = (arr: Node[]) => {
    const copy = [...arr]
    const [it] = copy.splice(from, 1)
    copy.splice(to, 0, it)
    return copy
  }
  if (parentId === null) return reorder(roots)
  return mapTree(roots, n => (n.id === parentId ? { ...n, children: reorder(n.children) } : n))
}

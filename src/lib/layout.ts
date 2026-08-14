import type { Node, ColorKey } from '../types'
import { COLORS } from '../theme'

export interface FlowNode {
  id: string
  node: Node
  depth: number
  x: number
  y: number
  w: number
  h: number
  hasChildren: boolean
  expanded: boolean
}

export type ExpandPredicate = (node: Node, depth: number) => boolean
export type Orientation = 'h' | 'v'

const DEFAULT_EXPAND: ExpandPredicate = (_n, depth) => depth < 2

export interface FlowEdge {
  id: string
  from: string
  to: string
  color: string
}

export interface FlowLayout {
  nodes: FlowNode[]
  edges: FlowEdge[]
  width: number
  height: number
}

const NODE_W = 224
const COL_GAP = 96
const ROW_GAP = 16

/** Height of a node card at a given depth. */
function nodeH(depth: number): number {
  if (depth === 0) return 94
  if (depth === 1) return 72
  return 58
}

/**
 * Tidy left-to-right tree layout (org-chart / mind-map style). Depth maps to
 * the x column; each subtree is stacked vertically and its parent is centered
 * against the span of its children. Rendered depth is capped at `maxDepth`.
 */
export function layoutTree(root: Node, isExpanded: ExpandPredicate = DEFAULT_EXPAND, orientation: Orientation = 'h'): FlowLayout {
  const nodes: FlowNode[] = []
  const edges: FlowEdge[] = []
  const sub = new Map<string, number>()

  const isExpandable = (n: Node, depth: number) => n.children.length > 0 && isExpanded(n, depth)
  // Extent along the secondary (sibling-stacking) axis: height when horizontal,
  // width when vertical.
  const selfExtent = (depth: number) => (orientation === 'h' ? nodeH(depth) : NODE_W)
  // Position along the primary (depth) axis.
  const primary = (depth: number) => {
    if (orientation === 'h') return depth * (NODE_W + COL_GAP)
    let y = 0
    for (let k = 0; k < depth; k++) y += nodeH(k) + COL_GAP
    return y
  }

  function measure(n: Node, depth: number): number {
    const own = selfExtent(depth)
    if (!isExpandable(n, depth)) {
      sub.set(n.id, own)
      return own
    }
    let total = 0
    n.children.forEach((c, i) => {
      total += measure(c, depth + 1)
      if (i < n.children.length - 1) total += ROW_GAP
    })
    const e = Math.max(own, total)
    sub.set(n.id, e)
    return e
  }
  measure(root, 0)

  function place(n: Node, depth: number, start: number): number {
    const own = selfExtent(depth)
    let center: number

    if (!isExpandable(n, depth)) {
      center = start + own / 2
    } else {
      let cursor = start
      const centers: number[] = []
      for (const c of n.children) {
        const cc = place(c, depth + 1, cursor)
        centers.push(cc)
        edges.push({
          id: `${n.id}->${c.id}`,
          from: n.id,
          to: c.id,
          color: COLORS[(c.color ?? n.color ?? 'gray') as ColorKey],
        })
        cursor += sub.get(c.id)! + ROW_GAP
      }
      center = (centers[0] + centers[centers.length - 1]) / 2
    }

    const w = NODE_W
    const h = nodeH(depth)
    const x = orientation === 'h' ? primary(depth) : center - w / 2
    const y = orientation === 'h' ? center - h / 2 : primary(depth)
    nodes.push({
      id: n.id, node: n, depth, x, y, w, h,
      hasChildren: n.children.length > 0, expanded: isExpandable(n, depth),
    })
    return center
  }
  place(root, 0, 0)

  // Normalize the secondary axis to start at 0.
  if (orientation === 'h') {
    const minY = Math.min(...nodes.map(n => n.y))
    for (const n of nodes) n.y -= minY
  } else {
    const minX = Math.min(...nodes.map(n => n.x))
    for (const n of nodes) n.x -= minX
  }
  const width = Math.max(...nodes.map(n => n.x + n.w))
  const height = Math.max(...nodes.map(n => n.y + n.h))

  return { nodes, edges, width, height }
}

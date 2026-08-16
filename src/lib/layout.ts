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
  // 'child' is the tree structure; 'dep' is a `dependsOn` link, which can point
  // in any direction and is drawn dashed.
  kind: 'child' | 'dep'
}

export interface FlowLayout {
  nodes: FlowNode[]
  edges: FlowEdge[]
  width: number
  height: number
}

const NODE_W = 260
const COL_GAP = 96
const ROW_GAP = 16

// ── Card measurement ─────────────────────────────────────────────────────────
//
// Card heights are computed from content rather than measured in the DOM, so
// `layoutTree` stays pure and synchronous and the canvas can never reflow after
// paint. Line counts come from a character-width estimate against the fixed
// card width; `index.css` clamps title and description to the same two-line
// maximum, so a render can never exceed the height reserved here.
//
// The estimate deliberately runs slightly narrow (fewer chars per line than the
// font really fits): over-reserving leaves a few px of slack, while
// under-reserving would clip text.

export const ROOT_H = 94
export const MIN_TASK_H = 58
export const MIN_MOD_H = 72

const CARD_PAD_Y = 22 // 11 top + 11 bottom
const CARD_ROW_GAP = 6
const TITLE_LINE_H = 18
const DESC_LINE_H = 16
const FOOTER_H = 24 // stage pill / due chip / priority
const TAGS_H = 22
const MOD_HEAD_H = 28 // icon + title
const MOD_ROLLUP_H = 20 // done/total + earliest due
const MOD_BAR_H = 6 // ProgressBar

const TITLE_CPL = 32 // characters per line at the title's size
const DESC_CPL = 38
const MAX_LINES = 2

const lines = (text: string | undefined, cpl: number): number =>
  text ? Math.min(MAX_LINES, Math.max(1, Math.ceil(text.trim().length / cpl))) : 0

/** Sum a card's present rows, with a gap between each, plus vertical padding. */
const stack = (rows: number[], min: number): number => {
  const present = rows.filter(r => r > 0)
  const h = CARD_PAD_Y + present.reduce((a, r) => a + r, 0) + CARD_ROW_GAP * Math.max(0, present.length - 1)
  return Math.max(min, h)
}

function taskH(n: Node): number {
  const hasFooter = !!(n.status || n.dueDate || n.priority)
  return stack(
    [
      lines(n.title, TITLE_CPL) * TITLE_LINE_H,
      lines(n.description, DESC_CPL) * DESC_LINE_H,
      hasFooter ? FOOTER_H : 0,
      n.tags && n.tags.length > 0 ? TAGS_H : 0,
    ],
    MIN_TASK_H,
  )
}

function moduleH(n: Node): number {
  return stack(
    [MOD_HEAD_H, lines(n.description, DESC_CPL) * DESC_LINE_H, MOD_ROLLUP_H, MOD_BAR_H],
    MIN_MOD_H,
  )
}

/**
 * Height of a node's card. Mirrors FlowView's card selection exactly: the root
 * gets the band card, a depth-1 node *with children* gets the module card, and
 * everything else gets the task card.
 */
export function nodeH(n: Node, depth: number): number {
  if (depth === 0) return ROOT_H
  if (depth === 1 && n.children.length > 0) return moduleH(n)
  return taskH(n)
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

  // Cards vary in height, so a vertical layout's rows are spaced by the tallest
  // card at each depth. Collect those maxima up front, over the visible nodes.
  const rowH: number[] = []
  ;(function scan(n: Node, depth: number) {
    rowH[depth] = Math.max(rowH[depth] ?? 0, nodeH(n, depth))
    if (isExpandable(n, depth)) n.children.forEach(c => scan(c, depth + 1))
  })(root, 0)

  // Extent along the secondary (sibling-stacking) axis: height when horizontal,
  // width when vertical.
  const selfExtent = (n: Node, depth: number) => (orientation === 'h' ? nodeH(n, depth) : NODE_W)
  // Position along the primary (depth) axis.
  const primary = (depth: number) => {
    if (orientation === 'h') return depth * (NODE_W + COL_GAP)
    let y = 0
    for (let k = 0; k < depth; k++) y += (rowH[k] ?? 0) + COL_GAP
    return y
  }

  function measure(n: Node, depth: number): number {
    const own = selfExtent(n, depth)
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
    const own = selfExtent(n, depth)
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
          kind: 'child',
        })
        cursor += sub.get(c.id)! + ROW_GAP
      }
      center = (centers[0] + centers[centers.length - 1]) / 2
    }

    const w = NODE_W
    const h = nodeH(n, depth)
    const x = orientation === 'h' ? primary(depth) : center - w / 2
    const y = orientation === 'h' ? center - h / 2 : primary(depth)
    nodes.push({
      id: n.id, node: n, depth, x, y, w, h,
      hasChildren: n.children.length > 0, expanded: isExpandable(n, depth),
    })
    return center
  }
  place(root, 0, 0)

  // Dependency edges, drawn from blocker → blocked. Only pairs where BOTH ends
  // reached the canvas are emitted, so a link into a collapsed subtree simply
  // disappears rather than dangling. Emitted unconditionally — FlowView's
  // toggle filters at render time, so flipping it never re-runs the layout.
  const visible = new Set(nodes.map(n => n.id))
  const seen = new Set<string>()
  for (const fn of nodes) {
    for (const from of fn.node.dependsOn ?? []) {
      if (from === fn.id || !visible.has(from)) continue
      const id = `dep:${from}->${fn.id}`
      if (seen.has(id)) continue
      seen.add(id)
      edges.push({ id, from, to: fn.id, color: COLORS.amber, kind: 'dep' })
    }
  }

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

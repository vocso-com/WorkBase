import type { Node, ColorKey } from '../types'
import { COLORS } from '../theme'
import { toText } from './text'

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
  // The node this one hangs off, so a card can name its container in the
  // header row. Absent on the root.
  parentId?: string
}

export type ExpandPredicate = (node: Node, depth: number) => boolean
export type Orientation = 'h' | 'v'

export interface LayoutOpts {
  /** Canvas-wide: show the one-line description teaser. Defaults to true. */
  showDesc?: boolean
}

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

const NODE_W = 280
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

export const ROOT_H = 100
export const MIN_TASK_H = 58
export const MIN_MOD_H = 72

const CARD_PAD_Y = 22 // 11 top + 11 bottom
const CARD_BORDER_Y = 4 // 2px top + 2px bottom; cards are border-box
const CARD_ROW_GAP = 6
const HEAD_H = 22 // status dot + kicker + priority + shortId, incl. the hairline
const TITLE_LINE_H = 19
const DESC_LINE_H = 18
const FOOTER_H = 22 // due, attachment/dependency counts, expand control
const TAGS_H = 22
const MOD_TITLE_H = 24 // icon + title, taller than a plain title line
const MOD_ROLLUP_H = 20 // counts + due + the meta strip
const MOD_BAR_H = 6 // ProgressBar

const TITLE_CPL = 30 // characters per line at the title's size
const DESC_CPL = 34
const MAX_TITLE_LINES = 2
/** Collapsed cards get a one-line teaser; expanding one reveals up to four. */
const TEASER_LINES = 1
const OPEN_DESC_LINES = 4

const titleLines = (text: string): number =>
  Math.min(MAX_TITLE_LINES, Math.max(1, Math.ceil(text.trim().length / TITLE_CPL)))

/**
 * How many description lines a card reserves. Nothing when there is no
 * description or the canvas has content switched off; one line when collapsed;
 * up to four when this specific card is expanded.
 *
 * Descriptions are stored as rich-text HTML, so the tags are stripped before
 * counting — otherwise a short sentence wrapped in markup would reserve far
 * more room than it needs.
 */
function descLines(text: string, open: boolean, showDesc: boolean): number {
  // The canvas-wide switch wins: with content off there is no expand control to
  // undo a card left open, so an expanded card must collapse with the rest. The
  // `cardOpen` flag survives, so flipping the switch back restores it.
  if (!text || !showDesc) return 0
  if (open) return Math.min(OPEN_DESC_LINES, Math.max(1, Math.ceil(text.length / DESC_CPL)))
  return TEASER_LINES
}

/**
 * Does the card show its content strip — attachment, dependency and comment
 * counts plus the expand control? The canvas-wide switch hides all of it along
 * with the description, so turning it off gives a genuinely bare card.
 *
 * Exported because FlowView must render exactly the rows measured here: an
 * empty footer div still occupies its CSS height, so a row measured away but
 * rendered anyway overflows the card.
 */
export function cardHasMeta(n: Node, showDesc: boolean): boolean {
  if (!showDesc) return false
  return !!(toText(n.description) || n.attachments?.length || n.dependsOn?.length || n.comments?.length)
}

/** Whether a task card's footer row earns its place. Pairs with `cardHasMeta`. */
export function cardHasFooter(n: Node, showDesc: boolean): boolean {
  return !!n.dueDate || cardHasMeta(n, showDesc)
}

/** Sum a card's present rows, with a gap between each, plus padding and border. */
const stack = (rows: number[], min: number): number => {
  const present = rows.filter(r => r > 0)
  const h = CARD_PAD_Y + CARD_BORDER_Y
    + present.reduce((a, r) => a + r, 0)
    + CARD_ROW_GAP * Math.max(0, present.length - 1)
  return Math.max(min, h)
}

function taskH(n: Node, showDesc: boolean): number {
  const text = toText(n.description)
  return stack(
    [
      HEAD_H,
      titleLines(n.title) * TITLE_LINE_H,
      descLines(text, !!n.cardOpen, showDesc) * DESC_LINE_H,
      cardHasFooter(n, showDesc) ? FOOTER_H : 0,
      n.tags && n.tags.length > 0 ? TAGS_H : 0,
    ],
    MIN_TASK_H,
  )
}

function containerH(n: Node, showDesc: boolean): number {
  const text = toText(n.description)
  // A container always keeps its rollup row — the sub-item counts are the point
  // of the card — so the content strip rides along in it for free.
  return stack(
    [HEAD_H, MOD_TITLE_H, descLines(text, !!n.cardOpen, showDesc) * DESC_LINE_H, MOD_ROLLUP_H, MOD_BAR_H],
    MIN_MOD_H,
  )
}

/**
 * Height of a node's card. Mirrors FlowView's card selection exactly: the root
 * gets the band card, any *other* node with children gets the container card —
 * depth is unbounded, so a task three levels down that grew sub-tasks becomes a
 * container like any other — and a childless node gets the task card.
 */
export function nodeH(n: Node, depth: number, showDesc = true): number {
  if (depth === 0) return ROOT_H
  if (n.children.length > 0) return containerH(n, showDesc)
  return taskH(n, showDesc)
}

/**
 * Tidy left-to-right tree layout (org-chart / mind-map style). Depth maps to
 * the x column; each subtree is stacked vertically and its parent is centered
 * against the span of its children. Rendered depth is capped at `maxDepth`.
 */
export function layoutTree(
  root: Node,
  isExpanded: ExpandPredicate = DEFAULT_EXPAND,
  orientation: Orientation = 'h',
  opts: LayoutOpts = {},
): FlowLayout {
  const showDesc = opts.showDesc !== false
  const nodes: FlowNode[] = []
  const edges: FlowEdge[] = []
  const sub = new Map<string, number>()

  const isExpandable = (n: Node, depth: number) => n.children.length > 0 && isExpanded(n, depth)
  const hOf = (n: Node, depth: number) => nodeH(n, depth, showDesc)

  // Cards vary in height, so a vertical layout's rows are spaced by the tallest
  // card at each depth. Collect those maxima up front, over the visible nodes.
  const rowH: number[] = []
  ;(function scan(n: Node, depth: number) {
    rowH[depth] = Math.max(rowH[depth] ?? 0, hOf(n, depth))
    if (isExpandable(n, depth)) n.children.forEach(c => scan(c, depth + 1))
  })(root, 0)

  // Extent along the secondary (sibling-stacking) axis: height when horizontal,
  // width when vertical.
  const selfExtent = (n: Node, depth: number) => (orientation === 'h' ? hOf(n, depth) : NODE_W)
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

  function place(n: Node, depth: number, start: number, parentId?: string): number {
    const own = selfExtent(n, depth)
    let center: number

    if (!isExpandable(n, depth)) {
      center = start + own / 2
    } else {
      let cursor = start
      const centers: number[] = []
      for (const c of n.children) {
        const cc = place(c, depth + 1, cursor, n.id)
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
    const h = hOf(n, depth)
    const x = orientation === 'h' ? primary(depth) : center - w / 2
    const y = orientation === 'h' ? center - h / 2 : primary(depth)
    nodes.push({
      id: n.id, node: n, depth, x, y, w, h, parentId,
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

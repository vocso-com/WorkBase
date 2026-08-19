import type { Node, ColorKey } from '../types'
import { COLORS } from '../theme'
import { toText } from './text'
import { sharesOf } from './weight'
import { healthOf } from './health'

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
  /**
   * This node's fraction of its siblings' combined weight, 0-1. Absent on the
   * root, which has no siblings to be a share of. Computed here because this is
   * the only place the sibling set is in hand.
   */
  share?: number
  // The node this one hangs off, so a card can name its container in the
  // header row. Absent on the root.
  parentId?: string
}

export type ExpandPredicate = (node: Node, depth: number) => boolean
export type Orientation = 'h' | 'v'

export interface LayoutOpts {
  /** Canvas-wide: show descriptions/meta at all. Defaults to true. */
  showDesc?: boolean
  /**
   * Level-of-detail: are we zoomed in enough to show the teaser + meta on
   * *collapsed* cards? Zoomed out, those drop so the canvas reads as clean
   * labelled boxes. A card the user explicitly opened ignores this — its full
   * content stays legible at any zoom. Defaults to true.
   */
  lod?: boolean
  /**
   * Canvas-wide default for whether a card is "open" (full description). A
   * card's own `cardOpen` overrides it, so individual cards can be collapsed
   * while the rest stay open. Defaults to false (collapsed → one-line teaser).
   */
  descOpenDefault?: boolean
}

/** A card's effective open state: its own flag, falling back to the canvas default. */
export const isCardOpen = (n: Node, descOpenDefault = false): boolean => n.cardOpen ?? descOpenDefault

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
/**
 * Root cards are wider. Their body is squeezed between the colour band and the
 * progress ring, leaving barely enough for a count line — and a health badge
 * carrying its evidence needs more than that. Too narrow, and the badge is
 * shrunk as a flex item while its text refuses to wrap, so it renders straight
 * out through its own border.
 */
export const ROOT_NODE_W = 320
/**
 * An opened card gets more room. At 280px a long note becomes a column of
 * noodles — roughly four words a line — which is a worse read than anywhere
 * else in the app despite being the place the user asked to read it. Wider
 * lines cost nothing when collapsed, because only opened cards take it.
 */
const OPEN_NODE_W = 460
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

// Tall enough for the 54px progress ring plus the header, title and subtitle
// without the title's descenders clipping.
export const ROOT_H = 116
export const MIN_TASK_H = 58
export const MIN_MOD_H = 72

const CARD_PAD_Y = 22 // 11 top + 11 bottom
const CARD_BORDER_Y = 4 // 2px top + 2px bottom; cards are border-box
export const CARD_ROW_GAP = 6
const HEAD_H = 22 // status dot + kicker + priority + shortId, incl. the hairline
const TITLE_LINE_H = 19
export const DESC_LINE_H = 18
const FOOTER_H = 22 // due, attachment/dependency counts, expand control
const TAGS_H = 22
const MOD_TITLE_H = 24 // icon + title, taller than a plain title line
const MOD_ROLLUP_H = 20 // counts + due + the meta strip
const MOD_BAR_H = 6 // ProgressBar

const TITLE_CPL = 30 // characters per line at the title's size
// Text sits inset by the mark's gutter, so a line fits fewer characters than
// the card's full width suggests.
/**
 * Characters that fit on one line of an *opened* card.
 *
 * Measured in the browser at 12.5px: ~6.2px a character. The column is the card
 * less its padding and the gutter on both sides — the module gutter is the
 * wider of the two, so using it keeps both card types safe.
 */
const DESC_CHAR_W = 6.2
const CARD_PAD_X = 13
const WIDEST_GUTTER = 32
export const OPEN_DESC_CPL = Math.floor((OPEN_NODE_W - 2 * (CARD_PAD_X + WIDEST_GUTTER)) / DESC_CHAR_W)

/**
 * Lines a string takes when wrapped greedily at `cpl` characters.
 *
 * Dividing length by characters-per-line assumes text packs perfectly. Real
 * wrapping is ragged, and long unbreakable tokens — file paths, URLs,
 * CONSTANT_NAMES — force early breaks a character count cannot see. Under-
 * counting is the expensive direction: the card renders shorter than its
 * content, and the footer and progress bar spill out of the bottom.
 */
export function wrappedLines(text: string, cpl: number): number {
  if (cpl <= 0) return 1
  let lines = 1
  let used = 0
  for (const word of text.trim().split(/\s+/)) {
    if (!word) continue
    if (used > 0 && used + 1 + word.length > cpl) { lines++; used = 0 }
    if (word.length > cpl) {
      // Breaks inside itself. It already occupies the line we are on, so only
      // the rows beyond the first are new — otherwise a word that divides
      // exactly claims a spare line it never uses.
      const rows = Math.ceil(word.length / cpl)
      lines += rows - 1
      used = word.length % cpl || cpl
      continue
    }
    used = used > 0 ? used + 1 + word.length : word.length
  }
  return lines
}
const MAX_TITLE_LINES = 2
/** Collapsed cards get a one-line teaser; expanding one reveals the whole note. */
const TEASER_LINES = 1
// An expanded card shows its *entire* description — the point of opening it is to
// read all of it. The cap is only a sanity ceiling so a pasted megabyte of text
// can't make an absurd card; normal notes (even long logs) never reach it.
/**
 * An opened card shows at most this many words.
 *
 * The canvas is a map. A card carrying a thousand words stops being a landmark
 * and becomes an essay nailed to the wall — it dwarfs its neighbours, drags the
 * layout around it, and is harder to read at 280px than it would be anywhere
 * else. Past the cap the card says there is more and the full text lives in the
 * card modal, which is built for reading.
 */
export const OPEN_DESC_WORDS = 100

/**
 * Trim to a word count, marking the cut. Measurement and render must pass the
 * same text through this or the card reserves the wrong height.
 */
export function clampWords(text: string, max = OPEN_DESC_WORDS): string {
  const words = text.trim().split(/\s+/)
  if (words.length <= max) return text
  return `${words.slice(0, max).join(' ')} …`
}

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
function descLines(text: string, open: boolean, showDesc: boolean, lod: boolean): number {
  // The canvas-wide switch wins: with content off there is no expand control to
  // undo a card left open, so an expanded card must collapse with the rest. The
  // `cardOpen` flag survives, so flipping the switch back restores it.
  if (!text || !showDesc) return 0
  // An explicitly opened card shows its full description at any zoom — the whole
  // point of opening it is to read it. Level-of-detail only trims the automatic
  // one-line teaser on *collapsed* cards when zoomed far out.
  if (open) return Math.max(1, wrappedLines(clampWords(text), OPEN_DESC_CPL))
  return lod ? TEASER_LINES : 0
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
export function cardHasMeta(n: Node, showDesc: boolean, lod = true, open = !!n.cardOpen): boolean {
  if (!showDesc) return false
  // Zoomed out, a collapsed card sheds its meta chips too — but an opened card
  // keeps them, so its "Less" control stays reachable at any zoom.
  if (!lod && !open) return false
  return !!(toText(n.description) || n.attachments?.length || n.dependsOn?.length || n.comments?.length)
}

/** Whether a task card's footer row earns its place. Pairs with `cardHasMeta`. */
export function cardHasFooter(n: Node, showDesc: boolean, lod = true, open = !!n.cardOpen): boolean {
  return !!n.dueDate || cardHasMeta(n, showDesc, lod, open)
}

/**
 * Height of the image strip on an opened card.
 *
 * Fixed, and never inline. The layout measures every card *before* it renders,
 * and an image's intrinsic height is unknown until it loads — inline images
 * would either break the measurement or force a re-layout flash. A fixed strip
 * is measurable, and recognising a mockup by sight beats reading its title.
 */
export const THUMB_ROW_H = 48
const MAX_THUMBS = 3

/** Image attachments a card can preview, capped so the strip stays one row. */
export function cardImages(n: Node): NonNullable<Node['attachments']> {
  return (n.attachments ?? []).filter(a => a.type.startsWith('image/')).slice(0, MAX_THUMBS)
}

/**
 * Thumbnails ride with the opened card only. Collapsed, the canvas has to stay
 * a map of labelled boxes — a wall of pictures is a different tool.
 */
export function cardHasThumbs(n: Node, showDesc: boolean, open: boolean): boolean {
  return showDesc && open && cardImages(n).length > 0
}

/** Sum a card's present rows, with a gap between each, plus padding and border. */
const stack = (rows: number[], min: number): number => {
  const present = rows.filter(r => r > 0)
  const h = CARD_PAD_Y + CARD_BORDER_Y
    + present.reduce((a, r) => a + r, 0)
    + CARD_ROW_GAP * Math.max(0, present.length - 1)
  return Math.max(min, h)
}

function taskH(n: Node, showDesc: boolean, lod: boolean, open: boolean): number {
  const text = toText(n.description)
  return stack(
    [
      HEAD_H,
      titleLines(n.title) * TITLE_LINE_H,
      descLines(text, open, showDesc, lod) * DESC_LINE_H,
      cardHasThumbs(n, showDesc, open) ? THUMB_ROW_H : 0,
      cardHasFooter(n, showDesc, lod, open) ? FOOTER_H : 0,
      n.tags && n.tags.length > 0 ? TAGS_H : 0,
    ],
    MIN_TASK_H,
  )
}

function containerH(n: Node, showDesc: boolean, lod: boolean, open: boolean): number {
  const text = toText(n.description)
  // A container always keeps its rollup row — the sub-item counts are the point
  // of the card — so the content strip rides along in it for free.
  return stack(
    [
      HEAD_H,
      MOD_TITLE_H,
      descLines(text, open, showDesc, lod) * DESC_LINE_H,
      cardHasThumbs(n, showDesc, open) ? THUMB_ROW_H : 0,
      MOD_ROLLUP_H,
      MOD_BAR_H,
    ],
    MIN_MOD_H,
  )
}

/**
 * Height of a node's card. Mirrors FlowView's card selection exactly: the root
 * gets the band card, any *other* node with children gets the container card —
 * depth is unbounded, so a task three levels down that grew sub-tasks becomes a
 * container like any other — and a childless node gets the task card.
 */
/**
 * Width of a node's card. Only an opened card *with something to show* widens —
 * an empty expanded card would just be a bigger empty card.
 */
export function nodeW(n: Node, depth: number, showDesc = true, descOpenDefault = false): number {
  if (depth === 0) return ROOT_NODE_W
  if (!showDesc) return NODE_W
  if (!isCardOpen(n, descOpenDefault)) return NODE_W
  return toText(n.description) ? OPEN_NODE_W : NODE_W
}

/**
 * The badge carries its evidence — the state alone tells a reader nothing they
 * can act on — so it needs a row beside the counts rather than instead of them.
 */
const ROOT_BADGE_H = 22

function rootHasBadge(n: Node): boolean {
  return healthOf([n], n).state !== 'on-track'
}

export function nodeH(n: Node, depth: number, showDesc = true, lod = true, descOpenDefault = false): number {
  if (depth === 0) return ROOT_H + (rootHasBadge(n) ? ROOT_BADGE_H : 0)
  const open = isCardOpen(n, descOpenDefault)
  if (n.children.length > 0) return containerH(n, showDesc, lod, open)
  return taskH(n, showDesc, lod, open)
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
  const lod = opts.lod !== false
  const descOpenDefault = opts.descOpenDefault === true
  const nodes: FlowNode[] = []
  const edges: FlowEdge[] = []
  // Extent of each node's whole subtree band…
  const sub = new Map<string, number>()
  // …and of just its children's stack, which can be smaller than the band when
  // the node's own card is the taller of the two.
  const kids = new Map<string, number>()

  const isExpandable = (n: Node, depth: number) => n.children.length > 0 && isExpanded(n, depth)
  const hOf = (n: Node, depth: number) => nodeH(n, depth, showDesc, lod, descOpenDefault)
  const wOf = (n: Node, depth: number) => nodeW(n, depth, showDesc, descOpenDefault)

  // Cards vary in height, so a vertical layout's rows are spaced by the tallest
  // card at each depth. Collect those maxima up front, over the visible nodes.
  const rowH: number[] = []
  // Columns are as wide as their widest card, so an opened card pushes the next
  // column right instead of overlapping it.
  const colW: number[] = []
  ;(function scan(n: Node, depth: number) {
    rowH[depth] = Math.max(rowH[depth] ?? 0, hOf(n, depth))
    colW[depth] = Math.max(colW[depth] ?? 0, wOf(n, depth))
    if (isExpandable(n, depth)) n.children.forEach(c => scan(c, depth + 1))
  })(root, 0)

  // Extent along the secondary (sibling-stacking) axis: height when horizontal,
  // width when vertical.
  const selfExtent = (n: Node, depth: number) => (orientation === 'h' ? hOf(n, depth) : wOf(n, depth))
  // Position along the primary (depth) axis.
  const primary = (depth: number) => {
    if (orientation === 'h') {
      let x = 0
      for (let d = 0; d < depth; d++) x += (colW[d] ?? NODE_W) + COL_GAP
      return x
    }
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
    kids.set(n.id, total)
    sub.set(n.id, e)
    return e
  }
  measure(root, 0)

  function place(n: Node, depth: number, start: number, parentId?: string, share?: number): number {
    const own = selfExtent(n, depth)
    let center: number

    if (!isExpandable(n, depth)) {
      center = start + own / 2
    } else {
      // The band `measure` reserved is max(own card, children stack). When the
      // card is the taller of the two, the children have to be centred inside
      // that band — otherwise they sit at the top of it, the parent is centred
      // on *them*, and the parent's card is drawn above its own band, running
      // into the sibling before it.
      const band = sub.get(n.id)!
      let cursor = start + Math.max(0, (band - (kids.get(n.id) ?? 0)) / 2)
      const centers: number[] = []
      const childShares = sharesOf(n.children)
      for (const [ci, c] of n.children.entries()) {
        const cc = place(c, depth + 1, cursor, n.id, childShares[ci])
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

    const w = wOf(n, depth)
    const h = hOf(n, depth)
    const x = orientation === 'h' ? primary(depth) : center - w / 2
    const y = orientation === 'h' ? center - h / 2 : primary(depth)
    nodes.push({
      id: n.id, node: n, depth, x, y, w, h, parentId, share,
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

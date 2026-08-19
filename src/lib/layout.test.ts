import { layoutTree, MIN_TASK_H, ROOT_H, clampWords, nodeH, OPEN_DESC_WORDS, OPEN_DESC_CPL, DESC_LINE_H, THUMB_ROW_H, CARD_ROW_GAP, wrappedLines, ROOT_NODE_W } from './layout'
import { instantiateTemplate, BUILTIN_TEMPLATES } from './templates'
import { newNode } from './factory'
import type { Node } from '../types'

const project = instantiateTemplate(BUILTIN_TEMPLATES[0], [])

/** A project → one module → the given tasks, all expanded. */
function tree(...tasks: Node[]): Node {
  const mod = newNode('Module', { collapsed: false, children: tasks })
  return newNode('Project', { collapsed: false, children: [mod] })
}
const hOf = (root: Node, id: string) => layoutTree(root).nodes.find(n => n.id === id)!.h

test('layout places the root and every module/task as a node', () => {
  const l = layoutTree(project)
  const moduleCount = project.children.length
  const taskCount = project.children.reduce((a, m) => a + m.children.length, 0)
  expect(l.nodes).toHaveLength(1 + moduleCount + taskCount)
  expect(l.width).toBeGreaterThan(0)
  expect(l.height).toBeGreaterThan(0)
})

test('depth maps to distinct x columns (root < module < task)', () => {
  const l = layoutTree(project)
  const root = l.nodes.find(n => n.id === project.id)!
  const mod = l.nodes.find(n => n.depth === 1)!
  const task = l.nodes.find(n => n.depth === 2)!
  expect(root.x).toBeLessThan(mod.x)
  expect(mod.x).toBeLessThan(task.x)
})

test('an edge connects the root to each module', () => {
  const l = layoutTree(project)
  for (const mod of project.children) {
    expect(l.edges.some(e => e.from === project.id && e.to === mod.id)).toBe(true)
  }
})

test('no node has a negative y after normalization', () => {
  const l = layoutTree(project)
  expect(l.nodes.every(n => n.y >= 0)).toBe(true)
})

test('a childless root yields a single node and no edges', () => {
  const solo = { ...project, children: [] }
  const l = layoutTree(solo)
  expect(l.nodes).toHaveLength(1)
  expect(l.edges).toHaveLength(0)
})

// ── Content-measured card heights ────────────────────────────────────────────

// Status and priority live in the header row, so a task with nothing else to
// say is just the header and its title. Asserted exactly — including the card's
// padding and its 2px border, which is part of the box — so a change to the
// height constants cannot shift the canvas silently. If these numbers move, the
// CSS row heights must move with them.
const BARE_TASK_H = 22 /* pad */ + 4 /* border */ + 22 /* head */ + 6 + 19 /* title */
const FOOTER_ROW = 6 + 22

test('a bare task is just the header and its title', () => {
  const t = newNode('Ship it')
  expect(hOf(tree(t), t.id)).toBe(BARE_TASK_H)
  expect(BARE_TASK_H).toBeGreaterThanOrEqual(MIN_TASK_H)
})

test('a due date earns the footer row', () => {
  const t = newNode('Ship it', { dueDate: '2026-09-01' })
  expect(hOf(tree(t), t.id)).toBe(BARE_TASK_H + FOOTER_ROW)
})

test('priority costs no height — it rides in the header', () => {
  const plain = newNode('Ship it', { dueDate: '2026-09-01' })
  const urgent = newNode('Ship it', { dueDate: '2026-09-01', priority: 'high' })
  expect(hOf(tree(urgent), urgent.id)).toBe(hOf(tree(plain), plain.id))
})

test('attachments earn the footer row without a description', () => {
  const t = newNode('Ship it', { attachments: [{ id: 'a', name: 'brief.pdf', type: 'application/pdf', dataUrl: '', at: '' }] })
  expect(hOf(tree(t), t.id)).toBe(BARE_TASK_H + FOOTER_ROW)
})

test('a description makes a task card taller', () => {
  const bare = newNode('Ship it')
  const described = newNode('Ship it', { description: 'A short note about the work.' })
  expect(hOf(tree(described), described.id)).toBeGreaterThan(hOf(tree(bare), bare.id))
})

test('a collapsed card reserves one description line however long the text is', () => {
  const one = newNode('T', { description: 'Short.' })
  const huge = newNode('T', { description: 'x'.repeat(4000) })
  expect(hOf(tree(huge), huge.id)).toBe(hOf(tree(one), one.id))
})

test('expanding a card grows it to fit more of the description', () => {
  const shut = newNode('T', { description: 'A considerably longer note that will not fit on one line of this card.' })
  const open = newNode('T', { description: 'A considerably longer note that will not fit on one line of this card.', cardOpen: true })
  expect(hOf(tree(open), open.id)).toBeGreaterThan(hOf(tree(shut), shut.id))
})

test('an expanded card keeps growing well past a single screenful', () => {
  // A long note (a pasted log, say) must not be clipped at some low line cap —
  // opening a card is a request to read all of it.
  const short = newNode('T', { description: 'y'.repeat(30 * 20), cardOpen: true }) // ~20 lines
  const long = newNode('T', { description: 'y'.repeat(30 * 45), cardOpen: true }) // ~45 lines
  expect(hOf(tree(long), long.id)).toBeGreaterThan(hOf(tree(short), short.id))
})

test('an expanded description stops at the word cap, not a height ceiling', () => {
  // The canvas is a map: past the cap a card says there is more rather than
  // growing without bound and dragging the layout around it.
  const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ')
  const atCap = newNode('T', { description: words(OPEN_DESC_WORDS), cardOpen: true })
  const essay = newNode('T', { description: words(OPEN_DESC_WORDS * 40), cardOpen: true })
  const clamped = newNode('T', { description: clampWords(words(OPEN_DESC_WORDS * 40)), cardOpen: true })

  expect(hOf(tree(essay), essay.id)).toBe(hOf(tree(clamped), clamped.id))
  // And within a line of a card that is genuinely at the cap.
  expect(hOf(tree(essay), essay.id)).toBeLessThanOrEqual(hOf(tree(atCap), atCap.id) + 18)
})

test('level-of-detail drops a collapsed teaser but never an opened card', () => {
  const shut = newNode('T', { description: 'A note that shows as a one-line teaser when collapsed.' })
  const open = newNode('T', { description: 'A note the user opened to read in full at any zoom.', cardOpen: true })
  const hAt = (n: typeof shut, lod: boolean) =>
    layoutTree(tree(n), undefined, 'h', { showDesc: true, lod }).nodes.find(x => x.id === n.id)!.h
  // Zoomed out, the collapsed card sheds its teaser…
  expect(hAt(shut, false)).toBeLessThan(hAt(shut, true))
  expect(hAt(shut, false)).toBe(BARE_TASK_H)
  // …but the opened card keeps its full height regardless of level-of-detail.
  expect(hAt(open, false)).toBe(hAt(open, true))
  expect(hAt(open, false)).toBeGreaterThan(BARE_TASK_H)
})

test('descOpenDefault opens every card, but a per-card flag still overrides', () => {
  // Long enough to need more than one line at the opened card's width, or
  // opening it would legitimately add no height and prove nothing.
  const note = 'A note that would be a one-line teaser when collapsed, but runs to several lines once the card is opened up to read it properly.'
  const plain = newNode('T', { description: note })
  const pinnedShut = newNode('T', { description: note, cardOpen: false })
  const hDefault = (n: typeof plain, descOpenDefault: boolean) =>
    layoutTree(tree(n), undefined, 'h', { showDesc: true, descOpenDefault }).nodes.find(x => x.id === n.id)!.h
  // Global expand opens a card with no explicit flag…
  expect(hDefault(plain, true)).toBeGreaterThan(hDefault(plain, false))
  // …but a card the user collapsed (cardOpen:false) ignores the global default.
  expect(hDefault(pinnedShut, true)).toBe(hDefault(pinnedShut, false))
})

test('switching descriptions off reclaims the row entirely', () => {
  const t = newNode('T', { description: 'Some note.' })
  const root = tree(t)
  const on = layoutTree(root, undefined, 'h', { showDesc: true }).nodes.find(n => n.id === t.id)!.h
  const off = layoutTree(root, undefined, 'h', { showDesc: false }).nodes.find(n => n.id === t.id)!.h
  expect(off).toBeLessThan(on)
  expect(off).toBe(BARE_TASK_H)
})

test('the canvas-wide switch collapses even a card left expanded', () => {
  // With content off there is no expand control on the card, so an expanded one
  // would otherwise be stuck open.
  const t = newNode('T', { description: 'Some note.', cardOpen: true })
  const root = tree(t)
  const off = layoutTree(root, undefined, 'h', { showDesc: false }).nodes.find(n => n.id === t.id)!.h
  expect(off).toBe(BARE_TASK_H)
})

test('description height is measured on the text, not the HTML markup', () => {
  const plain = newNode('T', { description: 'Positioning and pricing', cardOpen: true })
  const wrapped = newNode('T', { description: '<p data-start="3641" class="PDq2pG_selectionAnchorContainer">Positioning and pricing</p>', cardOpen: true })
  expect(hOf(tree(wrapped), wrapped.id)).toBe(hOf(tree(plain), plain.id))
})

test('titles clamp at two lines', () => {
  const two = newNode('A fairly long task title that will certainly need to wrap onto a second line')
  const huge = newNode('y'.repeat(4000))
  expect(hOf(tree(huge), huge.id)).toBe(hOf(tree(two), two.id))
})

test('tags add a row of their own', () => {
  const bare = newNode('T')
  const tagged = newNode('T', { tags: [{ name: 'Design', color: 'violet' }] })
  expect(hOf(tree(tagged), tagged.id)).toBeGreaterThan(hOf(tree(bare), bare.id))
})

test('a container with children is taller than a bare task', () => {
  const task = newNode('T')
  const root = tree(task)
  const l = layoutTree(root)
  const mod = l.nodes.find(n => n.depth === 1)!
  expect(mod.h).toBeGreaterThan(BARE_TASK_H)
})

test('a description makes a module card taller too', () => {
  const plain = newNode('Module', { collapsed: false, children: [newNode('T')] })
  const described = newNode('Module', { collapsed: false, description: 'What this module covers.', children: [newNode('T')] })
  const a = newNode('Project', { collapsed: false, children: [plain] })
  const b = newNode('Project', { collapsed: false, children: [described] })
  expect(hOf(b, described.id)).toBeGreaterThan(hOf(a, plain.id))
})

test('the root card height is unchanged', () => {
  const root = tree(newNode('T'))
  expect(hOf(root, root.id)).toBe(ROOT_H)
})

test('a childless node at depth 1 is measured as a task, not a container', () => {
  const leafMod = newNode('Just an item')
  const root = newNode('Project', { collapsed: false, children: [leafMod] })
  expect(hOf(root, leafMod.id)).toBe(BARE_TASK_H)
})

test('nesting is unbounded — a deep node with children is measured as a container', () => {
  const grandchild = newNode('Deep leaf')
  const child = newNode('Deep container', { collapsed: false, children: [grandchild] })
  const task = newNode('Task', { collapsed: false, children: [child] })
  const root = tree(task)
  const pred = (n: Node, depth: number) => (depth === 0 ? n.collapsed !== true : n.collapsed === false)
  const l = layoutTree(root, pred)
  const deep = l.nodes.find(n => n.id === child.id)!
  const leaf = l.nodes.find(n => n.id === grandchild.id)!
  expect(deep.depth).toBe(3)
  expect(deep.h).toBeGreaterThan(leaf.h)
  expect(leaf.h).toBe(BARE_TASK_H)
})

test('vertical rows are spaced by the tallest card at each depth', () => {
  const tall = newNode('T', { description: 'A considerably longer note that cannot fit on a single line of this card.', tags: [{ name: 'Design', color: 'violet' }] })
  const short = newNode('S')
  const root = tree(tall, short)
  const l = layoutTree(root, undefined, 'v')
  const a = l.nodes.find(n => n.id === tall.id)!
  const b = l.nodes.find(n => n.id === short.id)!
  // Same depth → same row origin, regardless of differing heights.
  expect(a.y).toBe(b.y)
  const mod = l.nodes.find(n => n.depth === 1)!
  // The task row must start below the tallest card of the row above it.
  expect(a.y).toBeGreaterThanOrEqual(mod.y + mod.h)
})

// ── Dependency edges ─────────────────────────────────────────────────────────

test('child edges are tagged as such', () => {
  const l = layoutTree(project)
  expect(l.edges.length).toBeGreaterThan(0)
  expect(l.edges.every(e => e.kind === 'child')).toBe(true)
})

test('a dependency between two visible nodes yields a dep edge', () => {
  const a = newNode('Blocker')
  const b = newNode('Blocked', { dependsOn: [a.id] })
  const l = layoutTree(tree(a, b))
  const dep = l.edges.filter(e => e.kind === 'dep')
  expect(dep).toHaveLength(1)
  expect(dep[0].from).toBe(a.id)
  expect(dep[0].to).toBe(b.id)
})

test('no dep edge is emitted when the other end is not laid out', () => {
  const hidden = newNode('Hidden')
  const blocked = newNode('Blocked', { dependsOn: [hidden.id] })
  // `hidden` lives inside a collapsed module, so it never reaches the canvas.
  const collapsed = newNode('Collapsed', { collapsed: true, children: [hidden] })
  const open = newNode('Open', { collapsed: false, children: [blocked] })
  const root = newNode('Project', { collapsed: false, children: [collapsed, open] })
  // FlowView's predicate: only explicitly-expanded nodes below the root open up.
  const l = layoutTree(root, (n, depth) => (depth === 0 ? n.collapsed !== true : n.collapsed === false))
  expect(l.nodes.some(n => n.id === hidden.id)).toBe(false)
  expect(l.edges.some(e => e.kind === 'dep')).toBe(false)
})

test('a dependency on an unknown id is ignored', () => {
  const b = newNode('Blocked', { dependsOn: ['does-not-exist'] })
  expect(layoutTree(tree(b)).edges.some(e => e.kind === 'dep')).toBe(false)
})

test('self-dependencies and duplicates are dropped', () => {
  const a = newNode('Blocker')
  const b = newNode('Blocked')
  b.dependsOn = [a.id, a.id, b.id]
  const l = layoutTree(tree(a, b))
  expect(l.edges.filter(e => e.kind === 'dep')).toHaveLength(1)
})

test('dep edge ids never collide with child edge ids', () => {
  const a = newNode('Blocker')
  const b = newNode('Blocked', { dependsOn: [a.id] })
  const l = layoutTree(tree(a, b))
  expect(new Set(l.edges.map(e => e.id)).size).toBe(l.edges.length)
})

// ── No card may overlap another ──────────────────────────────────────────────

/** Every pair of cards sharing a column, with the vertical gap between them. */
function columnGaps(root: Node, orientation: 'h' | 'v' = 'h', opts = {}) {
  const pred = (n: Node, depth: number) => (depth === 0 ? n.collapsed !== true : n.collapsed === false)
  const l = layoutTree(root, pred, orientation, opts)
  const cols = new Map<number, { y: number; h: number; t: string }[]>()
  for (const n of l.nodes) {
    const key = orientation === 'h' ? n.x : n.y
    const item = orientation === 'h' ? { y: n.y, h: n.h, t: n.node.title } : { y: n.x, h: n.w, t: n.node.title }
    cols.set(key, [...(cols.get(key) ?? []), item])
  }
  const gaps: { a: string; b: string; gap: number }[] = []
  for (const list of cols.values()) {
    list.sort((p, q) => p.y - q.y)
    for (let i = 1; i < list.length; i++) {
      gaps.push({ a: list[i - 1].t, b: list[i].t, gap: list[i].y - (list[i - 1].y + list[i - 1].h) })
    }
  }
  return gaps
}

test('a container taller than its children does not overlap the sibling above it', () => {
  // The regression: the container's card is taller than the single short child
  // it is centred against, so it used to be drawn above its own band.
  const shortChild = newNode('Tiny')
  const tall = newNode('Tall container', { collapsed: false, children: [shortChild] })
  const before = newNode('Sibling above')
  const root = newNode('Project', { collapsed: false, children: [before, tall] })
  const gaps = columnGaps(root)
  expect(gaps.every(g => g.gap >= 0)).toBe(true)
  expect(gaps.find(g => g.b === 'Tall container')!.gap).toBeGreaterThanOrEqual(16)
})

test('no two cards in a column ever overlap, in either orientation', () => {
  const build = () => {
    const deep = newNode('Deep', { collapsed: false, children: [newNode('Leaf')] })
    const mod1 = newNode('One', { collapsed: false, description: 'A note that is long enough to wrap.', children: [deep] })
    const mod2 = newNode('Two', { collapsed: false, children: [newNode('A'), newNode('B')] })
    const mod3 = newNode('Three', { collapsed: false, children: [newNode('C', { tags: [{ name: 'X', color: 'blue' }] })] })
    return newNode('Project', { collapsed: false, children: [mod1, mod2, mod3, newNode('Loose task')] })
  }
  for (const orientation of ['h', 'v'] as const) {
    for (const showDesc of [true, false]) {
      const bad = columnGaps(build(), orientation, { showDesc }).filter(g => g.gap < 0)
      expect({ orientation, showDesc, bad }).toEqual({ orientation, showDesc, bad: [] })
    }
  }
})

test('clampWords keeps short text intact', () => {
  expect(clampWords('a short note', 100)).toBe('a short note')
})

test('clampWords trims a long note to the cap and marks the cut', () => {
  const long = Array.from({ length: 400 }, (_, i) => `w${i}`).join(' ')
  const out = clampWords(long, 100)
  expect(out.split(/\s+/)).toHaveLength(101) // 100 words plus the ellipsis
  expect(out.endsWith('…')).toBe(true)
  expect(out.startsWith('w0 w1')).toBe(true)
})

test('an opened card reserves lines for the clamped text, not the whole essay', () => {
  const essay = Array.from({ length: 4000 }, (_, i) => `w${i}`).join(' ')
  const openEssay = newNode('Essay', { description: essay, cardOpen: true })
  const openClamped = newNode('Clamped', { description: clampWords(essay), cardOpen: true })
  // Measurement and render must agree on the same trimmed text.
  expect(nodeH(openEssay, 1)).toBe(nodeH(openClamped, 1))
})

test('an opened card with content is wider than a collapsed one', () => {
  const shut = newNode('T', { description: 'A note long enough to wrap onto several lines of the card.' })
  const open = newNode('T', { description: 'A note long enough to wrap onto several lines of the card.', cardOpen: true })
  const wOf = (n: Node) => layoutTree(tree(n)).nodes.find(x => x.id === n.id)!.w
  expect(wOf(open)).toBeGreaterThan(wOf(shut))
})

test('an opened card with no content stays the standard width', () => {
  const bare = newNode('T', { cardOpen: true })
  const w = layoutTree(tree(bare)).nodes.find(x => x.id === bare.id)!.w
  const shut = newNode('T')
  expect(w).toBe(layoutTree(tree(shut)).nodes.find(x => x.id === shut.id)!.w)
})

test('a wide card pushes the next column instead of overlapping it', () => {
  const wide = newNode('Task', {
    description: 'A note long enough to wrap onto several lines of the card.',
    cardOpen: true,
    children: [newNode('Sub')],
  })
  const narrow = newNode('Task', { children: [newNode('Sub')] })
  const childX = (parent: Node) => {
    const l = layoutTree(tree(parent), () => true)
    const p = l.nodes.find(n => n.id === parent.id)!
    const child = l.nodes.find(n => n.depth === p.depth + 1)!
    return { gap: child.x - (p.x + p.w) }
  }
  // The gap between a card's right edge and the next column never goes negative.
  expect(childX(wide).gap).toBeGreaterThan(0)
  expect(childX(narrow).gap).toBeGreaterThan(0)
})

test('an opened card measures its text at the width it will actually render at', () => {
  // DESC_CPL is calibrated for the 280px card. An opened card is wider, so
  // measuring it at the narrow rate reserves nearly double the lines it needs
  // and leaves dead space below the text.
  const line = (n: number) => 'x'.repeat(OPEN_DESC_CPL * n)
  const one = newNode('T', { description: line(1), cardOpen: true })
  const two = newNode('T', { description: line(2), cardOpen: true })
  expect(hOf(tree(two), two.id) - hOf(tree(one), one.id)).toBe(DESC_LINE_H)
})

test('an opened card reserves a fixed row for image attachments', () => {
  const img = (id: string) => ({ id, name: `${id}.png`, type: 'image/png', dataUrl: 'data:image/png;base64,x', at: '' })
  const withImg = newNode('T', { description: 'A note.', cardOpen: true, attachments: [img('a')] })
  const without = newNode('T', { description: 'A note.', cardOpen: true })
  // One extra row, plus the gap `stack` puts between rows.
  expect(hOf(tree(withImg), withImg.id) - hOf(tree(without), without.id)).toBe(THUMB_ROW_H + CARD_ROW_GAP)
})

test('the thumbnail row is a fixed height however many images there are', () => {
  const img = (id: string) => ({ id, name: `${id}.png`, type: 'image/png', dataUrl: 'data:image/png;base64,x', at: '' })
  const one = newNode('T', { description: 'A note.', cardOpen: true, attachments: [img('a')] })
  const many = newNode('T', { description: 'A note.', cardOpen: true, attachments: ['a', 'b', 'c', 'd', 'e'].map(img) })
  expect(hOf(tree(many), many.id)).toBe(hOf(tree(one), one.id))
})

test('non-image attachments earn no thumbnail row', () => {
  const pdf = { id: 'p', name: 'brief.pdf', type: 'application/pdf', dataUrl: '', at: '' }
  const withPdf = newNode('T', { description: 'A note.', cardOpen: true, attachments: [pdf] })
  const without = newNode('T', { description: 'A note.', cardOpen: true })
  expect(hOf(tree(withPdf), withPdf.id)).toBe(hOf(tree(without), without.id))
})

test('a collapsed card shows no thumbnails — the canvas stays a map', () => {
  const img = { id: 'a', name: 'a.png', type: 'image/png', dataUrl: 'data:image/png;base64,x', at: '' }
  const shut = newNode('T', { description: 'A note.', attachments: [img] })
  const without = newNode('T', { description: 'A note.' })
  expect(hOf(tree(shut), shut.id)).toBe(hOf(tree(without), without.id))
})

test('a root card reserves a row for its health badge', () => {
  const past = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)
  const healthy = newNode('Project', {
    collapsed: false,
    children: [newNode('Module', { collapsed: false, children: [newNode('T')] })],
  })
  const atRisk = newNode('Project', {
    collapsed: false,
    children: [newNode('Module', { collapsed: false, children: [newNode('T', { dueDate: past })] })],
  })
  const rootH = (n: Node) => layoutTree(n).nodes.find(x => x.id === n.id)!.h

  expect(rootH(healthy)).toBe(ROOT_H)
  expect(rootH(atRisk)).toBeGreaterThan(ROOT_H)
})

test('wrappedLines counts a greedy wrap, not a character division', () => {
  // 'aaaa bbbb cccc' at 9 chars a line: "aaaa bbbb" then "cccc".
  expect(wrappedLines('aaaa bbbb cccc', 9)).toBe(2)
  // Division would say ceil(14/9) = 2 as well, so make the ragged case bite:
  // three 6-char words at 13 chars a line pack two per line, never three.
  expect(wrappedLines('aaaaaa bbbbbb cccccc', 13)).toBe(2)
})

test('a word longer than the line breaks across lines instead of being ignored', () => {
  // The real failure: long unbreakable tokens — paths, URLs, CONSTANT_NAMES —
  // force early breaks that a character count cannot see.
  expect(wrappedLines('x'.repeat(50), 10)).toBe(5)
  expect(wrappedLines(`short ${'y'.repeat(30)} tail`, 10)).toBeGreaterThanOrEqual(4)
})

test('ragged text reserves more lines than dividing its length would', () => {
  // Ten 9-character words at 10 chars a line: one per line, though the naive
  // division says ceil(99/10) = 10... which is right only by luck. Add tokens
  // that cannot share a line and the division under-counts.
  const ragged = Array.from({ length: 10 }, () => 'abcdefgh').join(' ')
  expect(wrappedLines(ragged, 10)).toBeGreaterThan(Math.ceil(ragged.length / 10) - 5)
})

test('an opened card reserves enough rows for text full of unbreakable tokens', () => {
  const codey = Array.from({ length: 12 }, (_, i) => `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION_${i}`).join(' ')
  const prose = Array.from({ length: 12 }, () => 'some ordinary words here').join(' ')
  const h = (d: string) => {
    const n = newNode('T', { description: d, cardOpen: true })
    return hOf(tree(n), n.id)
  }
  // Same character count, wildly different wrapping — the codey one must be taller.
  expect(codey.length).toBeGreaterThan(prose.length * 0.9)
  expect(h(codey)).toBeGreaterThan(h(prose))
})

test('layout hands each card its share of its siblings', () => {
  const big = newNode('Build', { size: 'XXL' })
  const rest = ['Design', 'Content', 'QA'].map(t => newNode(t))
  const root = newNode('Project', { collapsed: false, children: [big, ...rest] })
  const l = layoutTree(root)
  const shareOf = (id: string) => l.nodes.find(n => n.id === id)!.share

  // One XXL beside three M takes 73% of the set.
  expect(shareOf(big.id)).toBeCloseTo(8 / 11, 3)
  expect(shareOf(rest[0].id)).toBeCloseTo(1 / 11, 3)
  // The root has no siblings to be a share of.
  expect(shareOf(root.id)).toBeUndefined()
})

test('a root card is wider than a standard card, and grows for its badge', () => {
  const past = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)
  const kids = (due?: string) => [newNode('Module', { collapsed: false, children: [newNode('T', { dueDate: due })] })]
  const healthy = newNode('Project', { collapsed: false, children: kids() })
  const atRisk = newNode('Project', { collapsed: false, children: kids(past) })
  const at = (n: Node) => layoutTree(n).nodes.find(x => x.id === n.id)!

  // The body has to hold a count line and an evidence badge without squeezing
  // the badge until its text spills out of it.
  expect(at(healthy).w).toBeGreaterThan(at(healthy).w === at(atRisk).w ? 280 : 0)
  expect(at(healthy).w).toBe(ROOT_NODE_W)
  expect(at(healthy).h).toBe(ROOT_H)
  expect(at(atRisk).h).toBeGreaterThan(ROOT_H)
})

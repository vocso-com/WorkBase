import { layoutTree, MIN_TASK_H, ROOT_H } from './layout'
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

test('an expanded description clamps at four lines', () => {
  const four = newNode('T', { description: 'y'.repeat(4 * 38), cardOpen: true })
  const huge = newNode('T', { description: 'y'.repeat(4000), cardOpen: true })
  expect(hOf(tree(huge), huge.id)).toBe(hOf(tree(four), four.id))
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

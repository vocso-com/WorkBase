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

// Every task has a status, so the footer row (stage pill) always renders: the
// compact card is one title line + one footer row. Asserted exactly so that a
// change to the height constants cannot shift the canvas silently.
const COMPACT_TASK_H = 70

test('a bare task is one title line plus the stage pill row', () => {
  const t = newNode('Ship it')
  expect(hOf(tree(t), t.id)).toBe(COMPACT_TASK_H)
  expect(COMPACT_TASK_H).toBeGreaterThanOrEqual(MIN_TASK_H)
})

test('a description makes a task card taller', () => {
  const bare = newNode('Ship it')
  const described = newNode('Ship it', { description: 'A short note about the work.' })
  expect(hOf(tree(described), described.id)).toBeGreaterThan(hOf(tree(bare), bare.id))
})

test('a two-line description is taller than a one-line description', () => {
  const one = newNode('T', { description: 'Short.' })
  const two = newNode('T', { description: 'A considerably longer note that cannot fit on a single line of this card.' })
  expect(hOf(tree(two), two.id)).toBeGreaterThan(hOf(tree(one), one.id))
})

test('descriptions clamp at two lines — a very long one is no taller', () => {
  const two = newNode('T', { description: 'A considerably longer note that cannot fit on a single line of this card.' })
  const huge = newNode('T', { description: 'x'.repeat(4000) })
  expect(hOf(tree(huge), huge.id)).toBe(hOf(tree(two), two.id))
})

test('titles clamp at two lines', () => {
  const two = newNode('A fairly long task title that will certainly need to wrap onto a second line')
  const huge = newNode('y'.repeat(4000))
  expect(hOf(tree(huge), huge.id)).toBe(hOf(tree(two), two.id))
})

test('due and priority share the stage pill row and add no height', () => {
  const bare = newNode('T')
  const loaded = newNode('T', { dueDate: '2026-09-01', priority: 'high' })
  expect(hOf(tree(loaded), loaded.id)).toBe(hOf(tree(bare), bare.id))
})

test('tags add a row of their own', () => {
  const bare = newNode('T')
  const tagged = newNode('T', { tags: [{ name: 'Design', color: 'violet' }] })
  expect(hOf(tree(tagged), tagged.id)).toBeGreaterThan(hOf(tree(bare), bare.id))
})

test('a module with children is taller than a compact task', () => {
  const task = newNode('T')
  const root = tree(task)
  const l = layoutTree(root)
  const mod = l.nodes.find(n => n.depth === 1)!
  expect(mod.h).toBeGreaterThan(COMPACT_TASK_H)
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

test('a childless node at depth 1 is measured as a task, not a module', () => {
  const leafMod = newNode('Just an item')
  const root = newNode('Project', { collapsed: false, children: [leafMod] })
  expect(hOf(root, leafMod.id)).toBe(COMPACT_TASK_H)
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

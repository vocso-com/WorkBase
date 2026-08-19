import { progressOf, statusCounts, statusShares, allLeavesDone, openDescendants } from './progress'
import { newNode } from './factory'
import type { Node } from '../types'

const leaf = (id: string, status: Node['status'] = 'todo'): Node => ({
  id, shortId: id, title: id, status, children: [], createdAt: '', updatedAt: '',
})
const parent = (id: string, kids: Node[]): Node => ({ ...leaf(id), children: kids })

test('progressOf rounds done leaves', () => {
  const p = parent('p', [leaf('a', 'done'), leaf('b', 'todo'), leaf('c', 'done')])
  // Two of three leaves done, and 'p' itself still open: 200 / 3.3.
  expect(progressOf(p)).toBe(61)
})

test('progressOf of a done leaf is 100', () => {
  expect(progressOf(leaf('x', 'done'))).toBe(100)
  expect(progressOf(leaf('y', 'todo'))).toBe(0)
})

test('statusCounts tallies leaves', () => {
  const p = parent('p', [leaf('a', 'done'), leaf('b', 'doing'), leaf('c', 'blocked')])
  expect(statusCounts(p)).toEqual({ todo: 0, doing: 1, done: 1, blocked: 1 })
})

test('allLeavesDone', () => {
  expect(allLeavesDone(parent('p', [leaf('a', 'done'), leaf('b', 'done')]))).toBe(true)
  expect(allLeavesDone(parent('p', [leaf('a', 'done'), leaf('b', 'todo')]))).toBe(false)
})

test('openDescendants counts every unfinished item below a node', () => {
  const tree = newNode('Module', {
    children: [
      newNode('A', { status: 'done' }),
      newNode('B', { status: 'todo' }),
      newNode('C', { status: 'doing', children: [newNode('C1', { status: 'todo' }), newNode('C2', { status: 'done' })] }),
    ],
  })
  expect(openDescendants(tree)).toBe(3) // B, C, C1
})

test('openDescendants ignores the node itself', () => {
  const solo = newNode('Lonely', { status: 'todo' })
  expect(openDescendants(solo)).toBe(0)
  const parent = newNode('P', { status: 'todo', children: [newNode('K', { status: 'done' })] })
  expect(openDescendants(parent)).toBe(0)
})

test('rollup weights children by size rather than counting leaves flat', () => {
  const build = newNode('Build', {
    size: 'XXL',
    children: [newNode('b1', { status: 'done' }), newNode('b2')],
  })
  const project = newNode('P', {
    children: [build, newNode('Design'), newNode('Content'), newNode('QA')],
  })
  // Build is half its own subtree (100/2.2 = 45.5) and holds 8 of 11 weight,
  // with the project's own work still open: (8 * 45.5) / 12.1.
  expect(progressOf(project)).toBe(30)
})

test('a started leaf earns nothing — finishing is what counts', () => {
  const p = newNode('P', { children: [newNode('a', { status: 'doing' }), newNode('b')] })
  expect(progressOf(p)).toBe(0)
})

test('blocked and custom stages count as not done', () => {
  const p = newNode('P', {
    children: [newNode('a', { status: 'done' }), newNode('b', { status: 'blocked' })],
  })
  // One of two done, the container itself open: 100 / 2.2.
  expect(progressOf(p)).toBe(45)
  const custom = newNode('P', {
    children: [newNode('a', { status: 'done' }), newNode('b', { status: 'review' })],
  })
  expect(progressOf(custom)).toBe(45)
})

test('a completed node with open children tells the truth, not 100', () => {
  // "Finishing is a judgment" earns the tick, but a card reading 100% beside
  // "3 blocked" is the exact lie this feature exists to remove. The status
  // stays done — dependencies still satisfy — while the number reports work.
  const closed = newNode('Homepage design', {
    status: 'done',
    children: [newNode('done bit', { status: 'done' }), newNode('late addition')],
  })
  // Its own work counts, its open child still does not: (100 + 20) / 2.2.
  expect(progressOf(closed)).toBe(55)
})

test('a completed node whose work really is finished still reads 100', () => {
  const closed = newNode('Homepage design', {
    status: 'done',
    children: [newNode('a', { status: 'done' }), newNode('b', { status: 'done' })],
  })
  expect(progressOf(closed)).toBe(100)
})

test('a completed leaf reads 100', () => {
  expect(progressOf(newNode('Ship it', { status: 'done' }))).toBe(100)
})

test('weighting composes down the path without any global calculation', () => {
  const api = newNode('API', { size: 'XXL', children: [newNode('x', { status: 'done' })] })
  const build = newNode('Build', {
    size: 'XXL',
    children: [api, newNode('UI'), newNode('Docs'), newNode('Tests')],
  })
  const project = newNode('P', {
    children: [build, newNode('Design'), newNode('Content'), newNode('QA')],
  })
  // API is finished but unconfirmed (91), and every container above it is open
  // too, so each level keeps back its own tenth.
  expect(progressOf(project)).toBe(40)
})

test('statusShares weights by size, so a big module dominates the bar', () => {
  const build = newNode('Build', { size: 'XXL', children: [newNode('b', { status: 'done' })] })
  const rest = ['Design', 'Content', 'QA'].map(t => newNode(t, { children: [newNode(`${t}-1`)] }))
  const p = newNode('P', { children: [build, ...rest] })
  const shares = statusShares(p)
  // Build's finished child holds the bulk; the rest is open work plus every
  // container's own unconfirmed tenth.
  expect(shares.done).toBeCloseTo(0.601, 3)
  expect(shares.todo).toBeCloseTo(0.399, 3)
  expect(shares.done + shares.todo).toBeCloseTo(1, 6)
})

test('statusShares agrees with the number progressOf prints', () => {
  const build = newNode('Build', { size: 'XXL', children: [newNode('b', { status: 'done' })] })
  const rest = ['Design', 'Content'].map(t => newNode(t, { children: [newNode(`${t}-1`)] }))
  const p = newNode('P', { children: [build, ...rest] })
  expect(Math.round(statusShares(p).done * 100)).toBe(progressOf(p))
})

test('ticking a container moves the number — a tick that changes nothing reads as a broken button', () => {
  const kids = () => [newNode('a', { status: 'done' }), newNode('b', { status: 'done' })]
  const before = newNode('Design', { children: kids() })
  const after = newNode('Design', { status: 'done', children: kids() })
  expect(progressOf(before)).toBeLessThan(100)
  expect(progressOf(after)).toBe(100)
  expect(progressOf(after)).toBeGreaterThan(progressOf(before))
})

test("a container's own work is the last stretch, not a headline", () => {
  // Every child finished, the container itself not yet confirmed.
  const m = newNode('Design', { children: [newNode('a', { status: 'done' }), newNode('b', { status: 'done' })] })
  expect(progressOf(m)).toBe(91)
})

test("a container's share does not balloon when it has few children", () => {
  const shallow = newNode('M', { status: 'done', children: [newNode('a')] })
  const deep = newNode('M', { status: 'done', children: Array.from({ length: 20 }, (_, i) => newNode(`t${i}`)) })
  // Its own work is a fixed fraction of the subtree, so the reading is the same.
  expect(progressOf(shallow)).toBe(progressOf(deep))
  expect(progressOf(shallow)).toBe(9)
})

test('statusShares gives the container its own share too, so the bar agrees', () => {
  const m = newNode('Design', { status: 'done', children: [newNode('a', { status: 'done' }), newNode('b')] })
  expect(Math.round(statusShares(m).done * 100)).toBe(progressOf(m))
})

test('a project keeps no share of its own — its percentage is the headline number', () => {
  const kids = () => [newNode('M', { status: 'done', children: [newNode('t', { status: 'done' })] })]
  const p = newNode('Acme Redesign', { children: kids() })
  // Everything inside is finished and confirmed; the project itself is not
  // ticked. A module would read 91 here.
  expect(progressOf(p, { isProject: true })).toBe(100)
  expect(progressOf(p)).toBe(91)
})

test('the exemption belongs to projects, not to whichever node you asked about', () => {
  // A module reads the same whether you measure it directly or through its
  // project — otherwise its own card and the rollup above it disagree.
  const mod = newNode('Design', { children: [newNode('a', { status: 'done' })] })
  const project = newNode('P', { children: [mod] })
  expect(progressOf(mod)).toBe(91)
  expect(progressOf(project, { isProject: true })).toBe(91)
})

test('a project still reports work that is genuinely unfinished', () => {
  const p = newNode('P', {
    children: [newNode('a', { status: 'done' }), newNode('b')],
  })
  expect(progressOf(p, { isProject: true })).toBe(50)
})

test('statusShares takes the same exemption', () => {
  const p = newNode('P', { children: [newNode('M', { status: 'done', children: [newNode('t', { status: 'done' })] })] })
  expect(statusShares(p, { isProject: true }).done).toBeCloseTo(1, 6)
})

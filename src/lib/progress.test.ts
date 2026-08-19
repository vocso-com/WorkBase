import { progressOf, statusCounts, statusShares, allLeavesDone, openDescendants } from './progress'
import { newNode } from './factory'
import type { Node } from '../types'

const leaf = (id: string, status: Node['status'] = 'todo'): Node => ({
  id, shortId: id, title: id, status, children: [], createdAt: '', updatedAt: '',
})
const parent = (id: string, kids: Node[]): Node => ({ ...leaf(id), children: kids })

test('progressOf rounds done leaves', () => {
  const p = parent('p', [leaf('a', 'done'), leaf('b', 'todo'), leaf('c', 'done')])
  expect(progressOf(p)).toBe(67)
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
  // Build is half done and holds 8 of 11 weight: (8 * 50) / 11
  expect(progressOf(project)).toBe(36)
})

test('a started leaf earns nothing — finishing is what counts', () => {
  const p = newNode('P', { children: [newNode('a', { status: 'doing' }), newNode('b')] })
  expect(progressOf(p)).toBe(0)
})

test('blocked and custom stages count as not done', () => {
  const p = newNode('P', {
    children: [newNode('a', { status: 'done' }), newNode('b', { status: 'blocked' })],
  })
  expect(progressOf(p)).toBe(50)
  const custom = newNode('P', {
    children: [newNode('a', { status: 'done' }), newNode('b', { status: 'review' })],
  })
  expect(progressOf(custom)).toBe(50)
})

test('a completed node with open children tells the truth, not 100', () => {
  // "Finishing is a judgment" earns the tick, but a card reading 100% beside
  // "3 blocked" is the exact lie this feature exists to remove. The status
  // stays done — dependencies still satisfy — while the number reports work.
  const closed = newNode('Homepage design', {
    status: 'done',
    children: [newNode('done bit', { status: 'done' }), newNode('late addition')],
  })
  expect(progressOf(closed)).toBe(50)
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
  // API is 8/11 of Build, Build is 8/11 of P → 53% of the project, fully done
  expect(progressOf(project)).toBe(53)
})

test('statusShares weights by size, so a big module dominates the bar', () => {
  const build = newNode('Build', { size: 'XXL', children: [newNode('b', { status: 'done' })] })
  const rest = ['Design', 'Content', 'QA'].map(t => newNode(t, { children: [newNode(`${t}-1`)] }))
  const p = newNode('P', { children: [build, ...rest] })
  const shares = statusShares(p)
  // Build holds 8 of 11 weight and is finished: 73% done, 27% to do.
  expect(shares.done).toBeCloseTo(8 / 11, 3)
  expect(shares.todo).toBeCloseTo(3 / 11, 3)
})

test('statusShares agrees with the number progressOf prints', () => {
  const build = newNode('Build', { size: 'XXL', children: [newNode('b', { status: 'done' })] })
  const rest = ['Design', 'Content'].map(t => newNode(t, { children: [newNode(`${t}-1`)] }))
  const p = newNode('P', { children: [build, ...rest] })
  expect(Math.round(statusShares(p).done * 100)).toBe(progressOf(p))
})

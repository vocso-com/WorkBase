import { progressOf, statusCounts, allLeavesDone, openDescendants } from './progress'
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

test('an explicitly completed node reads 100 even after it gains open children', () => {
  const closed = newNode('Homepage design', {
    status: 'done',
    children: [newNode('late addition')],
  })
  expect(progressOf(closed)).toBe(100)
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

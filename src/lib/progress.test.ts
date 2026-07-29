import { progressOf, statusCounts, allLeavesDone } from './progress'
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

import { readyToClose, readyToCloseNodes, reopenNodes, challengeSize } from './confirm'
import { isComplete } from './deps'
import { newNode } from './factory'
import type { Node } from '../types'

const n = (t: string, extra: Partial<Node> = {}) => newNode(t, extra)

test('a parent whose children are all done is ready to close, not done', () => {
  const p = n('Homepage design', {
    children: [n('a', { status: 'done' }), n('b', { status: 'done' })],
  })
  expect(readyToClose(p)).toBe(true)
  expect(p.status).not.toBe('done')
})

test('ready to close does not cascade through unconfirmed parents', () => {
  const inner = n('Inner', { children: [n('x', { status: 'done' })] })
  const outer = n('Outer', { children: [inner] })
  expect(readyToClose(inner)).toBe(true)
  expect(readyToClose(outer)).toBe(false)
})

test('a leaf is never ready to close and an already-done parent is not either', () => {
  expect(readyToClose(n('leaf'))).toBe(false)
  expect(readyToClose(n('p', { status: 'done', children: [n('a', { status: 'done' })] }))).toBe(false)
})

test('a dependency is satisfied only by an explicit done, not by full progress', () => {
  const ready = n('Design', { children: [n('a', { status: 'done' })] })
  expect(readyToClose(ready)).toBe(true)
  expect(isComplete(ready)).toBe(false)
})

test('structure challenges a size declaration that has gone stale', () => {
  const build = n('Build', { size: 'L', children: Array.from({ length: 60 }, (_, i) => n(`t${i}`)) })
  const others = ['Design', 'Content', 'QA'].map(t => n(t, { children: [n('x'), n('y')] }))
  expect(challengeSize(build, [build, ...others])).toBe('XXL')
})

test('no challenge when the declaration still matches the structure', () => {
  const build = n('Build', { size: 'XXL', children: Array.from({ length: 60 }, (_, i) => n(`t${i}`)) })
  const others = ['Design', 'Content', 'QA'].map(t => n(t, { children: [n('x'), n('y')] }))
  expect(challengeSize(build, [build, ...others])).toBeNull()
})

test('no challenge when nothing in the set declares a size', () => {
  const a = n('A', { children: [n('x')] })
  const b = n('B', { children: [n('y')] })
  expect(challengeSize(a, [a, b])).toBeNull()
})

test('a one-step disagreement is tolerated rather than nagged about', () => {
  const build = n('Build', { size: 'XL', children: Array.from({ length: 60 }, (_, i) => n(`t${i}`)) })
  const others = ['Design', 'Content', 'QA'].map(t => n(t, { children: [n('x'), n('y')] }))
  expect(challengeSize(build, [build, ...others])).toBeNull()
})

test('readyToCloseNodes finds every container waiting on a human, at any depth', () => {
  const inner = n('Wireframes', { children: [n('a', { status: 'done' })] })
  const outer = n('Design', { children: [inner, n('b', { status: 'done' })] })
  const other = n('Build', { children: [n('c')] })
  const roots = [n('P', { children: [outer, other] })]
  // Only the innermost qualifies: Design still has an unconfirmed child.
  expect(readyToCloseNodes(roots).map(x => x.title)).toEqual(['Wireframes'])
})

test('readyToCloseNodes returns nothing when everything is confirmed', () => {
  const roots = [n('P', { status: 'done', children: [n('a', { status: 'done' })] })]
  expect(readyToCloseNodes(roots)).toEqual([])
})

test('reopenNodes finds anything ticked done that still has open work under it', () => {
  const closed = n('Homepage design', {
    status: 'done',
    children: [n('a', { status: 'done' }), n('late addition')],
  })
  const fine = n('Billing', { status: 'done', children: [n('b', { status: 'done' })] })
  const roots = [n('P', { children: [closed, fine] })]
  expect(reopenNodes(roots).map(x => x.title)).toEqual(['Homepage design'])
})

test('an open container with open work is not a reopen candidate', () => {
  const roots = [n('P', { children: [n('Design', { children: [n('a')] })] })]
  expect(reopenNodes(roots)).toEqual([])
})

import { readyToClose, challengeSize } from './confirm'
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

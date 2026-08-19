import { totalScope, scopeGrowth, baselineShare } from './scope'
import { newNode } from './factory'

test('scope is the leaf count of a subtree', () => {
  const p = newNode('P', {
    children: [newNode('a', { children: [newNode('a1'), newNode('a2')] }), newNode('b')],
  })
  expect(totalScope(p)).toBe(3)
})

test('growth is null until a baseline has been captured', () => {
  expect(scopeGrowth(newNode('P', { children: [newNode('a')] }))).toBeNull()
})

test('growth reports the fraction added since kickoff', () => {
  const p = newNode('P', {
    baselineWeight: 10,
    baselineAt: '2026-08-01T00:00:00.000Z',
    children: Array.from({ length: 14 }, (_, i) => newNode(`t${i}`)),
  })
  expect(scopeGrowth(p)).toBeCloseTo(0.4, 5)
})

test('a project that has not grown reports zero rather than null', () => {
  const p = newNode('P', {
    baselineWeight: 2,
    baselineAt: '2026-08-01T00:00:00.000Z',
    children: [newNode('a'), newNode('b')],
  })
  expect(scopeGrowth(p)).toBe(0)
})

test('baselineShare marks where the original scope ended', () => {
  const p = newNode('P', {
    baselineWeight: 10,
    baselineAt: '2026-08-01T00:00:00.000Z',
    children: Array.from({ length: 20 }, (_, i) => newNode(`t${i}`)),
  })
  // Half the track is now work that did not exist at kickoff.
  expect(baselineShare(p)).toBeCloseTo(0.5, 5)
})

test('baselineShare is null without a baseline, and never exceeds the whole track', () => {
  expect(baselineShare(newNode('P', { children: [newNode('a')] }))).toBeNull()
  const shrunk = newNode('P', {
    baselineWeight: 10,
    baselineAt: '2026-08-01T00:00:00.000Z',
    children: [newNode('a'), newNode('b')],
  })
  expect(baselineShare(shrunk)).toBe(1)
})

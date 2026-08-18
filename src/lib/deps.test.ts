import { isBlocked, unmetDependencies, dependents, wouldCycle, isComplete } from './deps'
import { newNode } from './factory'
import type { Node } from '../types'

function setup(): { roots: Node[]; a: Node; b: Node } {
  const a = newNode('A', { shortId: 'P-1' })
  const b = newNode('B', { shortId: 'P-2' })
  const root = newNode('Proj', { shortId: 'P-0' })
  root.children = [a, b]
  return { roots: [root], a, b }
}

test('a task with no dependencies is never blocked', () => {
  const { roots, a } = setup()
  expect(isBlocked(roots, a)).toBe(false)
})

test('a task is blocked while a dependency is incomplete, ready once it is done', () => {
  const { roots, a, b } = setup()
  a.dependsOn = [b.id]
  expect(isBlocked(roots, a)).toBe(true)
  expect(unmetDependencies(roots, a).map(n => n.id)).toEqual([b.id])
  b.status = 'done'
  expect(isComplete(b)).toBe(true)
  expect(isBlocked(roots, a)).toBe(false)
})

test('a container dependency is complete once ticked done, even with an open child', () => {
  const { roots, a } = setup()
  const c1 = newNode('c1', { shortId: 'P-3' })
  const c2 = newNode('c2', { shortId: 'P-4' })
  const c = newNode('Foundations', { shortId: 'P-5' })
  c.children = [c1, c2]
  roots[0].children.push(c)
  a.dependsOn = [c.id]

  // One of two children done → 50% → still blocking.
  c1.status = 'done'
  expect(isComplete(c)).toBe(false)
  expect(isBlocked(roots, a)).toBe(true)

  // Tick the container itself done → it counts as complete; a is unblocked.
  c.status = 'done'
  expect(isComplete(c)).toBe(true)
  expect(isBlocked(roots, a)).toBe(false)
})

test('a container with every child done is ready to close, not complete', () => {
  const c = newNode('C', { shortId: 'P-6' })
  const c1 = newNode('c1', { shortId: 'P-7' })
  const c2 = newNode('c2', { shortId: 'P-8' })
  c.children = [c1, c2]
  expect(isComplete(c)).toBe(false)
  c1.status = 'done'; c2.status = 'done'
  // 100% means ready to close. Something that depends on C stays blocked until
  // a human confirms — finishing is a judgment.
  expect(isComplete(c)).toBe(false)
  c.status = 'done'
  expect(isComplete(c)).toBe(true)
})

test('dependents returns the reverse edge', () => {
  const { roots, a, b } = setup()
  a.dependsOn = [b.id]
  expect(dependents(roots, b.id).map(n => n.id)).toEqual([a.id])
})

test('wouldCycle blocks self- and back-references', () => {
  const { roots, a, b } = setup()
  a.dependsOn = [b.id]
  expect(wouldCycle(roots, a.id, a.id)).toBe(true) // self
  expect(wouldCycle(roots, b.id, a.id)).toBe(true) // b→a would close a→b→a
  expect(wouldCycle(roots, b.id, b.id)).toBe(true)
})

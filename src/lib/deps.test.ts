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

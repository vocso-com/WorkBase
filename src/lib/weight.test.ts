import { SIZE_WEIGHT, weightOf, sharesOf, shareIfSized } from './weight'
import { newNode } from './factory'
import type { Node } from '../types'

const kid = (title: string, extra: Partial<Node> = {}): Node => newNode(title, extra)

test('inferred weight is the leaf count when no sibling declares a size', () => {
  const a = kid('A', { children: [kid('a1'), kid('a2'), kid('a3')] })
  const b = kid('B', { children: [kid('b1')] })
  expect(weightOf(a, [a, b])).toBe(3)
  expect(weightOf(b, [a, b])).toBe(1)
})

test('a childless node has an inferred weight of 1, never 0', () => {
  const solo = kid('Solo')
  expect(weightOf(solo, [solo])).toBe(1)
})

test('one declared size switches the whole sibling set to size semantics', () => {
  const big = kid('Build', { size: 'XXL', children: [kid('x')] })
  const rest = kid('Design', { children: [kid('a'), kid('b'), kid('c'), kid('d')] })
  // Design has more leaves, but sizes now govern: it defaults to M.
  expect(weightOf(big, [big, rest])).toBe(SIZE_WEIGHT.XXL)
  expect(weightOf(rest, [big, rest])).toBe(SIZE_WEIGHT.M)
})

test('the size scale doubles from a default of M', () => {
  expect(SIZE_WEIGHT).toEqual({ S: 0.5, M: 1, L: 2, XL: 4, XXL: 8 })
})

test('one XXL beside three M takes 73% of the set', () => {
  const build = kid('Build', { size: 'XXL' })
  const others = [kid('Design'), kid('Content'), kid('QA')]
  const set = [build, ...others]
  expect(sharesOf(set)[0]).toBeCloseTo(0.727, 3)
})

test('shares always sum to 1 so levels compose independently', () => {
  const set = [kid('a', { children: [kid('x'), kid('y')] }), kid('b'), kid('c')]
  const sum = sharesOf(set).reduce((t, n) => t + n, 0)
  expect(sum).toBeCloseTo(1, 10)
})

test('sharesOf an empty set is empty rather than dividing by zero', () => {
  expect(sharesOf([])).toEqual([])
})

test('shareIfSized previews what a size would claim before it is chosen', () => {
  const build = kid('Build')
  const set = [build, kid('Design'), kid('Content'), kid('QA')]
  // Siblings have no declaration yet, so they default to M once one is set.
  expect(shareIfSized(build, set, 'XXL')).toBeCloseTo(8 / 11, 5)
  expect(shareIfSized(build, set, 'M')).toBeCloseTo(1 / 4, 5)
  expect(shareIfSized(build, set, 'S')).toBeCloseTo(0.5 / 3.5, 5)
})

test('shareIfSized respects the declarations siblings already carry', () => {
  const build = kid('Build')
  const set = [build, kid('Design', { size: 'XL' }), kid('QA', { size: 'S' })]
  expect(shareIfSized(build, set, 'M')).toBeCloseTo(1 / 5.5, 5)
})

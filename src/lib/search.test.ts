import { searchNodes } from './search'
import { newNode } from './factory'
import type { Node } from '../types'

function tree(): Node[] {
  const task = newNode('Landing page', { shortId: 'SP-4' })
  const mod = newNode('Core Product', { shortId: 'SP-2' })
  mod.children = [task, newNode('Dashboard', { shortId: 'SP-12' })]
  const root = newNode('SaaS Product', { shortId: 'SP-1' })
  root.children = [mod]
  return [root]
}

test('empty query returns nothing', () => {
  expect(searchNodes(tree(), '')).toEqual([])
  expect(searchNodes(tree(), '   ')).toEqual([])
})

test('finds a nested task and builds a root-less trail', () => {
  const hits = searchNodes(tree(), 'landing')
  expect(hits[0].node.title).toBe('Landing page')
  expect(hits[0].kind).toBe('task')
  // Trail excludes the root project (shown separately as rootTitle).
  expect(hits[0].rootTitle).toBe('SaaS Product')
  expect(hits[0].trail).toBe('Core Product')
})

test('an exact shortId match ranks first', () => {
  const hits = searchNodes(tree(), 'SP-12')
  expect(hits[0].node.shortId).toBe('SP-12')
})

test('all whitespace-separated terms must match', () => {
  expect(searchNodes(tree(), 'core product').length).toBe(1)
  expect(searchNodes(tree(), 'core zzz').length).toBe(0)
})

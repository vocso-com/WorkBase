import { findNode, findParent, leaves, updateNode, addChild, deleteNode, moveNode, reorderChildren } from './tree'
import type { Node } from '../types'

const leaf = (id: string, title = id): Node => ({
  id, shortId: id.toUpperCase(), title, status: 'todo', children: [],
  createdAt: '2026-01-01', updatedAt: '2026-01-01',
})
const withKids = (id: string, kids: Node[]): Node => ({ ...leaf(id), children: kids })

function sample(): Node[] {
  return [withKids('p', [withKids('m1', [leaf('t1'), leaf('t2')]), leaf('m2')])]
}

test('findNode finds nested', () => {
  expect(findNode(sample(), 't2')!.title).toBe('t2')
  expect(findNode(sample(), 'nope')).toBeNull()
})

test('findParent returns the parent', () => {
  expect(findParent(sample(), 't1')!.id).toBe('m1')
  expect(findParent(sample(), 'p')).toBeNull()
})

test('leaves collects descendant leaves', () => {
  expect(leaves(sample()[0]).map(n => n.id).sort()).toEqual(['m2', 't1', 't2'])
  expect(leaves(leaf('x')).map(n => n.id)).toEqual(['x'])
})

test('updateNode is immutable and patches', () => {
  const roots = sample()
  const next = updateNode(roots, 't1', { title: 'renamed', status: 'done' })
  expect(findNode(next, 't1')!.title).toBe('renamed')
  expect(findNode(next, 't1')!.status).toBe('done')
  expect(findNode(roots, 't1')!.title).toBe('t1') // original untouched
})

test('addChild appends to parent and to roots', () => {
  const next = addChild(sample(), 'm1', leaf('t3'))
  expect(findNode(next, 'm1')!.children.map(c => c.id)).toEqual(['t1', 't2', 't3'])
  const next2 = addChild(sample(), null, leaf('p2'))
  expect(next2.map(r => r.id)).toEqual(['p', 'p2'])
})

test('deleteNode removes nested', () => {
  const next = deleteNode(sample(), 't1')
  expect(findNode(next, 't1')).toBeNull()
  expect(findNode(next, 'm1')!.children.map(c => c.id)).toEqual(['t2'])
})

test('moveNode reparents at index', () => {
  const next = moveNode(sample(), 't1', 'm2', 0)
  expect(findNode(next, 'm1')!.children.map(c => c.id)).toEqual(['t2'])
  expect(findNode(next, 'm2')!.children.map(c => c.id)).toEqual(['t1'])
})

test('reorderChildren swaps order', () => {
  const next = reorderChildren(sample(), 'm1', 0, 1)
  expect(findNode(next, 'm1')!.children.map(c => c.id)).toEqual(['t2', 't1'])
})

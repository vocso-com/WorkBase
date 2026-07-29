import { projectPrefix, nextShortId } from './shortid'
import type { Node } from '../types'

const n = (id: string, shortId: string): Node => ({
  id, shortId, title: id, status: 'todo', children: [], createdAt: '', updatedAt: '',
})

test('projectPrefix from words then letters', () => {
  expect(projectPrefix('Sample Room')).toBe('SR')
  expect(projectPrefix('Clearwater')).toBe('CL')
})

test('nextShortId increments per prefix', () => {
  const roots: Node[] = [{ ...n('p', 'SR-1'), children: [n('c', 'SR-3')] }]
  expect(nextShortId(roots, 'SR')).toBe('SR-4')
  expect(nextShortId(roots, 'PG')).toBe('PG-1')
})

test('nextShortId does not throw for a regex-metacharacter prefix', () => {
  const prefix = projectPrefix('(alpha) beta')
  const roots: Node[] = []
  expect(() => nextShortId(roots, prefix)).not.toThrow()
  expect(nextShortId(roots, prefix)).toBe(`${prefix}-1`)
})

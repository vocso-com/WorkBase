import { projectPrefix, nextShortId } from './shortid'
import type { Node } from '../types'

const n = (id: string, shortId: string): Node => ({
  id, shortId, title: id, status: 'todo', children: [], createdAt: '', updatedAt: '',
})

test('projectPrefix from words then letters', () => {
  expect(projectPrefix('Acme Website')).toBe('AW')
  expect(projectPrefix('Handbook')).toBe('HA')
})

test('nextShortId increments per prefix', () => {
  const roots: Node[] = [{ ...n('p', 'AW-1'), children: [n('c', 'AW-3')] }]
  expect(nextShortId(roots, 'AW')).toBe('AW-4')
  expect(nextShortId(roots, 'TH')).toBe('TH-1')
})

test('nextShortId does not throw for a regex-metacharacter prefix', () => {
  const prefix = projectPrefix('(alpha) beta')
  const roots: Node[] = []
  expect(() => nextShortId(roots, prefix)).not.toThrow()
  expect(nextShortId(roots, prefix)).toBe(`${prefix}-1`)
})

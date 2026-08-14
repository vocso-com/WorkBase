import { parseHash, buildHash } from './router'

test('home hash round-trips', () => {
  expect(buildHash([], 'board')).toBe('#/')
  expect(parseHash('#/')).toEqual({ path: [], view: 'board' })
})

test('project + view round-trips', () => {
  const h = buildHash(['abc', 'def'], 'kanban')
  expect(h).toBe('#/abc/def?view=kanban')
  expect(parseHash(h)).toEqual({ path: ['abc', 'def'], view: 'kanban' })
})

test('unknown view falls back to board', () => {
  expect(parseHash('#/abc?view=bogus').view).toBe('board')
})

test('empty hash parses as home', () => {
  expect(parseHash('')).toEqual({ path: [], view: 'board' })
})

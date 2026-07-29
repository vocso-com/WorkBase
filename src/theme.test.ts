import { STATUS, STATUS_ORDER, HOME_ORDER, COLORS } from './theme'
import { test, expect } from 'vitest'

test('every status has label/color/dot', () => {
  for (const s of STATUS_ORDER) {
    expect(STATUS[s].label).toBeTruthy()
    expect(COLORS[STATUS[s].color]).toMatch(/^#/)
    expect(STATUS[s].dot).toMatch(/^#/)
  }
})

test('home order leads with in-progress', () => {
  expect(HOME_ORDER[0]).toBe('doing')
  expect(new Set(HOME_ORDER)).toEqual(new Set(STATUS_ORDER))
})

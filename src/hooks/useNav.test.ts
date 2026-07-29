import { act } from '@testing-library/react'
import { useNav } from './useNav'

beforeEach(() => act(() => useNav.getState().home()))

test('open pushes, goto truncates, home clears', () => {
  act(() => useNav.getState().open('p'))
  act(() => useNav.getState().open('m'))
  expect(useNav.getState().path).toEqual(['p', 'm'])
  act(() => useNav.getState().goto(0))
  expect(useNav.getState().path).toEqual(['p'])
  act(() => useNav.getState().home())
  expect(useNav.getState().path).toEqual([])
})

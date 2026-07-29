import { act } from '@testing-library/react'
import { useStore } from '../store/useStore'
import { emptyDocument } from '../lib/serialize'

beforeEach(async () => {
  await act(async () => {
    await useStore.getState().init({ load: async () => emptyDocument(), save: async () => {} })
  })
})

test('reorder swaps sibling order in the store', () => {
  let pid = ''
  act(() => { pid = useStore.getState().addProject('P') })
  act(() => { useStore.getState().addChildNode(pid, 'A') })
  act(() => { useStore.getState().addChildNode(pid, 'B') })
  act(() => { useStore.getState().reorder(pid, 0, 1) })
  const kids = useStore.getState().doc.roots[0].children.map(c => c.title)
  expect(kids).toEqual(['B', 'A'])
})

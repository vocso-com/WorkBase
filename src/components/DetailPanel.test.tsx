import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DetailPanel } from './DetailPanel'
import { useDetail } from '../hooks/useDetail'
import { useStore } from '../store/useStore'
import { emptyDocument } from '../lib/serialize'

beforeEach(async () => {
  await act(async () => {
    await useStore.getState().init({ load: async () => emptyDocument(), save: async () => {} })
  })
})

test('edits description of the open node', async () => {
  let pid = ''
  act(() => { pid = useStore.getState().addProject('P') })
  act(() => { useDetail.getState().open(pid) })
  render(<DetailPanel />)
  const box = screen.getByPlaceholderText(/description/i)
  await userEvent.type(box, 'Hello')
  expect(useStore.getState().doc.roots[0].description).toContain('Hello')
})

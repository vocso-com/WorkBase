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

test('changing the status select updates the node status', async () => {
  let pid = ''
  act(() => { pid = useStore.getState().addProject('P') })
  act(() => { useDetail.getState().open(pid) })
  render(<DetailPanel />)

  // Status select is the first plain <select> in the panel (before Priority).
  const statusSelect = screen.getAllByRole('combobox')[0]
  await userEvent.selectOptions(statusSelect, 'done')

  expect(useStore.getState().doc.roots[0].status).toBe('done')
})

test('adding a tag from the palette attaches it to the node', async () => {
  let pid = ''
  act(() => { pid = useStore.getState().addProject('P') })
  act(() => {
    useStore.setState(s => ({ doc: { ...s.doc, tagPalette: [{ name: 'urgent', color: 'red' as const }] } }))
  })
  act(() => { useDetail.getState().open(pid) })
  render(<DetailPanel />)

  const addTagSelect = screen.getByLabelText('Add tag')
  await userEvent.selectOptions(addTagSelect, 'urgent')

  expect(useStore.getState().doc.roots[0].tags?.some(t => t.name === 'urgent')).toBe(true)
})

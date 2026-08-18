import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SizePicker } from './SizePicker'
import { useStore } from '../store/useStore'
import { emptyDocument } from '../lib/serialize'
import type { StorageAdapter } from '../lib/storage'
import { findNode } from '../lib/tree'

function fakeAdapter(): StorageAdapter {
  let saved = emptyDocument()
  return { load: async () => saved, save: async d => { saved = d } }
}

let pid = ''
let build = ''

beforeEach(async () => {
  await act(async () => { await useStore.getState().init(fakeAdapter()) })
  act(() => { pid = useStore.getState().addProject('Website') })
  act(() => { build = useStore.getState().addChildNode(pid, 'Build') })
  act(() => { useStore.getState().addChildNode(pid, 'Design') })
  act(() => { useStore.getState().addChildNode(pid, 'Content') })
  act(() => { useStore.getState().addChildNode(pid, 'QA') })
})

const node = () => findNode(useStore.getState().doc.roots, build)!

test('reads as inferred until a size is declared', () => {
  render(<SizePicker node={node()} />)
  expect(screen.getByRole('button', { name: /size/i })).toBeInTheDocument()
})

test('each option previews the share it would claim', async () => {
  const user = userEvent.setup()
  render(<SizePicker node={node()} />)
  await user.click(screen.getByRole('button', { name: /size/i }))
  // One XXL beside three M takes 73% of the set.
  expect(screen.getByText('73%')).toBeInTheDocument()
})

test('choosing a size declares it on the node', async () => {
  const user = userEvent.setup()
  render(<SizePicker node={node()} />)
  await user.click(screen.getByRole('button', { name: /size/i }))
  await user.click(screen.getByRole('button', { name: /XXL/ }))
  expect(node().size).toBe('XXL')
})

test('the declaration can be handed back to the structure', async () => {
  act(() => { useStore.getState().setSize(build, 'XXL') })
  const user = userEvent.setup()
  render(<SizePicker node={node()} />)
  await user.click(screen.getByRole('button', { name: /XXL/ }))
  await user.click(screen.getByRole('button', { name: /from sub-items/i }))
  expect(node().size).toBeUndefined()
})

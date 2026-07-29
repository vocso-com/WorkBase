import { render, screen, act } from '@testing-library/react'
import { KanbanView } from './KanbanView'
import { useStore } from '../store/useStore'
import { findNode } from '../lib/tree'
import { emptyDocument } from '../lib/serialize'

beforeEach(async () => {
  await act(async () => {
    await useStore.getState().init({ load: async () => emptyDocument(), save: async () => {} })
  })
})

test('renders columns and a task under its status', () => {
  let pid = '', tid = ''
  act(() => { pid = useStore.getState().addProject('P') })
  act(() => { tid = useStore.getState().addChildNode(pid, 'SMTP'); useStore.getState().setStatus(tid, 'done') })
  const node = findNode(useStore.getState().doc.roots, pid)!
  render(<KanbanView node={node} />)
  expect(screen.getByText('To do')).toBeInTheDocument()
  expect(screen.getByText('Done')).toBeInTheDocument()
  expect(screen.getByText('SMTP')).toBeInTheDocument()
})

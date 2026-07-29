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

test('an empty project renders no task cards, just empty columns', () => {
  let pid = ''
  act(() => { pid = useStore.getState().addProject('Empty') })
  const node = findNode(useStore.getState().doc.roots, pid)!
  render(<KanbanView node={node} />)

  expect(screen.getByText('To do')).toBeInTheDocument()
  expect(screen.getByText('In progress')).toBeInTheDocument()
  expect(screen.getByText('Done')).toBeInTheDocument()
  expect(screen.getByText('Blocked')).toBeInTheDocument()
  // The project itself must not appear as a self-card.
  expect(screen.queryByText('Empty')).not.toBeInTheDocument()
  expect(screen.queryAllByRole('button', { name: 'toggle done' })).toHaveLength(0)
  // Every column count should read 0.
  expect(screen.getAllByText('0')).toHaveLength(4)
})

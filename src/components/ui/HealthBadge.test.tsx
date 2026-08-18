import { render, screen, act } from '@testing-library/react'
import { HealthBadge } from './HealthBadge'
import { useStore } from '../../store/useStore'
import { emptyDocument } from '../../lib/serialize'
import type { StorageAdapter } from '../../lib/storage'
import { findNode } from '../../lib/tree'

function fakeAdapter(): StorageAdapter {
  let saved = emptyDocument()
  return { load: async () => saved, save: async d => { saved = d } }
}

const yesterday = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10)

beforeEach(async () => {
  await act(async () => { await useStore.getState().init(fakeAdapter()) })
})

test('stays silent while a project is on track', () => {
  let pid = ''
  act(() => { pid = useStore.getState().addProject('Acme Redesign') })
  act(() => { useStore.getState().addChildNode(pid, 'Wireframes') })

  const node = findNode(useStore.getState().doc.roots, pid)!
  const { container } = render(<HealthBadge node={node} />)
  expect(container).toBeEmptyDOMElement()
})

test('an overdue task puts the project at risk and says why', () => {
  let pid = '', tid = ''
  act(() => { pid = useStore.getState().addProject('Acme Redesign') })
  act(() => { tid = useStore.getState().addChildNode(pid, 'Wireframes') })
  act(() => { useStore.getState().patch(tid, { dueDate: yesterday() }) })

  const node = findNode(useStore.getState().doc.roots, pid)!
  render(<HealthBadge node={node} showEvidence />)

  expect(screen.getByText('At risk')).toBeInTheDocument()
  expect(screen.getByText(/1 item overdue/)).toBeInTheDocument()
})

test('an overdue task that has been completed stops raising the alarm', () => {
  let pid = '', tid = ''
  act(() => { pid = useStore.getState().addProject('Acme Redesign') })
  act(() => { tid = useStore.getState().addChildNode(pid, 'Wireframes') })
  act(() => { useStore.getState().patch(tid, { dueDate: yesterday() }) })
  act(() => { useStore.getState().toggleDone(tid) })

  const node = findNode(useStore.getState().doc.roots, pid)!
  const { container } = render(<HealthBadge node={node} />)
  expect(container).toBeEmptyDOMElement()
})

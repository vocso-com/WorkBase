import { render, screen, act } from '@testing-library/react'
import { NudgeWidget } from './NudgeWidget'
import { useStore } from '../store/useStore'
import { useNudge } from '../hooks/useNudge'
import { emptyDocument } from '../lib/serialize'
import type { StorageAdapter } from '../lib/storage'

function fakeAdapter(): StorageAdapter {
  let saved = emptyDocument()
  return { load: async () => saved, save: async d => { saved = d } }
}

beforeEach(async () => {
  await act(async () => { await useStore.getState().init(fakeAdapter()) })
  act(() => { useNudge.setState({ closed: false, collapsed: false }) })
})

test('a container waiting on a human is reason enough to show the widget', () => {
  let pid = '', mid = '', tid = ''
  act(() => { pid = useStore.getState().addProject('Acme Redesign') })
  act(() => { mid = useStore.getState().addChildNode(pid, 'Homepage design') })
  act(() => { tid = useStore.getState().addChildNode(mid, 'Wireframes') })
  act(() => { useStore.getState().toggleDone(tid) })

  // Nothing is overdue or due today, so the widget has no reminders to show —
  // but the finished module still needs confirming.
  render(<NudgeWidget />)
  expect(screen.getByText('Homepage design')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
})

test('confirming closes the container rather than the rollup doing it', () => {
  let pid = '', mid = '', tid = ''
  act(() => { pid = useStore.getState().addProject('Acme Redesign') })
  act(() => { mid = useStore.getState().addChildNode(pid, 'Homepage design') })
  act(() => { tid = useStore.getState().addChildNode(mid, 'Wireframes') })
  act(() => { useStore.getState().toggleDone(tid) })

  render(<NudgeWidget />)
  act(() => { screen.getByRole('button', { name: 'Close' }).click() })

  const mod = useStore.getState().doc.roots[0].children[0]
  expect(mod.status).toBe('done')
  expect(mod.completedAt).toBeTruthy()
})

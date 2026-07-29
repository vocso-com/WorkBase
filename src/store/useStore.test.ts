import { act } from '@testing-library/react'
import { useStore } from './useStore'
import type { StorageAdapter } from '../lib/storage'
import { emptyDocument } from '../lib/serialize'

function fakeAdapter(): StorageAdapter {
  let saved = emptyDocument()
  return { load: async () => saved, save: async d => { saved = d } }
}

beforeEach(async () => {
  await act(async () => { await useStore.getState().init(fakeAdapter()) })
})

test('addProject creates a root with prefix shortId and a color', () => {
  let id = ''
  act(() => { id = useStore.getState().addProject('Sample Room') })
  const p = useStore.getState().doc.roots.find(r => r.id === id)!
  expect(p.title).toBe('Sample Room')
  expect(p.shortId).toBe('SR-1')
  expect(p.color).toBeTruthy()
})

test('addChildNode nests and toggleDone flips status', () => {
  let pid = '', cid = ''
  act(() => { pid = useStore.getState().addProject('Cloud') })
  act(() => { cid = useStore.getState().addChildNode(pid, 'Task') })
  act(() => { useStore.getState().toggleDone(cid) })
  const child = useStore.getState().doc.roots[0].children[0]
  expect(child.id).toBe(cid)
  expect(child.status).toBe('done')
  act(() => { useStore.getState().toggleDone(cid) })
  expect(useStore.getState().doc.roots[0].children[0].status).toBe('todo')
})

test('setStatus and remove', () => {
  let pid = '', cid = ''
  act(() => { pid = useStore.getState().addProject('P') })
  act(() => { cid = useStore.getState().addChildNode(pid, 'T') })
  act(() => { useStore.getState().setStatus(cid, 'blocked') })
  expect(useStore.getState().doc.roots[0].children[0].status).toBe('blocked')
  act(() => { useStore.getState().remove(cid) })
  expect(useStore.getState().doc.roots[0].children).toHaveLength(0)
})

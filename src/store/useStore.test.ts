import { act } from '@testing-library/react'
import { useStore } from './useStore'
import type { StorageAdapter } from '../lib/storage'
import { emptyDocument } from '../lib/serialize'
import { BUILTIN_TEMPLATES } from '../lib/templates'

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

test('addProjectFromTemplate seeds modules and tasks with a custom name', () => {
  const tpl = BUILTIN_TEMPLATES[0]
  let id = ''
  act(() => { id = useStore.getState().addProjectFromTemplate(tpl, 'My App') })
  const p = useStore.getState().doc.roots.find(r => r.id === id)!
  expect(p.title).toBe('My App')
  expect(p.children).toHaveLength(tpl.modules.length)
  expect(p.children[0].children.length).toBeGreaterThan(0)
})

test('saveAsTemplate captures a project and deleteTemplate removes it', () => {
  let pid = ''
  act(() => { pid = useStore.getState().addProjectFromTemplate(BUILTIN_TEMPLATES[0], 'Src') })
  let tid: string | null = null
  act(() => { tid = useStore.getState().saveAsTemplate(pid) })
  expect(tid).toBeTruthy()
  expect(useStore.getState().doc.templates.find(t => t.id === tid)).toBeTruthy()
  act(() => { useStore.getState().deleteTemplate(tid!) })
  expect(useStore.getState().doc.templates.find(t => t.id === tid)).toBeFalsy()
})

test('addComment appends and removeComment deletes', () => {
  let pid = ''
  act(() => { pid = useStore.getState().addProject('P') })
  act(() => { useStore.getState().addComment(pid, '  first  ') })
  act(() => { useStore.getState().addComment(pid, '') })
  let node = useStore.getState().doc.roots[0]
  expect(node.comments).toHaveLength(1)
  expect(node.comments![0].text).toBe('first')
  const cid = node.comments![0].id
  act(() => { useStore.getState().removeComment(pid, cid) })
  node = useStore.getState().doc.roots[0]
  expect(node.comments ?? []).toHaveLength(0)
})

test('setPos stores a position and clearPositions wipes the subtree', () => {
  let pid = '', mid = ''
  act(() => { pid = useStore.getState().addProject('P') })
  act(() => { mid = useStore.getState().addChildNode(pid, 'Mod') })
  act(() => { useStore.getState().setPos(pid, { x: 10, y: 20 }); useStore.getState().setPos(mid, { x: 30, y: 40 }) })
  expect(useStore.getState().doc.roots[0].pos).toEqual({ x: 10, y: 20 })
  expect(useStore.getState().doc.roots[0].children[0].pos).toEqual({ x: 30, y: 40 })
  act(() => { useStore.getState().clearPositions(pid) })
  expect(useStore.getState().doc.roots[0].pos).toBeUndefined()
  expect(useStore.getState().doc.roots[0].children[0].pos).toBeUndefined()
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

test('completeSubtree marks the node and every descendant done', () => {
  let pid = '', mid = '', a = '', b = ''
  act(() => {
    const s = useStore.getState()
    pid = s.addProject('Rebuild')
    mid = s.addChildNode(pid, 'Design')
    a = s.addChildNode(mid, 'Wireframes')
    b = s.addChildNode(a, 'Deep sub-task')
  })
  act(() => { useStore.getState().completeSubtree(mid) })
  const find = (id: string) => {
    let hit: { status: string } | null = null
    const walk = (n: { id: string; status: string; children: never[] }) => {
      if (n.id === id) hit = n
      ;(n.children as { id: string; status: string; children: never[] }[]).forEach(walk)
    }
    useStore.getState().doc.roots.forEach(r => walk(r as never))
    return hit!
  }
  expect(find(mid).status).toBe('done')
  expect(find(a).status).toBe('done')
  expect(find(b).status).toBe('done')
  // The project above it is untouched — only the subtree completes.
  expect(find(pid).status).not.toBe('done')
})

test('completeSubtree leaves already-done descendants done rather than toggling them', () => {
  let pid = '', mid = '', a = ''
  act(() => {
    const s = useStore.getState()
    pid = s.addProject('Rebuild')
    mid = s.addChildNode(pid, 'Design')
    a = s.addChildNode(mid, 'Wireframes')
    s.toggleDone(a)
  })
  act(() => { useStore.getState().completeSubtree(mid) })
  const mod = useStore.getState().doc.roots[0].children[0]
  expect(mod.status).toBe('done')
  expect(mod.children[0].status).toBe('done')
})

// ── Starting work promotes the containers above it ───────────────────────────

function fixture() {
  let pid = '', mid = '', tid = ''
  act(() => {
    const s = useStore.getState()
    pid = s.addProject('Rebuild')
    mid = s.addChildNode(pid, 'Design')
    tid = s.addChildNode(mid, 'Wireframes')
  })
  return { pid, mid, tid }
}
const statusOf = (id: string) => {
  let hit = ''
  const walk = (n: { id: string; status: string; children: unknown[] }) => {
    if (n.id === id) hit = n.status
    ;(n.children as { id: string; status: string; children: unknown[] }[]).forEach(walk)
  }
  useStore.getState().doc.roots.forEach(r => walk(r as never))
  return hit
}

test('ticking a task moves its module and project to In progress', () => {
  const { pid, mid, tid } = fixture()
  expect(statusOf(pid)).toBe('todo')
  act(() => { useStore.getState().toggleDone(tid) })
  expect(statusOf(mid)).toBe('doing')
  expect(statusOf(pid)).toBe('doing')
})

test('setting a task to any non-todo status promotes its containers', () => {
  const { pid, mid, tid } = fixture()
  act(() => { useStore.getState().setStatus(tid, 'blocked') })
  expect(statusOf(mid)).toBe('doing')
  expect(statusOf(pid)).toBe('doing')
})

test('un-ticking is not starting work, so nothing is promoted', () => {
  const { pid, mid, tid } = fixture()
  act(() => { useStore.getState().toggleDone(tid) })
  act(() => {
    // Put the containers back, then un-tick.
    useStore.getState().setStatus(mid, 'todo')
    useStore.getState().setStatus(pid, 'todo')
    useStore.getState().toggleDone(tid)
  })
  expect(statusOf(mid)).toBe('todo')
  expect(statusOf(pid)).toBe('todo')
})

test('an explicit status on a container is never overridden', () => {
  const { pid, mid, tid } = fixture()
  act(() => { useStore.getState().setStatus(pid, 'blocked') })
  act(() => { useStore.getState().toggleDone(tid) })
  // The module was still To do so it advances; the project's own choice stands.
  expect(statusOf(mid)).toBe('doing')
  expect(statusOf(pid)).toBe('blocked')
})

test('a container already past To do is left alone', () => {
  const { pid, mid, tid } = fixture()
  act(() => { useStore.getState().setStatus(pid, 'done') })
  act(() => { useStore.getState().toggleDone(tid) })
  expect(statusOf(pid)).toBe('done')
  // The module was still To do, so it advances as usual.
  expect(statusOf(mid)).toBe('doing')
})

test('completing a whole subtree promotes the containers above it', () => {
  const f = fixture()
  act(() => { useStore.getState().completeSubtree(f.mid) })
  expect(statusOf(f.pid)).toBe('doing')
})

test('the promotion is recorded in the container’s activity', () => {
  const { pid, tid } = fixture()
  act(() => { useStore.getState().toggleDone(tid) })
  const project = useStore.getState().doc.roots.find(r => r.id === pid)!
  expect((project.activities ?? []).some(a => a.text.includes('In progress'))).toBe(true)
})

test('a project ticked directly has no containers to promote', () => {
  let pid = ''
  act(() => { pid = useStore.getState().addProject('Solo') })
  act(() => { useStore.getState().toggleDone(pid) })
  expect(statusOf(pid)).toBe('done')
})

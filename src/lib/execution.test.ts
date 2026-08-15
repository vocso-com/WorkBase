import { buildWork } from './execution'
import { newNode } from './factory'
import type { Node } from '../types'

const NOW = new Date('2026-08-15T12:00:00')

function tree(): { roots: Node[]; ids: Record<string, string> } {
  const t1 = newNode('Overdue task', { shortId: 'P-1', dueDate: '2026-08-14' })
  const t2 = newNode('Today task', { shortId: 'P-2', dueDate: '2026-08-15' })
  const t3 = newNode('Week task', { shortId: 'P-3', dueDate: '2026-08-18' })
  const t4 = newNode('Later task', { shortId: 'P-4', dueDate: '2026-09-30' })
  const t5 = newNode('No-date task', { shortId: 'P-5' })
  const t6 = newNode('Blocked task', { shortId: 'P-6', dueDate: '2026-08-15', dependsOn: [t1.id] })
  const done = newNode('Done task', { shortId: 'P-7', status: 'done' })
  const mod = newNode('Module', { shortId: 'P-0' })
  mod.children = [t1, t2, t3, t4, t5, t6, done]
  const root = newNode('Project')
  root.children = [mod]
  return { roots: [root], ids: { t1: t1.id, t2: t2.id, t4: t4.id, t5: t5.id, t6: t6.id } }
}

test('open leaves are bucketed by due date; done tasks are excluded', () => {
  const { roots } = tree()
  const w = buildWork(roots, NOW)
  expect(w.total).toBe(6) // 7 leaves minus the done one
  expect(w.overdue.map(i => i.node.shortId)).toEqual(['P-1'])
  expect(w.today.map(i => i.node.shortId)).toEqual(['P-2'])
  expect(w.week.map(i => i.node.shortId)).toEqual(['P-3'])
  // Later + no-date collapse into "anytime", soonest first.
  expect(w.anytime.map(i => i.node.shortId)).toEqual(['P-4', 'P-5'])
})

test('a task with an incomplete dependency is Blocked, not in a due bucket', () => {
  const { roots } = tree()
  const w = buildWork(roots, NOW)
  expect(w.blocked.map(i => i.node.shortId)).toEqual(['P-6'])
  expect(w.today.map(i => i.node.shortId)).not.toContain('P-6')
})

test('focus surfaces the most urgent actionable items first', () => {
  const { roots } = tree()
  const w = buildWork(roots, NOW)
  expect(w.focus[0].node.shortId).toBe('P-1') // overdue leads
  expect(w.focus.map(i => i.node.shortId)).not.toContain('P-6') // blocked never in focus
})

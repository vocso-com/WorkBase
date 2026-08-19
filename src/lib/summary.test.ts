import { projectSummary, formatDuration } from './summary'
import { newNode } from './factory'
import type { Node } from '../types'

const day = 86400000
const iso = (offsetDays: number) => new Date(Date.parse('2026-08-19T12:00:00Z') + offsetDays * day).toISOString()

function finished(extra: Partial<Node> = {}, kids: Node[] = [newNode('t', { status: 'done' })]): Node {
  return newNode('Acme Redesign', {
    status: 'done',
    createdAt: iso(-50),
    baselineAt: iso(-42),
    baselineWeight: 10,
    completedAt: iso(0),
    children: [newNode('Design', { status: 'done', children: kids })],
    ...extra,
  })
}

test('a project that is not finished has no summary to give', () => {
  const open = newNode('Acme', { children: [newNode('a')] })
  expect(projectSummary(open)).toBeNull()
})

test('a project ticked done while work is still open has no summary either', () => {
  const lying = newNode('Acme', { status: 'done', completedAt: iso(0), children: [newNode('a')] })
  expect(projectSummary(lying)).toBeNull()
})

test('it counts the work and measures from kickoff, not creation', () => {
  const s = projectSummary(finished())!
  expect(s.tasks).toBe(1)
  expect(s.modules).toBe(1)
  // Kickoff was 42 days before completion; the project existed 8 days before that.
  expect(s.days).toBe(42)
})

test('it reports finishing ahead of the deadline', () => {
  const s = projectSummary(finished({ dueDate: iso(3).slice(0, 10) }))!
  expect(s.deadline).toEqual({ days: 3, early: true })
})

test('it reports finishing late just as plainly', () => {
  const s = projectSummary(finished({ dueDate: iso(-5).slice(0, 10) }))!
  expect(s.deadline).toEqual({ days: 5, early: false })
})

test('no deadline, nothing to say about one', () => {
  expect(projectSummary(finished())!.deadline).toBeNull()
})

test('it carries the scope growth since kickoff', () => {
  const kids = Array.from({ length: 15 }, (_, i) => newNode(`t${i}`, { status: 'done' }))
  const s = projectSummary(finished({}, kids))!
  expect(s.scopeGrowth).toBeCloseTo(0.5, 5) // 10 at kickoff, 15 at the end
})

test('formatDuration speaks in the largest honest unit', () => {
  // "0 days" is not something anyone says.
  expect(formatDuration(0)).toBe('same day')
  expect(formatDuration(1)).toBe('1 day')
  expect(formatDuration(6)).toBe('6 days')
  expect(formatDuration(14)).toBe('2 weeks')
  expect(formatDuration(42)).toBe('6 weeks')
  expect(formatDuration(120)).toBe('4 months')
})

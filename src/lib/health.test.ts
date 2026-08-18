import { healthOf, staleAfterDays } from './health'
import { newNode } from './factory'
import type { Node } from '../types'

const NOW = new Date('2026-08-19T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString()
const dateIn = (n: number) => new Date(NOW.getTime() + n * 86400000).toISOString().slice(0, 10)

const node = (title: string, extra: Partial<Node> = {}): Node =>
  newNode(title, { createdAt: daysAgo(30), updatedAt: daysAgo(1), ...extra })

test('a project with nothing wrong is on track', () => {
  const p = node('P', { children: [node('a'), node('b', { status: 'done' })] })
  expect(healthOf([p], p, NOW).state).toBe('on-track')
})

test('an overdue descendant puts the project at risk and is counted', () => {
  const p = node('P', {
    children: [node('a', { dueDate: dateIn(-3) }), node('b', { dueDate: dateIn(-1) }), node('c')],
  })
  const h = healthOf([p], p, NOW)
  expect(h.state).toBe('at-risk')
  expect(h.evidence.join(' ')).toContain('2 items overdue')
})

test('a completed descendant past its date is not overdue', () => {
  const p = node('P', { children: [node('a', { status: 'done', dueDate: dateIn(-5) })] })
  expect(healthOf([p], p, NOW).state).toBe('on-track')
})

test('an unmet dependency blocks when nothing is overdue', () => {
  const gate = node('Client feedback')
  const waiting = node('Build', { dependsOn: [gate.id] })
  const p = node('P', { children: [gate, waiting] })
  const h = healthOf([p], p, NOW)
  expect(h.state).toBe('blocked')
  expect(h.evidence.join(' ')).toContain('1 blocked')
})

test('overdue outranks blocked', () => {
  const gate = node('Gate')
  const waiting = node('Build', { dependsOn: [gate.id], dueDate: dateIn(-2) })
  const p = node('P', { children: [gate, waiting] })
  expect(healthOf([p], p, NOW).state).toBe('at-risk')
})

test('a project nobody has touched past its tempo is stalled', () => {
  const p = node('P', {
    updatedAt: daysAgo(40),
    children: [node('a', { updatedAt: daysAgo(40) })],
  })
  const h = healthOf([p], p, NOW)
  expect(h.state).toBe('stalled')
  expect(h.evidence.join(' ')).toContain('40 days')
})

test('freshness comes from anywhere in the subtree, not just the root', () => {
  const p = node('P', {
    updatedAt: daysAgo(40),
    children: [node('a', { updatedAt: daysAgo(1) })],
  })
  expect(healthOf([p], p, NOW).state).toBe('on-track')
})

test('staleness scales with a node horizon rather than a fixed day count', () => {
  const short = node('Sprint task', { createdAt: daysAgo(4), dueDate: dateIn(4) })
  const long = node('Six month build', { createdAt: daysAgo(30), dueDate: dateIn(150) })
  expect(staleAfterDays(short, NOW)).toBeLessThan(staleAfterDays(long, NOW))
})

test('staleness never drops below the floor for very short horizons', () => {
  const tiny = node('Tomorrow', { createdAt: daysAgo(0), dueDate: dateIn(1) })
  expect(staleAfterDays(tiny, NOW)).toBeGreaterThanOrEqual(3)
})

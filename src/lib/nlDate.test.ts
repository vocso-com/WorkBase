import { describe, it, expect } from 'vitest'
import { parseDue } from './nlDate'

// Anchor "now" to a fixed Wednesday, 2025-08-13 (12:00) for deterministic tests.
const NOW = new Date(2025, 7, 13, 12, 0, 0)

describe('parseDue', () => {
  it('returns the plain title when there is no date', () => {
    expect(parseDue('polish the landing page', NOW)).toEqual({ title: 'polish the landing page' })
  })

  it('parses tomorrow and strips it from the title', () => {
    const r = parseDue('call sam tomorrow', NOW)
    expect(r.title).toBe('call sam')
    expect(r.dueDate).toBe('2025-08-14')
  })

  it('parses "in N days"', () => {
    expect(parseDue('review in 3 days', NOW).dueDate).toBe('2025-08-16')
  })

  it('parses a weekday as the next occurrence', () => {
    // Wed → Fri is 2 days out.
    expect(parseDue('ship blog fri', NOW).dueDate).toBe('2025-08-15')
    expect(parseDue('ship blog fri', NOW).title).toBe('ship blog')
  })

  it('treats the same weekday as a week out', () => {
    expect(parseDue('sync wednesday', NOW).dueDate).toBe('2025-08-20')
  })

  it('parses "next week" and "next friday"', () => {
    expect(parseDue('plan next week', NOW).dueDate).toBe('2025-08-18')
    expect(parseDue('demo next friday', NOW).dueDate).toBe('2025-08-22')
  })

  it('parses a month + day, rolling to next year if passed', () => {
    expect(parseDue('taxes apr 15', NOW).dueDate).toBe('2026-04-15')
    expect(parseDue('launch aug 20', NOW).dueDate).toBe('2025-08-20')
  })

  it('drops connector words like "by"', () => {
    expect(parseDue('finish deck by tomorrow', NOW).title).toBe('finish deck')
  })
})

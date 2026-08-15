// Tiny natural-language date parser for quick-add. Pulls a due date out of a
// typed phrase ("ship blog fri", "call sam tomorrow", "review in 3 days") and
// returns the cleaned title alongside it. No dependencies, local-time safe.

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, thursday: 4, thu: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
}
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + n)
  return d
}

// Next occurrence of a weekday (0=Sun). 0 days away → a week out (people mean
// "next Friday", not "today").
function nextWeekday(base: Date, target: number, forceNext: boolean): Date {
  let days = (target - base.getDay() + 7) % 7
  if (days === 0) days = 7
  if (forceNext && days < 7) days += 7
  return addDays(base, days)
}

export interface ParsedDue {
  title: string
  dueDate?: string
  dueLabel?: string
}

/** Extract a due date from free text, returning the remaining title. */
export function parseDue(input: string, now: Date = new Date()): ParsedDue {
  const text = input.trim()
  if (!text) return { title: '' }

  // Each matcher: a regex and a resolver producing a Date. First hit wins.
  const matchers: { re: RegExp; fn: (m: RegExpMatchArray) => Date | null }[] = [
    { re: /\b(?:on |by |due )?(today|tonight)\b/i, fn: () => addDays(now, 0) },
    { re: /\b(?:on |by |due )?(tomorrow|tmrw|tmr)\b/i, fn: () => addDays(now, 1) },
    { re: /\bin (\d{1,3}) days?\b/i, fn: m => addDays(now, parseInt(m[1], 10)) },
    { re: /\bnext week\b/i, fn: () => nextWeekday(now, 1, false) },
    { re: /\b(?:this )?weekend\b/i, fn: () => nextWeekday(now, 6, false) },
    { re: /\bnext (sunday|sun|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thu|friday|fri|saturday|sat)\b/i, fn: m => nextWeekday(now, WEEKDAYS[m[1].toLowerCase()], true) },
    { re: /\b(?:on |by |due )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i, fn: m => nextWeekday(now, WEEKDAYS[m[1].toLowerCase()], false) },
    { re: /\b(?:on |by |due )?(mon|tues|tue|wed|thurs|thu|fri|sat|sun)\b/i, fn: m => nextWeekday(now, WEEKDAYS[m[1].toLowerCase()], false) },
    { re: new RegExp(`\\b(?:on |by |due )?(${MONTHS.join('|')})[a-z]* (\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'), fn: m => monthDay(now, MONTHS.indexOf(m[1].toLowerCase().slice(0, 3)), parseInt(m[2], 10)) },
    { re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)? (${MONTHS.join('|')})[a-z]*\\b`, 'i'), fn: m => monthDay(now, MONTHS.indexOf(m[2].toLowerCase().slice(0, 3)), parseInt(m[1], 10)) },
  ]

  for (const { re, fn } of matchers) {
    const m = text.match(re)
    if (!m || m.index === undefined) continue
    const d = fn(m)
    if (!d) continue
    const title = (text.slice(0, m.index) + text.slice(m.index + m[0].length))
      .replace(/\s{2,}/g, ' ')
      .replace(/[\s,]+$/, '')
      .replace(/^[\s,]+/, '')
      .trim()
    return {
      title: title || text,
      dueDate: localISO(d),
      dueLabel: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    }
  }
  return { title: text }
}

function monthDay(now: Date, month: number, day: number): Date | null {
  if (month < 0 || day < 1 || day > 31) return null
  const d = new Date(now)
  d.setHours(12, 0, 0, 0)
  d.setMonth(month, day)
  // If the date already passed this year, roll to next year.
  if (d.getTime() < addDays(now, 0).getTime()) d.setFullYear(d.getFullYear() + 1)
  return d
}

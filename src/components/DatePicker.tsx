import { useEffect, useMemo, useRef, useState } from 'react'
import { parseDue } from '../lib/nlDate'
import { dueInfo } from '../lib/due'
import { Icon } from './ui/Icon'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const pad = (n: number) => String(n).padStart(2, '0')
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fromISO = (s?: string): Date | null => {
  if (!s) return null
  const d = new Date(`${s}T00:00:00`)
  return isNaN(d.getTime()) ? null : d
}
const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
const sameDay = (a: Date, b: Date) => toISO(a) === toISO(b)

/**
 * A six-week grid for a month, padded with the neighbouring months' days so the
 * calendar never changes height as you page through it.
 */
function monthGrid(view: Date): Date[] {
  const first = new Date(view.getFullYear(), view.getMonth(), 1)
  const start = addDays(first, -first.getDay())
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

interface Props {
  value?: string
  onChange: (iso: string | undefined) => void
  onClose: () => void
}

/**
 * Due-date picker. Replaces the browser's native `<input type=date>` popup,
 * which cannot be styled and sits oddly against the rest of the app.
 *
 * Three ways in, cheapest first: the shortcut row for the dates people actually
 * pick, a typed box that understands "next friday" (the same parser the quick
 * add uses), and the grid for everything else.
 */
export function DatePicker({ value, onChange, onClose }: Props) {
  const today = useMemo(() => new Date(), [])
  const selected = fromISO(value)
  const [view, setView] = useState(() => selected ?? today)
  const [typed, setTyped] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as globalThis.Node)) onClose() }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [onClose])

  const days = useMemo(() => monthGrid(view), [view])
  const pick = (d: Date) => { onChange(toISO(d)); onClose() }

  const shortcuts: { label: string; date: Date }[] = [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: addDays(today, 1) },
    { label: 'Next week', date: addDays(today, 7) },
  ]

  // The typed box reuses the quick-add parser, so "fri", "in 3 days" and
  // "next monday" all work and preview before committing.
  const guess = typed.trim() ? parseDue(typed).dueDate : undefined
  const guessDate = fromISO(guess)

  const info = selected ? dueInfo(value) : null

  return (
    <div className="dp" ref={ref} role="dialog" aria-label="Choose a due date">
      <div className="dp-quick">
        {shortcuts.map(s => (
          <button
            key={s.label}
            className={`dp-chip${selected && sameDay(selected, s.date) ? ' on' : ''}`}
            onClick={() => pick(s.date)}
          >
            {s.label}
            <span className="dp-chip-d">{s.date.getDate()} {s.date.toLocaleDateString(undefined, { month: 'short' })}</span>
          </button>
        ))}
      </div>

      <div className="dp-typed">
        <Icon name="ti-wand" />
        <input
          value={typed}
          placeholder="or type — “next friday”, “in 3 days”"
          onChange={e => setTyped(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && guessDate) { e.preventDefault(); pick(guessDate) }
          }}
        />
        {typed.trim() ? (
          guessDate
            ? <button className="dp-typed-go" onClick={() => pick(guessDate)}>{guessDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</button>
            : <span className="dp-typed-no">no date found</span>
        ) : null}
      </div>

      <div className="dp-head">
        <button className="dp-nav" onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth() - 1, 1))} aria-label="Previous month">
          <Icon name="ti-chevron-left" />
        </button>
        <span className="dp-month">{view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
        <button className="dp-nav" onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth() + 1, 1))} aria-label="Next month">
          <Icon name="ti-chevron-right" />
        </button>
      </div>

      <div className="dp-grid dp-dow">
        {WEEKDAYS.map(d => <span key={d}>{d}</span>)}
      </div>
      <div className="dp-grid">
        {days.map(d => {
          const outside = d.getMonth() !== view.getMonth()
          const isToday = sameDay(d, today)
          const isSel = selected ? sameDay(d, selected) : false
          const isGuess = guessDate ? sameDay(d, guessDate) : false
          return (
            <button
              key={toISO(d)}
              className={`dp-day${outside ? ' out' : ''}${isToday ? ' today' : ''}${isSel ? ' sel' : ''}${isGuess && !isSel ? ' guess' : ''}`}
              onClick={() => pick(d)}
              aria-current={isSel ? 'date' : undefined}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>

      <div className="dp-foot">
        {info ? <span className={`dp-state dp-state-${info.tone}`}>{info.label}</span> : <span className="dp-state dp-state-none">No due date</span>}
        {value ? (
          <button className="dp-clear" onClick={() => { onChange(undefined); onClose() }}>
            <Icon name="ti-x" /> Clear
          </button>
        ) : null}
      </div>
    </div>
  )
}

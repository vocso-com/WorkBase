import type { Status } from '../../types'
import { COLORS } from '../../theme'
import { Icon } from './Icon'

// `color` is accepted for API compatibility but a completed check is always the
// universal green so "done" reads at a glance. The bundled webfont has no filled
// glyphs, so the solid box is composed with CSS + a plain check.
// `color` is accepted for API compatibility but a completed check is always the
// universal green so "done" reads at a glance. `round` swaps the square for a
// circle — used in the outline view, where a lighter circular tick reads better.
export function Checkbox({ status, onToggle, round }: { status: Status; color?: string; onToggle: () => void; round?: boolean }) {
  const done = status === 'done'
  return (
    <button aria-label="toggle done" onClick={onToggle}
      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, display: 'inline-flex', flexShrink: 0 }}>
      {done ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: round ? '50%' : 5, background: COLORS.teal, color: '#fff', fontSize: 13 }}>
          <Icon name="ti-check" />
        </span>
      ) : (
        <span style={{ fontSize: 18, lineHeight: 1, color: 'var(--faint)' }}><Icon name={round ? 'ti-circle' : 'ti-square'} /></span>
      )}
    </button>
  )
}

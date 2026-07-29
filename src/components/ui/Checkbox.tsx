import type { Status } from '../../types'
import { COLORS } from '../../theme'
import { Icon } from './Icon'

export function Checkbox({ status, color = 'teal', onToggle }: { status: Status; color?: keyof typeof COLORS; onToggle: () => void }) {
  const done = status === 'done'
  return (
    <button aria-label="toggle done" onClick={onToggle}
      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, fontSize: 18, lineHeight: 1,
        color: done ? COLORS[color] : 'var(--faint)' }}>
      <Icon name={done ? 'ti-square-check-filled' : 'ti-square'} />
    </button>
  )
}

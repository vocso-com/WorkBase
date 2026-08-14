import { dueInfo } from '../lib/due'
import { tagBg, tagFg } from '../lib/colorMode'
import { Icon } from './ui/Icon'

export function DueChip({ dueDate }: { dueDate?: string }) {
  const info = dueInfo(dueDate)
  if (!info) return null
  return (
    <span className={`duechip due-${info.tone}`} style={{ background: tagBg(info.color), color: tagFg(info.color) }}>
      <Icon name="ti-clock" /> {info.label}
    </span>
  )
}

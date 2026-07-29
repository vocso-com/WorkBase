import type { Tag as TagT } from '../../types'
import { tagBg, tagFg } from '../../lib/colorMode'

export function Tag({ tag }: { tag: TagT }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: tagBg(tag.color), color: tagFg(tag.color) }}>
      {tag.name}
    </span>
  )
}

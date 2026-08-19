export interface RingSegment {
  id: string
  color: string
  /** Percentage of the whole ring this stage occupies, 0-100. */
  value: number
}

/**
 * Stroke and label scale with the ring so "100%" always clears the arc — at a
 * fixed 11px the label crowded the stroke on the smaller sizes.
 *
 * Given `segments`, the ring is drawn one arc per stage in the same colours the
 * card-view bar uses, so the two read as the same information. The project's
 * own colour is deliberately not used: it identifies the project, and reusing
 * it for progress makes every project's ring mean something different.
 */
export function ProgressRing({
  value,
  color,
  size = 42,
  segments,
}: {
  value: number
  color: string
  size?: number
  segments?: RingSegment[]
}) {
  const stroke = Math.max(4, Math.round(size * 0.105))
  const r = (size - stroke - 3) / 2
  const c = 2 * Math.PI * r
  const cx = size / 2
  // 0.21 rather than 0.25: at a quarter of the ring, "100%" ran into the arc.
  const fontSize = Math.max(9, Math.round(size * 0.21))

  const arcs: RingSegment[] = segments?.length
    ? segments
    : [{ id: 'value', color, value }]

  let start = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
      {arcs.map(seg => {
        const len = c * (Math.max(0, Math.min(100, seg.value)) / 100)
        const offset = -c * (start / 100)
        start += seg.value
        return (
          <circle
            key={seg.id}
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={stroke}
            strokeDasharray={`${len.toFixed(1)} ${(c - len).toFixed(1)}`}
            strokeDashoffset={offset.toFixed(1)}
            transform={`rotate(-90 ${cx} ${cx})`}
          />
        )
      })}
      <text x={cx} y={cx + fontSize * 0.35} textAnchor="middle" fontSize={fontSize} fontWeight={700} fill="var(--ink)">
        {value}%
      </text>
    </svg>
  )
}

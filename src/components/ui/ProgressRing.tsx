// Stroke and label scale with the ring so "100%" always clears the arc — at a
// fixed 11px the label crowded the stroke on the smaller sizes.
export function ProgressRing({ value, color, size = 42 }: { value: number; color: string; size?: number }) {
  const stroke = Math.max(4, Math.round(size * 0.105))
  const r = (size - stroke - 3) / 2
  const c = 2 * Math.PI * r
  const off = c * (1 - value / 100)
  const cx = size / 2
  const fontSize = Math.max(9, Math.round(size * 0.25))
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
      <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c.toFixed(1)} strokeDashoffset={off.toFixed(1)} transform={`rotate(-90 ${cx} ${cx})`} />
      <text x={cx} y={cx + fontSize * 0.35} textAnchor="middle" fontSize={fontSize} fontWeight={700} fill="var(--ink)">
        {value}%
      </text>
    </svg>
  )
}

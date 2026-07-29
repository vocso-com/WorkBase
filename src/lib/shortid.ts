import type { Node } from '../types'

export function projectPrefix(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  const w = words[0] ?? 'X'
  return (w.slice(0, 2) || 'X').toUpperCase()
}

function collect(roots: Node[], out: string[]): void {
  for (const nd of roots) {
    out.push(nd.shortId)
    collect(nd.children, out)
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function nextShortId(roots: Node[], prefix: string): string {
  const ids: string[] = []
  collect(roots, ids)
  const esc = escapeRegExp(prefix)
  let max = 0
  for (const id of ids) {
    const m = id.match(new RegExp(`^${esc}-(\\d+)$`))
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `${prefix}-${max + 1}`
}

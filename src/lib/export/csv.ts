import type { Node, Stage } from '../../types'
import { stageMeta } from '../../theme'
import { toText } from '../text'
import { newNode } from '../factory'

/**
 * A project as a spreadsheet: one row per item, at every level.
 *
 * `parentShortId` is what rebuilds the tree on import — `path` and `level` are
 * there so the file reads sensibly in Excel and are ignored when reading back.
 * Every node gets a row, so a container with no tasks survives the round trip
 * and nesting is not capped at three levels.
 */
export const CSV_COLUMNS = [
  'shortId',
  'parentShortId',
  'level',
  'path',
  'title',
  'status',
  'stage',
  'priority',
  'dueDate',
  'tags',
  'description',
  'dependsOn',
] as const

const escape = (v: string): string =>
  /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v

export function encodeCsv(rows: string[][]): string {
  return rows.map(r => r.map(escape).join(',')).join('\r\n') + '\r\n'
}

/**
 * RFC 4180 reader: handles quoted fields containing commas, newlines and
 * doubled quotes. Returns rows of raw strings; blank trailing lines are dropped.
 */
export function decodeCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let i = 0
  // A leading BOM survives round trips through Excel and would otherwise become
  // part of the first header name.
  if (text.charCodeAt(0) === 0xfeff) i = 1

  const endField = () => { row.push(field); field = '' }
  const endRow = () => { endField(); rows.push(row); row = [] }

  while (i < text.length) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        quoted = false; i++; continue
      }
      field += c; i++; continue
    }
    if (c === '"') { quoted = true; i++; continue }
    if (c === ',') { endField(); i++; continue }
    if (c === '\r') { if (text[i + 1] === '\n') i++; endRow(); i++; continue }
    if (c === '\n') { endRow(); i++; continue }
    field += c; i++
  }
  if (field.length > 0 || row.length > 0) endRow()
  return rows.filter(r => r.length > 1 || r[0] !== '')
}

export function projectToCsv(node: Node, stages: Stage[] = [], stageLabels?: Record<string, string>): string {
  const rows: string[][] = [[...CSV_COLUMNS]]
  // shortId is the key on the way back in, so a node without one still needs a
  // stable handle; fall back to a positional id.
  const keyOf = (n: Node, fallback: string) => n.shortId || fallback

  const walk = (n: Node, parentKey: string, level: number, trail: string[], index: string) => {
    const key = keyOf(n, index)
    const path = [...trail, n.title]
    rows.push([
      key,
      parentKey,
      String(level),
      path.join(' > '),
      n.title,
      n.status,
      stageMeta(stages, n.status, stageLabels).label,
      n.priority ?? '',
      n.dueDate ?? '',
      (n.tags ?? []).map(t => t.name).join('; '),
      toText(n.description),
      (n.dependsOn ?? []).join('; '),
    ])
    n.children.forEach((c, i) => walk(c, key, level + 1, path, `${index}.${i + 1}`))
  }
  walk(node, '', 0, [], '1')
  return encodeCsv(rows)
}

/**
 * Rebuild projects from a CSV. Every level-0 row starts a new project, so a
 * file holding several projects imports as several.
 *
 * Throws with a specific message when the shape is wrong — a mis-picked file
 * should say what is missing, not fail silently.
 */
export function csvToProjects(text: string): Node[] {
  const rows = decodeCsv(text)
  if (rows.length === 0) throw new Error('That CSV file is empty.')

  const header = rows[0].map(h => h.trim())
  const col = (name: string) => header.findIndex(h => h.toLowerCase() === name.toLowerCase())
  const iKey = col('shortId')
  const iParent = col('parentShortId')
  const iTitle = col('title')
  if (iTitle < 0) throw new Error('That CSV has no “title” column, so there is nothing to import.')
  if (iKey < 0 || iParent < 0) {
    throw new Error('That CSV is missing the “shortId” and “parentShortId” columns needed to rebuild the structure.')
  }

  const iStatus = col('status')
  const iPriority = col('priority')
  const iDue = col('dueDate')
  const iTags = col('tags')
  const iDesc = col('description')
  const iDeps = col('dependsOn')
  const at = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '')

  const byKey = new Map<string, Node>()
  const parentOf = new Map<string, string>()
  const order: string[] = []

  for (const r of rows.slice(1)) {
    const title = at(r, iTitle)
    if (!title) continue
    const key = at(r, iKey) || `row-${order.length + 1}`
    const priority = at(r, iPriority)
    const node = newNode(title, {
      shortId: key,
      status: at(r, iStatus) || 'todo',
      priority: priority === 'low' || priority === 'med' || priority === 'high' ? priority : undefined,
      dueDate: at(r, iDue) || undefined,
      description: at(r, iDesc) || undefined,
      tags: at(r, iTags)
        ? at(r, iTags).split(';').map(t => t.trim()).filter(Boolean).map(name => ({ name, color: 'slate' as const }))
        : undefined,
    })
    const deps = at(r, iDeps)
    if (deps) node.dependsOn = deps.split(';').map(d => d.trim()).filter(Boolean)
    byKey.set(key, node)
    parentOf.set(key, at(r, iParent))
    order.push(key)
  }

  if (order.length === 0) throw new Error('That CSV has a header but no rows to import.')

  const roots: Node[] = []
  for (const key of order) {
    const node = byKey.get(key)!
    const parentKey = parentOf.get(key)!
    const parent = parentKey ? byKey.get(parentKey) : undefined
    if (parent && parent !== node) parent.children.push(node)
    else roots.push(node)
  }

  // dependsOn held shortIds in the file; map them onto the new node ids and drop
  // any pointing outside the file.
  for (const key of order) {
    const node = byKey.get(key)!
    if (!node.dependsOn) continue
    node.dependsOn = node.dependsOn.map(k => byKey.get(k)?.id).filter((id): id is string => !!id)
    if (node.dependsOn.length === 0) delete node.dependsOn
  }

  return roots
}

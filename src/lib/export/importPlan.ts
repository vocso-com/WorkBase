import { nanoid } from 'nanoid'
import type { Node, Stage, StoreDoc, Tag } from '../../types'
import { projectPrefix, nextShortId } from '../shortid'
import { leaves } from '../tree'
import { parseProjectExport } from './json'
import { csvToProjects } from './csv'

/** What to do with a project that already exists in this document. */
export type Resolution = 'add' | 'update' | 'ignore'

export interface IncomingProject {
  node: Node
  stages: Stage[]
  tagPalette: Tag[]
}

export type ImportFormat = 'project' | 'backup' | 'csv'

export interface ParsedImport {
  format: ImportFormat
  projects: IncomingProject[]
}

/** A row in the import dialog: what is coming in, and what it collides with. */
export interface ImportCandidate {
  key: string
  title: string
  modules: number
  tasks: number
  /** The project in this document it matches, if any. */
  existingId?: string
  /** Pre-selected resolution. Non-destructive by default. */
  resolution: Resolution
  selected: boolean
}

const FORMAT_LABEL: Record<ImportFormat, string> = {
  project: 'WorkBase project (JSON)',
  backup: 'WorkBase account backup (JSON)',
  csv: 'Spreadsheet (CSV)',
}
export const formatLabel = (f: ImportFormat) => FORMAT_LABEL[f]

/**
 * Work out what a file holds. Sniffs JSON vs CSV from the content rather than
 * the extension, so a mis-named file still imports; anything unrecognisable
 * throws with a message naming what was expected.
 */
export function parseImportFile(text: string): ParsedImport {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('That file is empty.')

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      throw new Error('That file looks like JSON but could not be read. It may be truncated.')
    }
    const p = parsed as Record<string, unknown>

    if (p.kind === 'project') {
      const exp = parseProjectExport(trimmed)
      return { format: 'project', projects: [{ node: exp.node, stages: exp.stages, tagPalette: exp.tagPalette }] }
    }
    if (Array.isArray(p.roots)) {
      const stages = Array.isArray(p.stages) ? (p.stages as Stage[]) : []
      const tagPalette = Array.isArray(p.tagPalette) ? (p.tagPalette as Tag[]) : []
      const roots = p.roots as Node[]
      if (roots.length === 0) throw new Error('That backup has no projects in it.')
      return { format: 'backup', projects: roots.map(node => ({ node, stages, tagPalette })) }
    }
    throw new Error('That JSON is not a WorkBase project or account backup.')
  }

  return {
    format: 'csv',
    projects: csvToProjects(text).map(node => ({ node, stages: [], tagPalette: [] })),
  }
}

const norm = (s: string) => s.trim().toLowerCase()

/**
 * Match each incoming project against what is already here and propose a
 * resolution. Matching is by id first — the same project re-exported from this
 * document — then by title, which is what a person means by "the same project".
 *
 * A collision pre-selects `add`, not `update`: a mis-picked file should never
 * silently overwrite work. The dialog offers all three.
 */
export function planImport(doc: StoreDoc, parsed: ParsedImport): ImportCandidate[] {
  const byId = new Map(doc.roots.map(r => [r.id, r]))
  const byTitle = new Map(doc.roots.map(r => [norm(r.title), r]))

  return parsed.projects.map((p, i) => {
    const existing = byId.get(p.node.id) ?? byTitle.get(norm(p.node.title))
    const all = leaves(p.node)
    return {
      key: `${p.node.id || 'p'}-${i}`,
      title: p.node.title,
      modules: p.node.children.length,
      tasks: all.length,
      existingId: existing?.id,
      resolution: 'add',
      selected: true,
    }
  })
}

/** Fresh ids throughout, with `dependsOn` remapped and out-of-subtree links dropped. */
function reid(n: Node, map: Map<string, string>): Node {
  return {
    ...n,
    id: map.get(n.id)!,
    dependsOn: n.dependsOn?.map(d => map.get(d)).filter((d): d is string => !!d),
    children: n.children.map(c => reid(c, map)),
  }
}

function freshCopy(node: Node): Node {
  const map = new Map<string, string>()
  const walk = (n: Node) => { map.set(n.id, nanoid()); n.children.forEach(walk) }
  walk(node)
  return reid(node, map)
}

function reissueShortIds(root: Node, others: Node[]): void {
  const prefix = projectPrefix(root.title)
  const working = [...others, root]
  const walk = (n: Node) => { n.shortId = nextShortId(working, prefix); n.children.forEach(walk) }
  walk(root)
}

/**
 * Apply the dialog's decisions. Pure: returns a new document and leaves the one
 * it was given untouched.
 *
 * `add` appends a fresh copy. `update` keeps the existing project's identity —
 * its id, so open tabs survive, and its workspace — while replacing its content
 * with the incoming one. `ignore` skips it.
 *
 * Stages and tags are always additive: an incoming definition that collides
 * with a local one loses, because the local one is what the user has been
 * looking at.
 */
export function applyImport(
  doc: StoreDoc,
  parsed: ParsedImport,
  decisions: ImportCandidate[],
): { doc: StoreDoc; added: number; updated: number; ignored: number; openId?: string } {
  let roots = [...doc.roots]
  const stages = [...doc.stages]
  const tagPalette = [...doc.tagPalette]
  const stageIds = new Set(stages.map(s => s.id))
  const tagNames = new Set(tagPalette.map(t => norm(t.name)))
  let added = 0
  let updated = 0
  let ignored = 0
  let openId: string | undefined

  decisions.forEach((d, i) => {
    const incoming = parsed.projects[i]
    if (!incoming || !d.selected || d.resolution === 'ignore') { if (d.selected) ignored++; return }

    for (const s of incoming.stages) if (!stageIds.has(s.id)) { stages.push(s); stageIds.add(s.id) }
    for (const t of incoming.tagPalette) if (!tagNames.has(norm(t.name))) { tagPalette.push(t); tagNames.add(norm(t.name)) }

    const now = new Date().toISOString()
    const copy = freshCopy(incoming.node)

    if (d.resolution === 'update' && d.existingId) {
      const at = roots.findIndex(r => r.id === d.existingId)
      if (at >= 0) {
        const prev = roots[at]
        const next: Node = { ...copy, id: prev.id, workspace: prev.workspace, pos: prev.pos, updatedAt: now }
        reissueShortIds(next, roots.filter(r => r.id !== prev.id))
        roots = [...roots.slice(0, at), next, ...roots.slice(at + 1)]
        updated++
        openId = next.id
        return
      }
    }

    const next: Node = { ...copy, workspace: doc.activeWorkspace, updatedAt: now }
    reissueShortIds(next, roots)
    roots = [...roots, next]
    added++
    openId = next.id
  })

  return { doc: { ...doc, roots, stages, tagPalette }, added, updated, ignored, openId }
}

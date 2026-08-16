import { nanoid } from 'nanoid'
import type { Node, Stage, StoreDoc, Tag } from '../../types'
import { projectPrefix, nextShortId } from '../shortid'

/**
 * A single project, portable between installs. Deliberately distinct from the
 * whole-account backup in lib/transfer.ts, which carries a StoreDoc: this
 * envelope brings along only the stages and tags the subtree actually
 * references, so the project can resolve its own statuses and labels wherever
 * it lands.
 */
export interface ProjectExport {
  version: 1
  kind: 'project'
  exportedAt: string
  node: Node
  stages: Stage[]
  stageLabels?: Record<string, string>
  tagPalette: Tag[]
}

/** Every node in a subtree, root included. */
function walk(n: Node, visit: (n: Node) => void): void {
  visit(n)
  n.children.forEach(c => walk(c, visit))
}

export function toProjectExport(node: Node, doc: StoreDoc, exportedAt: string): ProjectExport {
  const statuses = new Set<string>()
  const tagNames = new Set<string>()
  walk(node, n => {
    statuses.add(n.status)
    n.tags?.forEach(t => tagNames.add(t.name))
  })

  return {
    version: 1,
    kind: 'project',
    exportedAt,
    node,
    stages: doc.stages.filter(s => statuses.has(s.id)),
    stageLabels: doc.stageLabels,
    tagPalette: doc.tagPalette.filter(t => tagNames.has(t.name)),
  }
}

export function parseProjectExport(text: string): ProjectExport {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  const p = parsed as Partial<ProjectExport>
  if (p?.kind !== 'project') throw new Error('That file is not a WorkBase project export.')
  if (typeof p.version !== 'number' || p.version > 1) throw new Error('That project was exported by a newer version of WorkBase.')
  if (!p.node || typeof p.node !== 'object' || !Array.isArray(p.node.children)) throw new Error('That project export is missing its project.')

  return {
    version: 1,
    kind: 'project',
    exportedAt: typeof p.exportedAt === 'string' ? p.exportedAt : '',
    node: p.node,
    stages: Array.isArray(p.stages) ? p.stages : [],
    stageLabels: p.stageLabels && typeof p.stageLabels === 'object' ? p.stageLabels : undefined,
    tagPalette: Array.isArray(p.tagPalette) ? p.tagPalette : [],
  }
}

/**
 * Merge an exported project into a document. Additive by design: the incoming
 * project is appended to the active workspace with fresh ids and shortIds, and
 * any stage or tag it needs that the document lacks is added. Nothing already
 * in the document is overwritten — a colliding stage id or tag name keeps the
 * local definition, since that is the one the user has been looking at.
 */
export function mergeProjectExport(doc: StoreDoc, exp: ProjectExport): StoreDoc {
  const now = new Date().toISOString()

  // Fresh ids throughout, so importing the same file twice yields two distinct
  // projects rather than a silent id collision. Dependencies are remapped onto
  // the new ids, and any pointing outside the subtree are dropped.
  const idMap = new Map<string, string>()
  walk(exp.node, n => idMap.set(n.id, nanoid()))

  const reid = (n: Node): Node => ({
    ...n,
    id: idMap.get(n.id)!,
    dependsOn: n.dependsOn?.map(d => idMap.get(d)).filter((d): d is string => !!d),
    children: n.children.map(reid),
  })

  const root: Node = { ...reid(exp.node), workspace: doc.activeWorkspace, updatedAt: now }

  // Re-issue shortIds against the ids already in the document, walking the tree
  // in the same order the app does so numbering reads naturally.
  const prefix = projectPrefix(root.title)
  const working = [...doc.roots, root]
  walk(root, n => { n.shortId = nextShortId(working, prefix) })

  const stageIds = new Set(doc.stages.map(s => s.id))
  const tagNames = new Set(doc.tagPalette.map(t => t.name))

  return {
    ...doc,
    roots: [...doc.roots, root],
    stages: [...doc.stages, ...exp.stages.filter(s => !stageIds.has(s.id))],
    tagPalette: [...doc.tagPalette, ...exp.tagPalette.filter(t => !tagNames.has(t.name))],
  }
}

import type { Node, Stage } from '../../types'
import { stageMeta } from '../../theme'

/**
 * A project rendered as Markdown. Pure and deterministic — no DOM, no clock —
 * so the output can be diffed and unit-tested exactly.
 *
 * The shape follows the tree: the project is an H1, each module an H2, and
 * every task a checkbox item nested by depth. Metadata (stage, due, priority,
 * tags) rides on the task line as a bracketed suffix; descriptions become
 * indented blockquotes so they never get mistaken for structure.
 */
export function projectToMarkdown(node: Node, stages: Stage[] = [], stageLabels?: Record<string, string>): string {
  const out: string[] = []

  const meta = (n: Node): string => {
    const bits: string[] = []
    const stage = stageMeta(stages, n.status, stageLabels)
    if (stage.label) bits.push(stage.label)
    if (n.priority) bits.push(`priority: ${n.priority}`)
    if (n.dueDate) bits.push(`due ${n.dueDate}`)
    if (n.tags?.length) bits.push(n.tags.map(t => `#${t.name}`).join(' '))
    return bits.length ? `  _(${bits.join(' · ')})_` : ''
  }

  const quote = (text: string, indent: string) =>
    text.split('\n').map(line => `${indent}> ${line}`.trimEnd()).join('\n')

  out.push(`# ${node.title}`)
  if (node.shortId) out.push(`\`${node.shortId}\``)
  if (node.description) { out.push(''); out.push(quote(node.description, '')) }

  // Tasks below a module nest by two spaces per extra level; `depth` counts
  // from the module, which is why the first task level gets no indent.
  const task = (n: Node, depth: number) => {
    const indent = '  '.repeat(depth)
    const box = n.status === 'done' ? '[x]' : '[ ]'
    out.push(`${indent}- ${box} ${n.title}${meta(n)}`)
    if (n.description) out.push(quote(n.description, `${indent}  `))
    n.children.forEach(c => task(c, depth + 1))
  }

  for (const child of node.children) {
    out.push('')
    if (child.children.length > 0) {
      out.push(`## ${child.title}${meta(child)}`)
      if (child.description) { out.push(''); out.push(quote(child.description, '')) }
      out.push('')
      child.children.forEach(c => task(c, 0))
    } else {
      // A childless node directly under the project is a task, not a module.
      task(child, 0)
    }
  }

  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`
}

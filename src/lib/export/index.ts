import type { Node, StoreDoc } from '../../types'
import { projectToMarkdown } from './markdown'
import { toProjectExport } from './json'
import { renderViewToCanvas, canvasToPng, canvasToJpeg, frameCanvas } from './image'
import { pdfFromJpeg } from './pdf'
import { saveFile, exportName, isoDate } from './save'

export type ExportFormat = 'png' | 'pdf' | 'md' | 'json'

export const EXPORT_FORMATS: { key: ExportFormat; label: string; icon: string; hint: string }[] = [
  { key: 'png', label: 'Image', icon: 'ti-photo', hint: 'A picture of this view' },
  { key: 'pdf', label: 'PDF', icon: 'ti-file-type-pdf', hint: 'This view on one page' },
  { key: 'md', label: 'Markdown', icon: 'ti-markdown', hint: 'The project as text' },
  { key: 'json', label: 'JSON', icon: 'ti-code', hint: 'Re-importable project file' },
]

/**
 * Export the open project. Markdown and JSON describe the *data*, so they are
 * identical whichever view is open; Image and PDF are pictures of the view, so
 * they need the rendered element.
 *
 * Returns false when the user cancels the save dialog, so callers can stay
 * quiet rather than reporting a success that did not happen.
 */
export async function exportView(
  format: ExportFormat,
  node: Node,
  doc: StoreDoc,
  viewEl: HTMLElement | null,
  now: Date = new Date(),
): Promise<boolean> {
  const name = exportName(node.title, now)

  if (format === 'md') {
    return saveFile({
      name,
      ext: 'md',
      data: projectToMarkdown(node, doc.stages, doc.stageLabels, isoDate(now)),
      mime: 'text/markdown',
    })
  }

  if (format === 'json') {
    return saveFile({
      name,
      ext: 'json',
      data: JSON.stringify(toProjectExport(node, doc, now.toISOString()), null, 2),
      mime: 'application/json',
    })
  }

  if (!viewEl) throw new Error('There is nothing on screen to export yet.')
  const { canvas, background } = await renderViewToCanvas(viewEl)
  const page = await frameCanvas(canvas, { title: node.title, date: isoDate(now), background })

  if (format === 'png') {
    return saveFile({ name, ext: 'png', data: await canvasToPng(page), mime: 'image/png' })
  }

  const jpeg = await canvasToJpeg(page, background)
  return saveFile({ name, ext: 'pdf', data: pdfFromJpeg(jpeg, page.width, page.height), mime: 'application/pdf' })
}

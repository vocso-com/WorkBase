import { isTauri } from '../platform'

export interface SaveSpec {
  /** Suggested filename without extension. */
  name: string
  ext: 'json' | 'md' | 'png' | 'pdf'
  data: string | Uint8Array
  mime: string
}

const FILTER: Record<SaveSpec['ext'], string> = {
  json: 'JSON',
  md: 'Markdown',
  png: 'PNG image',
  pdf: 'PDF',
}

/**
 * Write a file wherever the platform puts files: a native save dialog under
 * Tauri, a browser download otherwise. Returns false when the user cancels the
 * native dialog, so callers can stay quiet instead of reporting success.
 */
export async function saveFile(spec: SaveSpec): Promise<boolean> {
  const filename = `${spec.name}.${spec.ext}`

  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const fs = await import('@tauri-apps/plugin-fs')
    const path = await save({
      defaultPath: filename,
      filters: [{ name: FILTER[spec.ext], extensions: [spec.ext] }],
    })
    if (!path) return false
    if (typeof spec.data === 'string') await fs.writeTextFile(path, spec.data)
    else await fs.writeFile(path, spec.data)
    return true
  }

  // `spec.data` may be a view onto a larger buffer, so slice to its own bytes
  // before handing it to Blob.
  const part = typeof spec.data === 'string'
    ? spec.data
    : spec.data.slice().buffer as ArrayBuffer
  const url = URL.createObjectURL(new Blob([part], { type: spec.mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return true
}

/** A filesystem-safe stem for a project's title, e.g. "Website Rebuild" → "website-rebuild". */
export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || 'project'
}

/** `<slug>-YYYY-MM-DD`, the naming every export uses. */
export function exportName(title: string, at: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
  return `${slugify(title)}-${date}`
}

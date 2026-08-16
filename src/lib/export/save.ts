import { isTauri } from '../platform'

export interface SaveSpec {
  /** Suggested filename without extension. */
  name: string
  ext: 'json' | 'md' | 'png' | 'pdf' | 'csv'
  data: string | Uint8Array
  mime: string
}

const FILTER: Record<SaveSpec['ext'], string> = {
  json: 'JSON',
  md: 'Markdown',
  png: 'PNG image',
  pdf: 'PDF',
  csv: 'CSV spreadsheet',
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

/** Read a file the user picks. Resolves to null if they cancel. */
export async function openTextFile(): Promise<string | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    const path = await open({ multiple: false, directory: false, filters: [{ name: 'WorkBase data', extensions: ['json', 'csv'] }] })
    if (!path || Array.isArray(path)) return null
    return readTextFile(path)
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.csv,application/json,text/csv'
    // A cancelled picker fires no event at all in most browsers, so the promise
    // simply never settles — the caller shows no spinner, so nothing hangs.
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }
      file.text().then(resolve, reject)
    }
    input.click()
  })
}

export const BRAND = 'WorkBase'

/** yyyy-mm-dd in the user's own timezone, not UTC. */
export function isoDate(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

/**
 * `workbase-<slug>-YYYY-MM-DD`, the naming every export uses. The brand leads
 * so that a folder of exports from several tools still sorts and reads clearly.
 */
export function exportName(title: string, at: Date): string {
  return `${BRAND.toLowerCase()}-${slugify(title)}-${isoDate(at)}`
}

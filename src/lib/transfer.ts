import type { StoreDoc } from '../types'
import { deserialize, serialize } from './serialize'

const isTauri = () => '__TAURI_INTERNALS__' in window

export const parseImport = (text: string): StoreDoc => deserialize(text)

export async function exportDoc(doc: StoreDoc): Promise<void> {
  const text = serialize(doc)

  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    const path = await save({
      defaultPath: 'manage-export.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!path) return
    await writeTextFile(path, text)
    return
  }

  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'manage-export.json'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function importDoc(): Promise<StoreDoc | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!path || Array.isArray(path)) return null
    const text = await readTextFile(path)
    return parseImport(text)
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }
      const reader = new FileReader()
      reader.onload = () => {
        try {
          resolve(parseImport(String(reader.result)))
        } catch (e) {
          reject(e)
        }
      }
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
      reader.readAsText(file)
    }
    input.click()
  })
}

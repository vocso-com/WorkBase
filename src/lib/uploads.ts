// Image / attachment uploads. When a Cloudflare R2 endpoint is configured the
// file is uploaded to the Worker (which stores it in R2 and returns a public
// URL); otherwise it falls back to an inline data-URL so the app stays
// local-first and works with zero backend.

const CFG_KEY = 'manage.cloud'

export interface CloudConfig {
  endpoint: string
  token: string
}

export function getCloud(): CloudConfig | null {
  try {
    const raw = localStorage.getItem(CFG_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as Partial<CloudConfig>
    return c.endpoint && c.token ? { endpoint: c.endpoint, token: c.token } : null
  } catch {
    return null
  }
}

export function setCloud(c: CloudConfig | null): void {
  if (!c || !c.endpoint.trim()) localStorage.removeItem(CFG_KEY)
  else localStorage.setItem(CFG_KEY, JSON.stringify({ endpoint: c.endpoint.trim(), token: c.token.trim() }))
}

export function cloudEnabled(): boolean {
  return getCloud() !== null
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('Could not read file'))
    r.readAsDataURL(file)
  })
}

/** Upload a file, returning a URL (remote) or data-URL (local fallback). */
export async function uploadFile(file: File): Promise<string> {
  const cfg = getCloud()
  if (!cfg) return toDataUrl(file)

  const base = cfg.endpoint.replace(/\/$/, '')
  const res = await fetch(`${base}/upload?name=${encodeURIComponent(file.name)}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${cfg.token}`, 'content-type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!res.ok) throw new Error(`Upload failed (${res.status})`)
  const { url } = (await res.json()) as { url: string }
  return url
}

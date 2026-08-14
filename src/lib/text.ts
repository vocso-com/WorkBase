// Description is stored as rich-text HTML. Preview surfaces (project card,
// header) want a flat one-line version, so strip tags to plain text.
export function toText(html: string | undefined): string {
  if (!html) return ''
  if (!html.includes('<')) return html
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const el = document.createElement('div')
  el.innerHTML = html
  return (el.textContent || '').replace(/\s+/g, ' ').trim()
}

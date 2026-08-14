// Turn bare URLs into clickable links that open in a new tab. Two entry points:
// linkifyHtml for already-HTML content (description), linkifyText for plain
// text (comments). Existing <a> elements are left untouched.

const URL_RE = /https?:\/\/[^\s<]+[^\s<.,;:!?)"']/g

function linkifyNode(root: Node) {
  root.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.nodeValue ?? ''
      if (!/https?:\/\//.test(text)) return
      const frag = document.createDocumentFragment()
      let last = 0
      URL_RE.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = URL_RE.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)))
        const a = document.createElement('a')
        a.href = m[0]
        a.textContent = m[0]
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        frag.appendChild(a)
        last = m.index + m[0].length
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)))
      child.parentNode?.replaceChild(frag, child)
    } else if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName !== 'A') {
      linkifyNode(child)
    }
  })
}

export function linkifyHtml(html: string): string {
  if (typeof document === 'undefined') return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  linkifyNode(doc.body)
  return doc.body.innerHTML
}

export function linkifyText(text: string): string {
  if (typeof document === 'undefined') return text
  const div = document.createElement('div')
  div.textContent = text // escapes HTML
  linkifyNode(div)
  return div.innerHTML
}

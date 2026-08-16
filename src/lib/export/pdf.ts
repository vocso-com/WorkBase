const enc = new TextEncoder()

/** Largest page dimension in points. Keeps a wide Flow canvas from producing an absurd page. */
const MAX_PT = 1400

/**
 * A one-page PDF wrapping a single JPEG.
 *
 * JPEG rather than PNG because PDF can carry JPEG bytes verbatim through the
 * /DCTDecode filter — a PNG would have to be decoded and re-encoded, with its
 * alpha split out into a separate soft mask. That is a lot of machinery for a
 * picture of a board, so the exporter flattens onto an opaque background first
 * and hands the result here.
 *
 * The tradeoff: the text in the page is a picture, not selectable. That is the
 * right call for "hand someone what I'm looking at"; a text-native PDF built
 * from the Markdown would be a separate export, not a replacement.
 */
export function pdfFromJpeg(jpeg: Uint8Array, pxW: number, pxH: number): Uint8Array {
  const scale = Math.min(1, MAX_PT / Math.max(pxW, pxH))
  const w = Math.max(1, Math.round(pxW * scale))
  const h = Math.max(1, Math.round(pxH * scale))

  const chunks: Uint8Array[] = []
  const offsets: number[] = []
  let len = 0

  const push = (data: Uint8Array | string) => {
    const b = typeof data === 'string' ? enc.encode(data) : data
    chunks.push(b)
    len += b.length
  }
  const obj = (n: number, dict: string, stream?: Uint8Array) => {
    offsets[n] = len
    push(`${n} 0 obj\n${dict}\n`)
    if (stream) {
      push('stream\n')
      push(stream)
      push('\nendstream\n')
    }
    push('endobj\n')
  }

  push('%PDF-1.4\n')
  // Binary marker: tells tools the file is not plain text.
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))

  const content = enc.encode(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`)

  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] ` +
    '/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>')
  obj(4, '<< /Type /XObject /Subtype /Image ' +
    `/Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 ` +
    `/Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg)
  obj(5, `<< /Length ${content.length} >>`, content)

  const count = 6 // objects 0..5
  const xref = len
  const pad = (n: number, width: number) => String(n).padStart(width, '0')
  let table = `xref\n0 ${count}\n0000000000 65535 f \n`
  for (let i = 1; i < count; i++) table += `${pad(offsets[i], 10)} ${pad(0, 5)} n \n`
  push(table)
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)

  const out = new Uint8Array(len)
  let at = 0
  for (const c of chunks) { out.set(c, at); at += c.length }
  return out
}

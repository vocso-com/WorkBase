import { pdfFromJpeg } from './pdf'

const text = (b: Uint8Array) => new TextDecoder('latin1').decode(b)
// Not a real image — the writer treats the payload as opaque bytes.
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9])

test('starts with the PDF header and ends with the EOF marker', () => {
  const s = text(pdfFromJpeg(jpeg, 100, 50))
  expect(s.startsWith('%PDF-1.4')).toBe(true)
  expect(s.trimEnd().endsWith('%%EOF')).toBe(true)
})

test('carries the JPEG verbatim through a DCTDecode image object', () => {
  const out = pdfFromJpeg(jpeg, 100, 50)
  const s = text(out)
  expect(s).toContain('/Filter /DCTDecode')
  expect(s).toContain(`/Length ${jpeg.length}`)
  expect(s).toContain('/Width 100 /Height 50')
  // The payload survives byte for byte.
  const at = s.indexOf('stream\n', s.indexOf('/DCTDecode')) + 'stream\n'.length
  expect([...out.slice(at, at + jpeg.length)]).toEqual([...jpeg])
})

test('declares one page and draws the image onto it', () => {
  const s = text(pdfFromJpeg(jpeg, 100, 50))
  expect(s).toContain('/Type /Pages /Kids [3 0 R] /Count 1')
  expect(s).toContain('/MediaBox [0 0 100 50]')
  expect(s).toContain('/Im0 Do')
})

test('the page keeps the image aspect ratio', () => {
  const s = text(pdfFromJpeg(jpeg, 800, 400))
  expect(s).toContain('/MediaBox [0 0 800 400]')
})

test('an oversized canvas is scaled down rather than producing an absurd page', () => {
  const s = text(pdfFromJpeg(jpeg, 5600, 2800))
  expect(s).toContain('/MediaBox [0 0 1400 700]')
})

test('the xref table has one 20-byte entry per object and points at the right offsets', () => {
  const out = pdfFromJpeg(jpeg, 100, 50)
  const s = text(out)
  // Search for the table itself — "startxref" also ends in "xref".
  const xrefAt = s.indexOf('xref\n0 6\n')
  expect(xrefAt).toBeGreaterThan(0)

  // startxref must name the byte offset the table actually starts at.
  const declared = Number(s.slice(s.lastIndexOf('startxref\n') + 'startxref\n'.length).split('\n')[0])
  expect(declared).toBe(xrefAt)

  const rows = s.slice(xrefAt + 'xref\n0 6\n'.length).split('\n').slice(0, 6)
  expect(rows[0]).toBe('0000000000 65535 f ')
  for (let i = 1; i < 6; i++) {
    expect(rows[i]).toHaveLength(19) // 20 bytes including the newline
    // Each offset must land on that object's own "N 0 obj" header.
    const off = Number(rows[i].slice(0, 10))
    expect(s.slice(off, off + 8)).toContain(`${i} 0 obj`)
  }
})

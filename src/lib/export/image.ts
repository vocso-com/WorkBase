import { toSvg, getFontEmbedCSS } from 'html-to-image'
import { BRAND } from './save'

/**
 * The icon font has to be inlined or every icon rasterizes as a tofu box, but
 * collecting it means walking several thousand CSS rules and base64-ing the
 * font file. That is done once per session and reused; without the cache each
 * export repeats the whole walk.
 */
let fontCss: Promise<string> | null = null
function embeddedFonts(el: HTMLElement): Promise<string> {
  if (!fontCss) fontCss = getFontEmbedCSS(el).catch(() => '')
  return fontCss
}

/**
 * Draw a serialized SVG onto a canvas.
 *
 * This replaces html-to-image's own `toCanvas`, whose final image step hung
 * indefinitely on this app's views — no load, no error, nothing on the network
 * — leaving the export spinning forever. Plain `onload` on the same payload
 * completes in about a second.
 *
 * The source stays a `data:` URL rather than a blob URL on purpose: Chrome
 * gives an SVG loaded from `blob:` an opaque origin, which taints the canvas
 * and makes `toBlob` throw. Data URLs are same-origin, and this one loads fine
 * at ~2MB.
 */
function rasterize(svgDataUrl: string, width: number, height: number, background: string): Promise<HTMLCanvasElement> {
  return new Promise<HTMLCanvasElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(width * PIXEL_RATIO))
      canvas.height = Math.max(1, Math.round(height * PIXEL_RATIO))
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Could not prepare the image.')); return }
      ctx.fillStyle = background
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas)
    }
    img.onerror = () => reject(new Error('Could not render this view to an image.'))
    img.src = svgDataUrl
  })
}

/** Turn a hang into a message. A stuck rasterizer must not leave a spinner running forever. */
function withTimeout<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    work.then(
      v => { clearTimeout(timer); resolve(v) },
      e => { clearTimeout(timer); reject(e) },
    )
  })
}

/**
 * What to rasterize for a given view, and how big it really is.
 *
 * The important subtlety: export the whole content, not the visible region.
 * Flow is pan/zoomed and clipped by its viewport, and the other views scroll —
 * capturing the element as it sits on screen would crop whatever is off-screen.
 */
interface Target {
  el: HTMLElement
  width: number
  height: number
  background: string
  /** Undo any temporary style changes made to capture at natural size. */
  restore: () => void
}

const bgOf = (el: Element): string => {
  const c = getComputedStyle(el).backgroundColor
  return c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent' ? c : '#ffffff'
}

function targetFor(view: HTMLElement): Target {
  const canvas = view.querySelector<HTMLElement>('.fcanvas')
  if (canvas) {
    // Flow: the canvas element is already sized to the full layout. Drop the
    // pan/zoom transform for the capture so it renders at 1:1.
    const vp = canvas.parentElement ?? view
    const prev = canvas.style.transform
    canvas.style.transform = 'none'
    return {
      el: canvas,
      width: canvas.offsetWidth,
      height: canvas.offsetHeight,
      background: bgOf(vp),
      restore: () => { canvas.style.transform = prev },
    }
  }
  // Board / Kanban / Outline: capture the full scroll extent.
  return {
    el: view,
    width: Math.max(view.scrollWidth, view.offsetWidth),
    height: Math.max(view.scrollHeight, view.offsetHeight),
    background: bgOf(view),
    restore: () => {},
  }
}

/** Device pixels per CSS pixel in an export. Framing works in device pixels. */
export const PIXEL_RATIO = 2

/**
 * Rasterize a view at 2x for a crisp result. The view's own background comes
 * back with it so the framing can extend the same surface into the margin.
 */
export async function renderViewToCanvas(view: HTMLElement): Promise<{ canvas: HTMLCanvasElement; background: string }> {
  const t = targetFor(view)
  try {
    const fontEmbedCSS = await withTimeout(
      embeddedFonts(t.el),
      15000,
      'Preparing fonts for the export took too long.',
    )
    const svg = await withTimeout(
      toSvg(t.el, {
        width: t.width,
        height: t.height,
        fontEmbedCSS,
        // The element may carry a transform or margin from its normal layout;
        // pin it to the origin so nothing is cropped.
        style: { transform: 'none', transformOrigin: 'top left', margin: '0' },
      }),
      30000,
      'Rendering this view took too long. Try collapsing some branches first.',
    )
    const canvas = await withTimeout(
      rasterize(svg, t.width, t.height, t.background),
      30000,
      'Rendering this view took too long. Try collapsing some branches first.',
    )
    return { canvas, background: t.background }
  } finally {
    t.restore()
  }
}

/** Rough perceived brightness of a CSS color, for picking legible ink over it. */
function isDark(color: string): boolean {
  const m = color.match(/\d+(\.\d+)?/g)
  if (!m || m.length < 3) return false
  const [r, g, b] = m.map(Number)
  return (r * 299 + g * 587 + b * 114) / 1000 < 140
}

const LOGO_SRC = '/workbase-logo.png'
let logo: Promise<HTMLImageElement | null> | null = null

/** The product mark, loaded once and reused. Resolves to null if unavailable — branding must never fail an export. */
function loadLogo(): Promise<HTMLImageElement | null> {
  if (!logo) {
    logo = new Promise(resolve => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = LOGO_SRC
    })
  }
  return logo
}

/**
 * Put the rendered view on a padded page under a header band: the project and
 * date top-left, the product mark top-right. The margin stops the outermost
 * cards butting against the edge, and the header means an exported picture
 * still says what it is and where it came from once it has been pasted into a
 * deck or a thread.
 */
export async function frameCanvas(
  src: HTMLCanvasElement,
  opts: { title: string; date: string; background: string },
): Promise<HTMLCanvasElement> {
  const r = PIXEL_RATIO
  const padX = 40 * r
  const header = 56 * r
  const padBottom = 40 * r

  const out = document.createElement('canvas')
  out.width = src.width + padX * 2
  out.height = header + src.height + padBottom

  const ctx = out.getContext('2d')
  if (!ctx) return src
  ctx.fillStyle = opts.background
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(src, padX, header)

  const dark = isDark(opts.background)
  const mid = header * 0.5
  const font = (weight: number, px: number) =>
    `${weight} ${px * r}px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = font(700, 15)
  ctx.fillStyle = dark ? 'rgba(255,255,255,.92)' : 'rgba(17,24,39,.88)'
  ctx.fillText(opts.title, padX, mid)

  const titleW = ctx.measureText(opts.title).width
  ctx.font = font(500, 12.5)
  ctx.fillStyle = dark ? 'rgba(255,255,255,.55)' : 'rgba(17,24,39,.5)'
  ctx.fillText(opts.date, padX + titleW + 10 * r, mid + 1 * r)

  // Mark then wordmark, laid out from the right edge inwards.
  const mark = await loadLogo()
  const label = BRAND
  ctx.font = font(700, 14)
  ctx.fillStyle = dark ? 'rgba(255,255,255,.86)' : 'rgba(17,24,39,.78)'

  const size = 20 * r
  const gap = 8 * r
  const ratio = mark && mark.width && mark.height ? mark.width / mark.height : 1
  const markW = mark ? size * ratio : 0
  const groupW = (mark ? markW + gap : 0) + ctx.measureText(label).width
  const left = out.width - padX - groupW
  if (mark) ctx.drawImage(mark, left, mid - size / 2, markW, size)
  ctx.fillText(label, left + (mark ? markW + gap : 0), mid)

  return out
}

function blobBytes(blob: Blob): Promise<Uint8Array> {
  return blob.arrayBuffer().then(b => new Uint8Array(b))
}

function encode(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blobBytes(blob)) : reject(new Error('Could not encode the image.'))),
      type,
      quality,
    )
  })
}

export const canvasToPng = (canvas: HTMLCanvasElement): Promise<Uint8Array> => encode(canvas, 'image/png')

/**
 * JPEG for the PDF path. Flattened onto white first: JPEG has no alpha, and
 * without this any transparent pixel would come out black.
 */
export function canvasToJpeg(canvas: HTMLCanvasElement, background = '#ffffff'): Promise<Uint8Array> {
  const flat = document.createElement('canvas')
  flat.width = canvas.width
  flat.height = canvas.height
  const ctx = flat.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Could not prepare the image.'))
  ctx.fillStyle = background
  ctx.fillRect(0, 0, flat.width, flat.height)
  ctx.drawImage(canvas, 0, 0)
  return encode(flat, 'image/jpeg', 0.92)
}

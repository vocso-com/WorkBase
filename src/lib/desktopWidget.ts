import { isTauri } from './platform'

const LABEL = 'widget'

/**
 * From the MAIN window: make sure the always-on-top reminder widget window
 * exists. It loads the same app at #/~widget, which renders only the widget
 * and manages its own position/visibility. No-op outside Tauri.
 */
export async function ensureWidgetWindow(): Promise<void> {
  if (!isTauri()) return
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const existing = await WebviewWindow.getByLabel(LABEL)
    if (existing) return
    new WebviewWindow(LABEL, {
      url: 'index.html#/~widget',
      title: 'WorkBase Reminders',
      width: 360,
      height: 460,
      resizable: false,
      decorations: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      visible: false,
      focus: false,
      shadow: true,
    })
  } catch (e) {
    console.error('WorkBase: could not create reminder widget window', e)
  }
}

/**
 * From the WIDGET window: dock bottom-right on the current monitor and keep it
 * pinned above everything.
 */
export async function positionWidget(): Promise<void> {
  if (!isTauri()) return
  try {
    const { getCurrentWindow, currentMonitor } = await import('@tauri-apps/api/window')
    const { PhysicalPosition } = await import('@tauri-apps/api/dpi')
    const win = getCurrentWindow()
    await win.setAlwaysOnTop(true)
    const mon = await currentMonitor()
    if (!mon) return
    const size = await win.outerSize()
    const margin = Math.round(18 * mon.scaleFactor)
    const x = mon.position.x + mon.size.width - size.width - margin
    const y = mon.position.y + mon.size.height - size.height - margin
    await win.setPosition(new PhysicalPosition(Math.round(x), Math.round(y)))
  } catch (e) {
    console.error('WorkBase: could not position widget', e)
  }
}

/**
 * From the WIDGET window: resize the native window to match the card's content
 * (so a transparent window shows only the rounded card, and collapsing/expanding
 * shrinks/grows it), then re-dock bottom-right.
 */
export async function fitWidget(w: number, h: number): Promise<void> {
  if (!isTauri()) return
  try {
    const { getCurrentWindow, currentMonitor } = await import('@tauri-apps/api/window')
    const { LogicalSize, PhysicalPosition } = await import('@tauri-apps/api/dpi')
    const win = getCurrentWindow()
    await win.setSize(new LogicalSize(w, h))
    const mon = await currentMonitor()
    if (!mon) return
    const size = await win.outerSize()
    const margin = Math.round(18 * mon.scaleFactor)
    const x = mon.position.x + mon.size.width - size.width - margin
    const y = mon.position.y + mon.size.height - size.height - margin
    await win.setPosition(new PhysicalPosition(Math.round(x), Math.round(y)))
  } catch (e) {
    console.error('WorkBase: could not fit widget', e)
  }
}

export const QUICK_ADD_EVENT = 'workbase://quick-add'
export const TOGGLE_DONE_EVENT = 'workbase://toggle-done'
export const SNOOZE_EVENT = 'workbase://snooze'

/**
 * From the WIDGET window: ask the main window (the single writer) to apply a
 * change to the document, so the widget never writes the shared file itself.
 */
export async function commitToMain(event: string, payload: unknown): Promise<void> {
  if (!isTauri()) return
  try {
    const { emit } = await import('@tauri-apps/api/event')
    await emit(event, payload)
  } catch (e) {
    console.error('WorkBase: could not sync change to main window', e)
  }
}

/**
 * From the WIDGET window: bring the main window forward and ask it to open the
 * quick-add flow (windows have separate JS contexts, so we hand off via a
 * Tauri event the main window listens for).
 */
export async function quickAddFromWidget(): Promise<void> {
  if (!isTauri()) return
  try {
    await focusMain()
    const { emit } = await import('@tauri-apps/api/event')
    await emit(QUICK_ADD_EVENT)
  } catch (e) {
    console.error('WorkBase: could not trigger quick add', e)
  }
}

/** Ambient dock/taskbar badge with the overdue + due-today count (0 clears it). */
export async function setDockBadge(count: number): Promise<void> {
  if (!isTauri()) return
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().setBadgeCount(count > 0 ? count : undefined)
  } catch (e) {
    console.error('WorkBase: could not set dock badge', e)
  }
}

/** From the MAIN window: reveal the reminder widget (used by the in-app toggle). */
export async function showWidgetFromMain(): Promise<void> {
  if (!isTauri()) return
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const w = await WebviewWindow.getByLabel(LABEL)
    if (w) { await w.show(); await w.setFocus() }
  } catch (e) {
    console.error('WorkBase: could not show widget', e)
  }
}

/** From the widget: bring the main WorkBase window forward. */
export async function focusMain(): Promise<void> {
  if (!isTauri()) return
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const main = await WebviewWindow.getByLabel('main')
    if (main) { await main.show(); await main.setFocus() }
  } catch (e) {
    console.error('WorkBase: could not focus main window', e)
  }
}

/** Show or hide the widget window (the widget hides itself when there's nothing to show). */
export async function setWidgetVisible(visible: boolean): Promise<void> {
  if (!isTauri()) return
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const win = getCurrentWindow()
    if (visible) { await win.show() } else { await win.hide() }
  } catch (e) {
    console.error('WorkBase: could not toggle widget visibility', e)
  }
}

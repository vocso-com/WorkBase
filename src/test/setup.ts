import '@testing-library/jest-dom/vitest'

// jsdom does not implement matchMedia; polyfill it so code relying on
// `prefers-color-scheme` (see src/lib/colorMode.ts) can run under tests.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

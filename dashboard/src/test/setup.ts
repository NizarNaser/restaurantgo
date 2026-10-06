import '@testing-library/jest-dom/vitest';
// Initializes the admin dashboard's i18next instance (see ../i18n/index.ts) —
// without this, no test file ever imports it (only main.tsx/App.tsx do, and
// unit tests render a page component directly), so useTranslation()'s t()
// falls back to returning the raw key instead of the translated string in
// every test, passing only for assertions that happen not to check any
// translated text.
import '../i18n';

// jsdom has no ResizeObserver, but recharts' ResponsiveContainer needs one to render.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

// jsdom doesn't implement the Blob URL APIs used for triggering file downloads.
if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = () => 'blob:mock';
}
if (!window.URL.revokeObjectURL) {
  window.URL.revokeObjectURL = () => {};
}

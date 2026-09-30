import '@testing-library/jest-dom/vitest';

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

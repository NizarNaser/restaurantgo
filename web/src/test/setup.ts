import '@testing-library/jest-dom/vitest';
import '../i18n';

// jsdom has no IntersectionObserver, but motion's `whileInView` needs one to mount.
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
globalThis.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver;

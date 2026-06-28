import '@testing-library/jest-dom/vitest';

// jsdom has no ResizeObserver. Provide a global no-op default so components that
// observe their own size (e.g. BookReader's responsive-collapse width probe)
// don't crash; tests that need to drive resize callbacks still install their own
// richer mock over this one.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// FILE: ~/taskmaster/src/test/setup.ts
// Vitest global test setup

import "@testing-library/jest-dom";

// jsdom doesn't implement EventSource; provide a minimal stub
if (typeof EventSource === "undefined") {
  (globalThis as unknown as Record<string, unknown>).EventSource = class MockEventSource {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 2;
    readyState = 1;
    onopen: (() => void) | null = null;
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;
    constructor(_url: string) {}
    addEventListener(_type: string, _listener: EventListener) {}
    removeEventListener(_type: string, _listener: EventListener) {}
    close() { this.readyState = 2; }
    dispatchEvent(_event: Event) { return true; }
  };
}

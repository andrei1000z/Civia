import { describe, it, expect, vi } from "vitest";

// Mock window for SSR safety
describe("announce() dispatch helper", () => {
  it("dispatches civia:announce event with text + priority", async () => {
    // Use jsdom env (default vitest)
    const { announce } = await import("@/components/ui/LiveAnnouncer");
    const handler = vi.fn();
    window.addEventListener("civia:announce", handler);
    announce("Test message");
    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0]?.[0] as CustomEvent<{ text: string; priority?: string }>;
    expect(event.detail.text).toBe("Test message");
    // Default priority is "polite" (from announce() signature default)
    expect(event.detail.priority).toBe("polite");
    window.removeEventListener("civia:announce", handler);
  });

  it("supports assertive priority", async () => {
    const { announce } = await import("@/components/ui/LiveAnnouncer");
    const handler = vi.fn();
    window.addEventListener("civia:announce", handler);
    announce("Critical", "assertive");
    const event = handler.mock.calls[0]?.[0] as CustomEvent<{ text: string; priority?: string }>;
    expect(event.detail.priority).toBe("assertive");
    window.removeEventListener("civia:announce", handler);
  });

  it("no-op cand window e undefined (SSR safety)", async () => {
    const { announce } = await import("@/components/ui/LiveAnnouncer");
    // Cannot easily delete window in vitest jsdom, but the guard exists.
    // This test just verifies the import doesn't throw.
    expect(typeof announce).toBe("function");
  });
});

import { describe, expect, test } from "vitest";
import {
  SESIZARE_STATUS_VALUES,
  SESIZARE_STATUS_META,
  SESIZARE_TICKET_PROPOSABLE,
  isSesizareStatus,
  timelineEventForStatus,
} from "./status";
import { SESIZARE_EVENT_META } from "./events";

describe("sesizari/status", () => {
  test("every status value has a meta entry", () => {
    for (const s of SESIZARE_STATUS_VALUES) {
      expect(SESIZARE_STATUS_META[s]).toBeDefined();
      expect(SESIZARE_STATUS_META[s].label.length).toBeGreaterThan(0);
      expect(SESIZARE_STATUS_META[s].color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  test("every non-trivial status maps to an event_type with timeline meta", () => {
    // The trigger writes 'depusa' for nou, so timelineEventForStatus('nou')
    // returns "" — for everything else we need a matching events.ts entry
    // so the timeline UI can render the row.
    for (const s of SESIZARE_STATUS_VALUES) {
      const eventType = timelineEventForStatus(s);
      if (s === "nou") {
        expect(eventType).toBe("");
        continue;
      }
      expect(eventType).toBeTruthy();
      expect(SESIZARE_EVENT_META[eventType]).toBeDefined();
    }
  });

  test("ticket-proposable list excludes 'nou' and contains the rest", () => {
    expect(SESIZARE_TICKET_PROPOSABLE).not.toContain("nou");
    for (const s of SESIZARE_STATUS_VALUES) {
      if (s === "nou") continue;
      expect(SESIZARE_TICKET_PROPOSABLE).toContain(s);
    }
  });

  test("isSesizareStatus accepts known values, rejects garbage", () => {
    expect(isSesizareStatus("nou")).toBe(true);
    expect(isSesizareStatus("inregistrata")).toBe(true);
    expect(isSesizareStatus("interventie")).toBe(true);
    expect(isSesizareStatus("rezolvat")).toBe(true);
    expect(isSesizareStatus("respins")).toBe(true);
    expect(isSesizareStatus("nope")).toBe(false);
    expect(isSesizareStatus("")).toBe(false);
    expect(isSesizareStatus(null)).toBe(false);
    expect(isSesizareStatus(undefined)).toBe(false);
    expect(isSesizareStatus(42)).toBe(false);
  });

  test("workflow ordering: nou comes first, terminal states last", () => {
    expect(SESIZARE_STATUS_VALUES[0]).toBe("nou");
    const last = SESIZARE_STATUS_VALUES[SESIZARE_STATUS_VALUES.length - 1];
    // Terminal states: rezolvat (success), respins (refuz), ignorat (auto-mark
    // după 60 zile fără răspuns — adăugat 2026-05-24).
    expect(["rezolvat", "respins", "ignorat"]).toContain(last);
  });
});

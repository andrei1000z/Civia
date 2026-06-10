import { describe, it, expect } from "vitest";
import { SESIZARE_STATUS_VALUES, timelineEventForStatus } from "./status";
import { SESIZARE_EVENT_META } from "./events";

// Regression-guard pentru driftul găsit de auditul de statusuri (2026-06-10):
// statusuri/event_type-uri scrise de cod dar fără intrare în catalog (cădeau pe
// „Eveniment" generic, ex: cosign_send). AGENTS.md: orice event_type nou se
// adaugă în SESIZARE_EVENT_META ÎNTÂI.
describe("consistență status ↔ catalog evenimente", () => {
  it("fiecare status (≠ nou) mapează la un event_type prezent în catalog", () => {
    for (const status of SESIZARE_STATUS_VALUES) {
      const ev = timelineEventForStatus(status);
      if (status === "nou") {
        expect(ev).toBe(""); // nou nu scrie event (depusa vine din trigger la INSERT)
        continue;
      }
      expect(ev, `status "${status}" ar trebui să mapeze la un event_type`).not.toBe("");
      expect(
        SESIZARE_EVENT_META[ev],
        `event_type "${ev}" (pentru status "${status}") lipsește din SESIZARE_EVENT_META`,
      ).toBeDefined();
    }
  });

  it("event_type-urile scrise direct de fluxuri sunt în catalog", () => {
    for (const ev of ["depusa", "trimis_via_civia", "cosign_send", "cosemnat", "escaladat_avp", "ignorat"]) {
      expect(SESIZARE_EVENT_META[ev], `"${ev}" lipsește din catalog`).toBeDefined();
    }
  });
});

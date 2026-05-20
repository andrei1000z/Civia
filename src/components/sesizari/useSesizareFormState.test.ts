import { describe, it, expect } from "vitest";
import {
  INITIAL_FORM_STATE,
  sesizareFormReducer,
} from "./useSesizareFormState";

describe("sesizareFormReducer", () => {
  it("SUBMIT_START sets submitting and clears error", () => {
    const start = { ...INITIAL_FORM_STATE, error: "previous error" };
    const next = sesizareFormReducer(start, { type: "SUBMIT_START" });
    expect(next.submitting).toBe(true);
    expect(next.error).toBeNull();
  });

  it("SUBMIT_SUCCESS captures the new code and clears submitting", () => {
    const start = { ...INITIAL_FORM_STATE, submitting: true };
    const next = sesizareFormReducer(start, { type: "SUBMIT_SUCCESS", code: "AB12" });
    expect(next.submitting).toBe(false);
    expect(next.submitted).toEqual({ code: "AB12" });
    expect(next.error).toBeNull();
  });

  it("SUBMIT_ERROR sets error and clears submitting", () => {
    const start = { ...INITIAL_FORM_STATE, submitting: true };
    const next = sesizareFormReducer(start, { type: "SUBMIT_ERROR", error: "oops" });
    expect(next.submitting).toBe(false);
    expect(next.error).toBe("oops");
  });

  it("CLEAR_ERROR is a no-op when error is already null (referential equality preserved)", () => {
    const start = INITIAL_FORM_STATE;
    const next = sesizareFormReducer(start, { type: "CLEAR_ERROR" });
    expect(next).toBe(start);
  });

  it("AI_START / AI_DONE toggle aiLoading", () => {
    const a = sesizareFormReducer(INITIAL_FORM_STATE, { type: "AI_START" });
    expect(a.aiLoading).toBe(true);
    const b = sesizareFormReducer(a, { type: "AI_DONE" });
    expect(b.aiLoading).toBe(false);
  });

  it("GEO_DONE preserves accuracy when not passed", () => {
    const a = sesizareFormReducer(
      { ...INITIAL_FORM_STATE, gpsAccuracy: 42 },
      { type: "GEO_DONE" },
    );
    expect(a.gpsAccuracy).toBe(42);
    const b = sesizareFormReducer(a, { type: "GEO_DONE", accuracy: 7 });
    expect(b.gpsAccuracy).toBe(7);
  });

  it("SET_DETECTED_COUNTY updates both id and name in one tick", () => {
    const next = sesizareFormReducer(INITIAL_FORM_STATE, {
      type: "SET_DETECTED_COUNTY",
      id: "CJ",
      name: "Cluj",
    });
    expect(next.detectedCounty).toBe("CJ");
    expect(next.detectedCountyName).toBe("Cluj");
  });

  it("SET_PARKING_SLOTS replaces the whole slots object", () => {
    const next = sesizareFormReducer(INITIAL_FORM_STATE, {
      type: "SET_PARKING_SLOTS",
      slots: { plate: "B 123 ABC", vehicle: "VW Golf", context: "Pe trotuar" },
    });
    expect(next.parkingSlots.plate).toBe("B 123 ABC");
  });

  it("DRAFT_DISMISSED is sticky", () => {
    const a = sesizareFormReducer(INITIAL_FORM_STATE, { type: "DRAFT_DISMISSED" });
    expect(a.draftDismissed).toBe(true);
    const b = sesizareFormReducer(a, { type: "SUBMIT_START" });
    expect(b.draftDismissed).toBe(true);
  });
});

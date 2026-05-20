import { describe, it, expect } from "vitest";
import { CIVIC_QUIZ, QUIZ_QUESTIONS_PER_ROUND, PASSING_SCORE } from "./civic-quiz";

describe("CIVIC_QUIZ", () => {
  it("contine cel putin 15 intrebari", () => {
    expect(CIVIC_QUIZ.length).toBeGreaterThanOrEqual(15);
  });

  it("toate intrebarile au id unic", () => {
    const ids = CIVIC_QUIZ.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("fiecare intrebare are 4 raspunsuri", () => {
    for (const q of CIVIC_QUIZ) {
      expect(q.answers.length).toBe(4);
    }
  });

  it("fiecare intrebare are EXACT un raspuns corect", () => {
    for (const q of CIVIC_QUIZ) {
      const correctCount = q.answers.filter((a) => a.correct === true).length;
      expect(correctCount, `Intrebarea ${q.id}`).toBe(1);
    }
  });

  it("fiecare intrebare are explicatie min 30 chars", () => {
    for (const q of CIVIC_QUIZ) {
      expect(q.explanation.length, `Intrebarea ${q.id}`).toBeGreaterThanOrEqual(30);
    }
  });

  it("toate intrebarile au topic valid", () => {
    const validTopics = ["petitii", "info-publice", "gdpr", "dezbatere", "constitutie"];
    for (const q of CIVIC_QUIZ) {
      expect(validTopics).toContain(q.topic);
    }
  });

  it("QUIZ_QUESTIONS_PER_ROUND <= CIVIC_QUIZ.length", () => {
    expect(QUIZ_QUESTIONS_PER_ROUND).toBeLessThanOrEqual(CIVIC_QUIZ.length);
  });

  it("PASSING_SCORE < QUIZ_QUESTIONS_PER_ROUND", () => {
    expect(PASSING_SCORE).toBeLessThan(QUIZ_QUESTIONS_PER_ROUND);
  });
});

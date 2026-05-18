import { describe, it, expect } from "vitest";
import { publicAuthorName, leaderboardAuthorName } from "./display-name";

describe("publicAuthorName", () => {
  it("foloseste display_name daca e setat (Google sign-in prenume)", () => {
    expect(publicAuthorName({ display_name: "Andrei", author_name: "Mușat Eduard Andrei" }))
      .toBe("Andrei");
  });

  it("fallback la primul cuvant din author_name daca display_name lipseste", () => {
    expect(publicAuthorName({ display_name: null, author_name: "Mușat Eduard Andrei" }))
      .toBe("Mușat");
  });

  it("fallback la primul cuvant cand display_name e empty string", () => {
    expect(publicAuthorName({ display_name: "", author_name: "Ion Popescu" })).toBe("Ion");
  });

  it("trim-uieste whitespace din display_name", () => {
    expect(publicAuthorName({ display_name: "  Andrei  ", author_name: "X Y" })).toBe("Andrei");
  });

  it("returneaza Cetatean cand author_name e gol si display_name lipseste", () => {
    expect(publicAuthorName({ display_name: null, author_name: null })).toBe("Cetățean");
    expect(publicAuthorName({})).toBe("Cetățean");
  });

  it("author_name cu un singur cuvant returneaza chiar acel cuvant", () => {
    expect(publicAuthorName({ display_name: null, author_name: "Andrei" })).toBe("Andrei");
  });

  it("author_name cu spatii multiple in fata returneaza primul cuvant non-empty", () => {
    expect(publicAuthorName({ display_name: null, author_name: "   Maria Popescu" })).toBe("Maria");
  });
});

describe("leaderboardAuthorName", () => {
  it("foloseste display_name daca exista", () => {
    expect(leaderboardAuthorName({ display_name: "Andrei", author_name: "X Y Z" })).toBe("Andrei");
  });

  it("Prenume + initiala ultimului nume cand display_name lipseste", () => {
    expect(leaderboardAuthorName({ display_name: null, author_name: "Maria Popescu" }))
      .toBe("Maria P.");
  });

  it("3+ cuvinte: primul + initiala ultimului", () => {
    expect(leaderboardAuthorName({ display_name: null, author_name: "Mușat Eduard Andrei" }))
      .toBe("Mușat A.");
  });

  it("Un singur cuvant returneaza chiar el", () => {
    expect(leaderboardAuthorName({ display_name: null, author_name: "Andrei" })).toBe("Andrei");
  });

  it("fallback Cetatean cand totul lipseste", () => {
    expect(leaderboardAuthorName({})).toBe("Cetățean");
  });
});

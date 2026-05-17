import { describe, it, expect } from "vitest";
import { repairJsonStrings, extractFieldsRegex, repairAndParseJson } from "./json-repair";

describe("repairJsonStrings", () => {
  it("returneaza JSON valid neschimbat", () => {
    const input = `{"title": "test", "n": 1}`;
    expect(JSON.parse(repairJsonStrings(input))).toEqual({ title: "test", n: 1 });
  });

  it("repara backslash-n literal `\\\\n` la escape valid `\\n`", () => {
    // Simulam Groq output: backslash + n literal in string => doua backslash + n in JSON.
    const broken = `{"body": "linia 1\\\\nlinia 2"}`;
    // Inainte de repair, JSON.parse il ia ca string `linia 1\\nlinia 2` (cu \n literal),
    // dar e VALID JSON sintactic. Cazul real e cand modelul scrie `\\n` direct in stream
    // peste un raw newline -> sparge JSON. Test mai relevant jos.
    const repaired = repairJsonStrings(broken);
    const parsed = JSON.parse(repaired) as { body: string };
    expect(parsed.body).toBe("linia 1\nlinia 2");
  });

  it("repara raw newlines (caractere de control) in interiorul stringurilor", () => {
    // Cazul realist: model scrie literal newline inside string value
    // => JSON invalid. Repair trebuie sa-l escape-eze.
    const broken = '{"body": "para 1\npara 2\npara 3"}';
    // Direct JSON.parse esueaza pe astea.
    expect(() => JSON.parse(broken)).toThrow();
    const repaired = repairJsonStrings(broken);
    const parsed = JSON.parse(repaired) as { body: string };
    expect(parsed.body).toBe("para 1\npara 2\npara 3");
  });

  it("scoate markdown code block wrap", () => {
    const broken = '```json\n{"title": "test"}\n```';
    const repaired = repairJsonStrings(broken);
    expect(JSON.parse(repaired)).toEqual({ title: "test" });
  });

  it("scoate trailing commas", () => {
    const broken = '{"a": 1, "b": 2,}';
    expect(() => JSON.parse(broken)).toThrow();
    const repaired = repairJsonStrings(broken);
    expect(JSON.parse(repaired)).toEqual({ a: 1, b: 2 });
  });

  it("extrage primul JSON object dintr-un text cu preamble", () => {
    const broken = 'Here is the data: {"x": 5} thanks';
    const repaired = repairJsonStrings(broken);
    expect(JSON.parse(repaired)).toEqual({ x: 5 });
  });

  it("repara cazul exact din productie (scrape-url petitie obezitate)", () => {
    // Reproduce eroarea reala: dupa body string lung, modelul a emis
    // `\\n` literal in loc de virgula+spatiu intre fields.
    const realBroken = `{"title": "Test", "body": "text", \\n "category": "Sănătate", \\n "slug": "test"}`;
    const repaired = repairJsonStrings(realBroken);
    // Dupa repair, structura ramane echivalent semantic — `\n` devine
    // newline in string-ul intermediar dar JSON.parse trebuie sa accepte.
    const parsed = JSON.parse(repaired) as { title: string; body: string; category: string };
    expect(parsed.title).toBe("Test");
    expect(parsed.category).toBe("Sănătate");
  });
});

describe("extractFieldsRegex", () => {
  it("extrage field-uri din JSON valid", () => {
    const raw = '{"title": "Hello", "body": "World"}';
    const fields = extractFieldsRegex(raw, ["title", "body"]);
    expect(fields).toEqual({ title: "Hello", body: "World" });
  });

  it("extrage chiar daca JSON e malformed (lossy fallback)", () => {
    const broken = '{"title": "Test corrupt JSON\n stuff", "body": "text"';
    const fields = extractFieldsRegex(broken, ["title", "body"]);
    expect(fields.body).toBe("text");
  });

  it("returneaza obiect gol cand niciun field nu e gasit", () => {
    const fields = extractFieldsRegex("nimic", ["title"]);
    expect(fields).toEqual({});
  });

  it("unescape escape sequences in valorile extrase", () => {
    const raw = '{"body": "linia 1\\nlinia 2", "title": "\\"quoted\\""}';
    const fields = extractFieldsRegex(raw, ["body", "title"]);
    expect(fields.body).toBe("linia 1\nlinia 2");
    expect(fields.title).toBe('"quoted"');
  });
});

describe("repairAndParseJson", () => {
  it("returneaza obiect parsat pe input valid", () => {
    const result = repairAndParseJson<{ x: number }>('{"x": 1}');
    expect(result).toEqual({ x: 1 });
  });

  it("incearca repair daca direct parse esueaza", () => {
    const result = repairAndParseJson<{ a: string }>('{"a": "test",}');
    expect(result).toEqual({ a: "test" });
  });

  it("fallback la regex extract daca repair esueaza", () => {
    const broken = 'garbled {"title": "OK"} more garbled, no proper end';
    const result = repairAndParseJson<{ title: string }>(broken, ["title"]);
    expect(result?.title).toBe("OK");
  });

  it("returneaza null cand nimic nu poate fi parsat", () => {
    const result = repairAndParseJson("absolut garbled no json here", ["title"]);
    expect(result).toBeNull();
  });
});

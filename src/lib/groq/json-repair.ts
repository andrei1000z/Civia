/**
 * Repair common Groq JSON malformations.
 *
 * Groq's `response_format: { type: "json_object" }` validate-eaza server-side
 * si returneaza 400 cu `failed_generation` cand modelul produce JSON
 * sintactic invalid. Cele mai frecvente cazuri vazute in prod:
 *
 *   - `\\n` literal (backslash + n) in interiorul stringurilor in loc de
 *     `\n` proper escape. Modelele mai mici (8b instant) o fac random
 *     pe outputs lungi.
 *   - Newlines/tab-uri raw in interiorul string values (text multi-linie
 *     copied wholesale fara escape).
 *   - Trailing commas `,}` sau `,]`.
 *   - Markdown code block wrap `` ```json ... ``` ``.
 *
 * Functia incearca sa repare aceste cazuri si returneaza string care
 * are sansa sa fie parse-uit cu `JSON.parse()`.
 */
export function repairJsonStrings(raw: string): string {
  let s = raw;

  // 1. BOM + whitespace + markdown fence
  s = s.replace(/^﻿/, "").trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");

  // 2. Extrage primul JSON object din text (skip eventual preamble).
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);

  // 3. Replace literal `\\n` cu `\n` (modelul emite escape gresit).
  //    Acelasi tratament pentru `\\t`, `\\r`.
  s = s.replace(/\\\\n/g, "\\n").replace(/\\\\t/g, "\\t").replace(/\\\\r/g, "\\r");

  // 4. Walk prin string literals. Inauntru: escape raw newlines/tabs.
  //    In afara: sterge escape sequences gen `\n`/`\t`/`\r` care n-au
  //    voie in JSON la nivel sintactic (modelul emite literal `\n`
  //    intre fields, gen `"body": "text",\\n "category": "..."`).
  const stringRe = /("(?:[^"\\]|\\.)*")/g;
  const parts: string[] = [];
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  while ((m = stringRe.exec(s)) !== null) {
    // Non-string segment (intre string-uri): scoate \n \t \r literali.
    const nonString = s.slice(lastEnd, m.index).replace(/\\[nrt]/g, " ");
    parts.push(nonString);
    // String literal segment: inlocuieste raw newlines cu escape valid.
    parts.push(
      m[0]
        .replace(/\r?\n/g, "\\n")
        .replace(/\t/g, "\\t"),
    );
    lastEnd = m.index + m[0].length;
  }
  // Tail dupa ultimul string literal.
  parts.push(s.slice(lastEnd).replace(/\\[nrt]/g, " "));
  s = parts.join("");

  // 5. Trailing commas `,}` / `,]`
  s = s.replace(/,(\s*[}\]])/g, "$1");

  return s;
}

/**
 * Ultimate fallback: extract fields via regex cand JSON parse e impossible
 * chiar dupa repair. Lossy dar mai bine decat sa returnam error la user.
 */
export function extractFieldsRegex(
  raw: string,
  fieldNames: readonly string[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of fieldNames) {
    // Escape key pentru regex.
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`"${escaped}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "i");
    const m = raw.match(re);
    if (!m || !m[1]) continue;
    // Unescape comune escape sequences.
    result[key] = m[1]
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .trim();
  }
  return result;
}

/**
 * Convenience wrapper: incearca repair + parse, daca esueaza extract regex.
 * Returneaza obiectul parsat sau null daca nici un drum nu reuseste.
 */
export function repairAndParseJson<T = unknown>(
  raw: string,
  expectedFields?: readonly string[],
): T | null {
  // Step 1: try direct parse.
  try {
    return JSON.parse(raw) as T;
  } catch {
    // continue
  }
  // Step 2: repair + parse.
  try {
    const repaired = repairJsonStrings(raw);
    return JSON.parse(repaired) as T;
  } catch {
    // continue
  }
  // Step 3: regex extract (lossy fallback).
  if (expectedFields && expectedFields.length > 0) {
    const fields = extractFieldsRegex(raw, expectedFields);
    if (Object.keys(fields).length > 0) {
      return fields as T;
    }
  }
  return null;
}

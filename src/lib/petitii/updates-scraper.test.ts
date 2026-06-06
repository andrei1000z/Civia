import { describe, it, expect } from "vitest";
import { extractSignatureCount, canScrapeUpdates } from "./updates-scraper";

describe("extractSignatureCount", () => {
  it("/efforts/: ia numarul curent din .petition-signatures > .number (nu target-ul)", () => {
    // Structura reală: numărul curent în .number, target în .strong.
    const html = `
      <div class="petition-signatures">
        <span class="number">14.113</span>
        din
        <span class="strong">15.000</span>
        Semnături
      </div>`;
    expect(extractSignatureCount(html)).toBe(14113); // 14.113, NU 15.000
  });

  it("/petitions/: ia currentSignaturesCount din JSON entity-encoded", () => {
    const html = `<script>...&quot;progressPercentage&quot;:52,&quot;currentSignaturesCount&quot;:104788,&quot;goal&quot;:200000...</script>`;
    expect(extractSignatureCount(html)).toBe(104788);
  });

  it("/petitions/: ia currentSignaturesCount din JSON ne-encodat", () => {
    const html = `<script>window.__STATE={"currentSignaturesCount":8742,"goal":10000}</script>`;
    expect(extractSignatureCount(html)).toBe(8742);
  });

  it("clasa signatures + .number functioneaza si fara prefixul petition-", () => {
    expect(extractSignatureCount('<div class="signatures"> <span class="number">9.876</span></div>')).toBe(9876);
  });

  it("NU prinde statistici/target-uri fara structura sigura (mai bine zero decat gresit)", () => {
    // Capcana reala: „5.828.000 de români susțin parteneriatul" e o STATISTICĂ.
    expect(extractSignatureCount("<p>5.828.000 de români susțin parteneriatul</p>")).toBeNull();
    // Target rotund fara .number / JSON → null.
    expect(extractSignatureCount("<p>Obiectiv: 20.000 de semnături</p>")).toBeNull();
  });

  it("returneaza null cand nu exista structura cunoscuta", () => {
    expect(extractSignatureCount("<p>fără cifre relevante aici</p>")).toBeNull();
    expect(extractSignatureCount("")).toBeNull();
  });
});

describe("canScrapeUpdates", () => {
  it("accepta doar domenii Declic", () => {
    expect(canScrapeUpdates("https://campaniamea.declic.ro/efforts/x")).toBe(true);
    expect(canScrapeUpdates("https://www.declic.ro/p/y")).toBe(true);
    expect(canScrapeUpdates("https://secure.avaaz.org/z")).toBe(false);
    expect(canScrapeUpdates(null)).toBe(false);
    expect(canScrapeUpdates("")).toBe(false);
  });
});

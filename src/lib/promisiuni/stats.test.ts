import { describe, it, expect } from "vitest";
import { PROMISIUNI, PROMISIUNE_STATUS_META, type Promisiune } from "@/data/promisiuni";
import { promisiuniStats, sortPromisiuni, groupByAutoritate } from "./stats";
import { ALL_COUNTIES } from "@/data/counties";

const mk = (over: Partial<Promisiune>): Promisiune => ({
  id: "x",
  autoritate: "Test",
  functie: "Primar",
  county: "B",
  promisiune: "p",
  termen: "2026",
  termenIso: "2026-12-31",
  sursaUrl: "https://example.com/a",
  publicatie: "Test",
  dataSursa: "2026-01-01",
  status: "in-curs",
  nota: "n",
  verificatLa: "2026-06-11",
  ...over,
});

describe("date PROMISIUNI (validare seed — risc legal)", () => {
  it("id-uri unice, kebab-case", () => {
    const ids = PROMISIUNI.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("fiecare promisiune are sursă https reală + publicație + notă factuală", () => {
    for (const p of PROMISIUNI) {
      expect(p.sursaUrl, `${p.id}: sursaUrl`).toMatch(/^https:\/\//);
      expect(p.publicatie.length, `${p.id}: publicatie`).toBeGreaterThan(2);
      expect(p.nota.length, `${p.id}: nota`).toBeGreaterThan(20);
      expect(p.dataSursa, `${p.id}: dataSursa`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.verificatLa, `${p.id}: verificatLa`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (p.termenIso) expect(p.termenIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("status valid + county valid", () => {
    for (const p of PROMISIUNI) {
      expect(PROMISIUNE_STATUS_META[p.status], `${p.id}: status`).toBeDefined();
      expect(ALL_COUNTIES.some((c) => c.id === p.county), `${p.id}: county ${p.county}`).toBe(true);
    }
  });

  it("nota nu conține limbaj acuzator (risc legal)", () => {
    const INTERZISE = [/minci/i, /minți/i, /a mințit/i, /corup/i, /escroc/i, /hoț/i, /fură/i];
    for (const p of PROMISIUNI) {
      for (const re of INTERZISE) {
        expect(re.test(p.nota), `${p.id}: nota conține limbaj acuzator (${re})`).toBe(false);
      }
    }
  });
});

describe("promisiuniStats", () => {
  it("numără pe status + rata respectare doar din scadente", () => {
    const s = promisiuniStats([
      mk({ id: "a", status: "respectata" }),
      mk({ id: "b", status: "respectata" }),
      mk({ id: "c", status: "intarziata" }),
      mk({ id: "d", status: "in-curs" }),
    ]);
    expect(s.total).toBe(4);
    expect(s.perStatus.respectata).toBe(2);
    expect(s.rataRespectare).toBe(67); // 2/3 scadente — in-curs NU intră
  });

  it("rataRespectare null când totul e în curs", () => {
    expect(promisiuniStats([mk({ id: "a" })]).rataRespectare).toBe(null);
  });
});

describe("sortPromisiuni", () => {
  it("întârziate primele, apoi în-curs după termen, apoi încheiate", () => {
    const sorted = sortPromisiuni([
      mk({ id: "resp", status: "respectata" }),
      mk({ id: "curs-tarziu", status: "in-curs", termenIso: "2027-06-01" }),
      mk({ id: "int", status: "intarziata" }),
      mk({ id: "curs-devreme", status: "in-curs", termenIso: "2026-08-01" }),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(["int", "curs-devreme", "curs-tarziu", "resp"]);
  });
});

describe("groupByAutoritate", () => {
  it("grupează + sortează după nr. promisiuni", () => {
    const g = groupByAutoritate([
      mk({ id: "a", autoritate: "X" }),
      mk({ id: "b", autoritate: "Y" }),
      mk({ id: "c", autoritate: "Y" }),
    ]);
    expect(g[0]!.autoritate).toBe("Y");
    expect(g[0]!.items).toHaveLength(2);
  });
});

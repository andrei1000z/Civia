import { PROMISIUNI, type Promisiune } from "@/data/promisiuni";
import { promisiuniStats, type PromisiuniStats } from "./stats";

/** Slug stabil de URL dintr-un nume de autoritate: diacritice → ASCII,
 *  lowercase, orice non-alfanumeric → o singură liniuță.
 *  „Rareș Hopincă" → rares-hopinca; „CNAIR / DRDP Cluj" → cnair-drdp-cluj. */
export function slugAutoritate(nume: string): string {
  return nume
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface AutoritateProfil {
  slug: string;
  autoritate: string;
  functie: string;
  county: string;
  items: Promisiune[];
  stats: PromisiuniStats;
  /** Inițiale pentru avatar („Ciprian Ciucu" → CC; instituții → prima literă). */
  initiale: string;
}

function initiale(nume: string): string {
  const cuvinte = nume.split(/\s+/).filter((w) => /^[A-ZĂÂÎȘȚ]/.test(w));
  if (cuvinte.length >= 2) return (cuvinte[0]![0]! + cuvinte[cuvinte.length - 1]![0]!).toUpperCase();
  return nume.slice(0, 2).toUpperCase();
}

/** Toate autoritățile urmărite, cu promisiunile + statisticile lor.
 *  Sortate după numărul de promisiuni (cele mai urmărite primele). */
export function getAutoritati(items: Promisiune[] = PROMISIUNI): AutoritateProfil[] {
  const map = new Map<string, AutoritateProfil>();
  for (const p of items) {
    const slug = slugAutoritate(p.autoritate);
    let prof = map.get(slug);
    if (!prof) {
      prof = {
        slug,
        autoritate: p.autoritate,
        functie: p.functie,
        county: p.county,
        items: [],
        stats: promisiuniStats([]),
        initiale: initiale(p.autoritate),
      };
      map.set(slug, prof);
    }
    prof.items.push(p);
  }
  for (const prof of map.values()) {
    prof.stats = promisiuniStats(prof.items);
    // cele mai noi declarații primele — ordinea naturală pe pagina de profil
    prof.items.sort((a, b) => b.dataSursa.localeCompare(a.dataSursa));
  }
  return [...map.values()].sort((a, b) => b.items.length - a.items.length);
}

export function getAutoritateBySlug(slug: string): AutoritateProfil | null {
  return getAutoritati().find((a) => a.slug === slug) ?? null;
}

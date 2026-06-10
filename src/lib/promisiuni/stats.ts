import type { Promisiune, PromisiuneStatus } from "@/data/promisiuni";

export interface PromisiuniStats {
  total: number;
  perStatus: Record<PromisiuneStatus, number>;
  /** % respectate din cele AJUNSE la scadență (respectate + întârziate +
   *  încălcate). Cele în curs nu intră — nu poți judeca o promisiune
   *  înainte de termen. null când nimic n-a ajuns la scadență. */
  rataRespectare: number | null;
}

export function promisiuniStats(items: Promisiune[]): PromisiuniStats {
  const perStatus: Record<PromisiuneStatus, number> = {
    respectata: 0,
    "in-curs": 0,
    intarziata: 0,
    incalcata: 0,
  };
  for (const p of items) perStatus[p.status] += 1;
  const scadente = perStatus.respectata + perStatus.intarziata + perStatus.incalcata;
  return {
    total: items.length,
    perStatus,
    rataRespectare: scadente > 0 ? Math.round((perStatus.respectata / scadente) * 100) : null,
  };
}

/** Ordinea de afișare: ce cere atenție întâi (întârziate), apoi în curs
 *  (cu termenul cel mai apropiat primul), apoi încheiate. */
const STATUS_ORDER: Record<PromisiuneStatus, number> = {
  intarziata: 0,
  "in-curs": 1,
  respectata: 2,
  incalcata: 3,
};

export function sortPromisiuni(items: Promisiune[]): Promisiune[] {
  return [...items].sort((a, b) => {
    const so = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (so !== 0) return so;
    // în interiorul aceluiași status: termen mai apropiat primul; nedeclarat la coadă
    if (a.termenIso && b.termenIso) return a.termenIso.localeCompare(b.termenIso);
    if (a.termenIso) return -1;
    if (b.termenIso) return 1;
    return a.dataSursa.localeCompare(b.dataSursa);
  });
}

/** Grupare pe autoritate pentru secțiunea „pe primării". */
export function groupByAutoritate(items: Promisiune[]): Array<{ autoritate: string; functie: string; items: Promisiune[] }> {
  const map = new Map<string, { autoritate: string; functie: string; items: Promisiune[] }>();
  for (const p of items) {
    const g = map.get(p.autoritate) ?? { autoritate: p.autoritate, functie: p.functie, items: [] };
    g.items.push(p);
    map.set(p.autoritate, g);
  }
  return [...map.values()].sort((a, b) => b.items.length - a.items.length);
}

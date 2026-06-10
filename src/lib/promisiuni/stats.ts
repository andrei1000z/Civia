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

/** Zile până la termen (negative = termenul a trecut). null = nedeclarat. */
export function daysUntilTermen(termenIso: string | null, nowIso: string): number | null {
  if (!termenIso) return null;
  const MS_DAY = 86_400_000;
  return Math.ceil((new Date(termenIso).getTime() - new Date(nowIso).getTime()) / MS_DAY);
}

/** Cât % din perioada promisă (dataSursa → termen) a trecut. 0-100, clamp.
 *  null când termenul e nedeclarat. Folosit la progress bar-ul de pe card. */
export function termenProgress(
  dataSursa: string,
  termenIso: string | null,
  nowIso: string,
): number | null {
  if (!termenIso) return null;
  const start = new Date(dataSursa).getTime();
  const end = new Date(termenIso).getTime();
  const now = new Date(nowIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
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

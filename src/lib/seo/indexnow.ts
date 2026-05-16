/**
 * IndexNow protocol — notifică Bing / Yandex / Seznam / DuckDuckGo când
 * URL-uri sunt adăugate / șterse / actualizate, ca să fie indexate sau
 * deindexate aproape instant (vs. ore-zile pentru crawl natural).
 *
 * Google NU suportă IndexNow oficial (anunțat 2021, nimic concret de atunci).
 * Pentru Google ne bazăm pe: X-Robots-Tag noindex pe 404/410, sitemap-ul
 * care exclude automat URL-urile șterse, și 410 Gone (deindex în ~3-7 zile
 * vs ~14-30 cu 404).
 *
 * Cum funcționează IndexNow:
 * 1. Generezi o cheie aleatorie (32+ chars).
 * 2. O servești ca fișier la `https://yoursite.com/{key}.txt` cu chiar
 *    cheia ca conținut (verificare ownership).
 * 3. POST către `api.indexnow.org/indexnow` cu lista URL-urilor.
 *
 * Spec: https://www.indexnow.org/documentation
 */

import { SITE_URL } from "@/lib/constants";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

/**
 * Cheia IndexNow. Setată din env ca să nu fie hardcoded; dacă lipsește,
 * funcția devine no-op (nu pică build-ul, doar nu pinguim — Google oricum
 * nu folosește IndexNow, deci pierderea e mică).
 */
function getKey(): string | null {
  return process.env.INDEXNOW_KEY ?? null;
}

// Track-uim numarul de fail-uri consecutive ca sa nu inundam logs cu warn
// la fiecare attempt. Loguim doar dupa 3+ fail-uri consecutive (semn de
// outage real, nu glitch tranzitoriu).
let consecutiveFailures = 0;
function recordIndexNowFailure(reason: string) {
  consecutiveFailures += 1;
  if (consecutiveFailures >= 3) {
    console.warn(`[indexnow] ${consecutiveFailures} fail-uri consecutive — ${reason}`);
  }
}
function recordIndexNowSuccess() {
  consecutiveFailures = 0;
}

/**
 * Pinguie IndexNow că URL-urile au fost șterse. Engines-urile vor scoate
 * din index aproape instant (Bing claim sub 1h).
 */
export async function pingIndexNowDeleted(stireIds: string[]): Promise<void> {
  const key = getKey();
  if (!key) return;
  if (stireIds.length === 0) return;

  const host = new URL(SITE_URL).hostname;
  const urlList = stireIds.map((id) => `${SITE_URL}/stiri/${id}`);

  // IndexNow batch limit: 10.000 URL-uri per request. Ștergem max câteva
  // sute pe rulare de cleanup, deci 1 request e suficient.
  const body = {
    host,
    key,
    keyLocation: `${SITE_URL}/${key}.txt`,
    urlList,
  };

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
      // 10s timeout — IndexNow API e de obicei sub 1s, dar protejăm cron-ul.
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok && res.status !== 202) {
      recordIndexNowFailure(`HTTP ${res.status}`);
    } else {
      recordIndexNowSuccess();
    }
  } catch (e) {
    // Best-effort: IndexNow e bonus, nu critical path.
    recordIndexNowFailure(`network: ${(e as Error).message}`);
  }
}

/**
 * Pinguie IndexNow că un URL nou a apărut (la fetch de articole noi).
 * Bing/Yandex/Seznam îl crawl-uiesc rapid → indexare în ore în loc de zile.
 */
export async function pingIndexNowAdded(stireIds: string[]): Promise<void> {
  // Identic cu pingIndexNowDeleted — IndexNow nu distinge între
  // „added" și „deleted"; engine-ul re-crawl-uiește URL-ul și decide.
  // Funcție separată doar ca să fie clar la callsite ce se întâmplă.
  return pingIndexNowDeleted(stireIds);
}

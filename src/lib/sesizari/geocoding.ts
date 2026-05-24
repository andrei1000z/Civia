// Reverse + forward geocoding using Nominatim (OpenStreetMap) — free, no API key
import { detectSectorFromText } from "./sector-detect";

/**
 * Extract a set of geocodable "street + city" queries from a verbose
 * free-text location like:
 *   "Pe trotuarul aferent arterei Calea 13 Septembrie, mai exact pe
 *    segmentul cuprins între intersecția cu Șoseaua Panduri..."
 *
 * Nominatim chokes on that whole sentence but will happily return the
 * centroid of "Calea 13 Septembrie, București". So we pull out every
 * "Strada X / Calea X / Bulevardul X / Șoseaua X / Piața X / Aleea X"
 * mention, optionally pick up an adjacent street number, and return a
 * list of progressively less specific queries for the caller to try
 * in order.
 */
export function extractGeocodeQueries(text: string, countyHint?: string | null): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (q: string) => {
    const k = q.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(q); }
  };

  // Sector → always Bucharest
  const sectorMatch = text.match(/Sector(?:ul)?\s*([1-6])/i);
  const bucharestScope = sectorMatch ? "București" : (countyHint || "");

  // Strip parenthesized clauses + collapse whitespace
  const clean = text.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();

  // Canonical Romanian street prefixes. We search case-insensitively and
  // allow common abbreviations.
  // First char of the street name can be a letter (Calea Victoriei) or
  // a digit ("Calea 13 Septembrie", "Bulevardul 1 Mai"). We also accept
  // lowercase in the rest so abbreviations like "nr." don't break the
  // match prematurely.
  const STREET_RE =
    /(Strada|Str\.?|Calea|Bulevardul|Bd\.?|B-dul|Șoseaua|Șos\.?|Sos\.?|Piața|Aleea|Intrarea|Splaiul|Drumul|Cartier|Parcul)\s+([A-ZĂÂÎȘȚ0-9][\wĂÂÎȘȚăâîșț0-9\-'. ]{1,60}?)(?=\s*(?:nr\.?\s*\d+|,|\.|și|—|–|\(|$))/gi;
  let m: RegExpExecArray | null;
  const streetNameHits: string[] = [];
  while ((m = STREET_RE.exec(clean)) !== null) {
    const prefix = m[1]!;
    const name = m[2]!.trim().replace(/[,.]$/, "");
    if (name.length >= 2) {
      streetNameHits.push(`${prefix} ${name}`.replace(/\s+/g, " "));
    }
  }

  // Detect street number attached to the first hit (e.g. "Calea Victoriei 45"
  // or "Calea Victoriei nr. 45").
  const firstStreet = streetNameHits[0];
  if (firstStreet) {
    const tail = clean.slice(clean.toLowerCase().indexOf(firstStreet.toLowerCase()) + firstStreet.length, clean.toLowerCase().indexOf(firstStreet.toLowerCase()) + firstStreet.length + 40);
    const numMatch = tail.match(/^[^\d,]*?(?:nr\.?\s*)?(\d{1,4})\b/i);
    if (numMatch) {
      push([`${firstStreet} ${numMatch[1]}`, bucharestScope, "România"].filter(Boolean).join(", "));
    }
  }

  // Bare street + city fallback, most-specific first.
  for (const s of streetNameHits) {
    push([s, bucharestScope, "România"].filter(Boolean).join(", "));
  }

  // Last resort: city-only query (so at least the pin lands in the city,
  // not nothing). Drop if we don't even know the city.
  if (bucharestScope) {
    push(`${bucharestScope}, România`);
  }

  return out;
}

const GEOCODE_HEADERS = { "User-Agent": "CivicRomania/1.0 (civia.ro)" } as const;

// Lightweight client-side ratelimit to stay friendly with Nominatim's
// 1 req/s policy. Awaits the minimum gap between consecutive calls.
let lastNominatimHitAt = 0;
async function waitNominatimGap() {
  const GAP_MS = 1100;
  const now = Date.now();
  const elapsed = now - lastNominatimHitAt;
  if (elapsed < GAP_MS) {
    await new Promise((r) => setTimeout(r, GAP_MS - elapsed));
  }
  lastNominatimHitAt = Date.now();
}

export interface GeocodingResult {
  address: string;
  sector: string | null;
  neighborhood?: string;
  street?: string;
  houseNumber?: string;
}

export interface ForwardGeocodingResult {
  lat: number;
  lng: number;
  displayName: string;
  boundingBox?: [number, number, number, number]; // [south, north, west, east]
  /** True dacă match-ul a venit dintr-o query cu stradă explicită
   *  (Strada/Calea/Bulevardul/etc.). False dacă a venit din city-only
   *  fallback (ex: „Sector 5, București") — caz în care lat/lng e
   *  centroidul orașului/zonei și NU trebuie folosit ca pin precis pentru
   *  sesizare. Fix bug 2026-05-24: 3 sesizări (#41, #33, #32) aveau pin la
   *  Piața Constituției pentru că locația era doar „Sector 5". */
  streetLevel: boolean;
}

// Single-query Nominatim call. Returns null on miss / non-Romania match.
// 3s timeout — Nominatim e capricios, mai bine null decât blocare la submit.
async function nominatimOne(query: string, streetLevel = true): Promise<ForwardGeocodingResult | null> {
  if (!query || query.length < 3) return null;
  const q = query.replace(/\s+/g, " ").trim().slice(0, 180);
  try {
    await waitNominatimGap();
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=ro&limit=1&addressdetails=1&accept-language=ro`;
    const res = await fetch(url, {
      headers: GEOCODE_HEADERS,
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      boundingbox?: string[];
    }>;
    const hit = arr[0];
    if (!hit) return null;
    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    // Bound to România — guard against rogue matches.
    if (lat < 43.5 || lat > 48.3 || lng < 20.2 || lng > 29.7) return null;
    const bb = hit.boundingbox?.map(parseFloat);
    return {
      lat,
      lng,
      displayName: hit.display_name,
      boundingBox: bb && bb.length === 4 && bb.every((n) => Number.isFinite(n))
        ? [bb[0]!, bb[1]!, bb[2]!, bb[3]!]
        : undefined,
      streetLevel,
    };
  } catch {
    return null;
  }
}

/** Romania county centroids (approximation) pentru sanity-check distance.
 *  Folosit ca să respingem rezultate Nominatim > 100km de centrul jud.
 *  declarat (ex: user scrie „Strada Scorțeni Sector 5" și Nominatim
 *  returnează Scorțeni Sibiu — # 00044). */
const COUNTY_CENTROIDS: Record<string, [number, number]> = {
  AB: [46.075, 23.580], AR: [46.180, 21.310], AG: [44.860, 24.870], BC: [46.567, 26.910],
  BH: [47.067, 21.940], BN: [47.130, 24.500], BT: [47.740, 26.660], BV: [45.660, 25.610],
  BR: [45.270, 27.980], BZ: [45.150, 26.820], CS: [45.110, 22.080], CL: [44.200, 27.330],
  CJ: [46.770, 23.590], CT: [44.180, 28.620], CV: [45.870, 25.790], DB: [44.930, 25.460],
  DJ: [44.330, 23.800], GL: [45.430, 28.040], GR: [43.900, 25.970], GJ: [45.040, 23.270],
  HR: [46.360, 25.800], HD: [45.870, 22.890], IL: [44.560, 27.380], IS: [47.160, 27.580],
  IF: [44.500, 26.100], MM: [47.660, 23.580], MH: [44.630, 22.660], MS: [46.540, 24.560],
  NT: [46.930, 26.370], OT: [44.430, 24.370], PH: [44.940, 26.020], SM: [47.790, 22.890],
  SJ: [47.190, 23.060], SB: [45.800, 24.150], SV: [47.650, 26.260], TR: [43.910, 25.330],
  TM: [45.760, 21.230], TL: [45.180, 28.800], VS: [46.220, 27.730], VL: [45.100, 24.370],
  VN: [45.700, 27.190], B: [44.4378, 26.0973],
};

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Verifică dacă rezultatul Nominatim e plauzibil pentru județul declarat.
 *  Returnează true dacă (a) nu avem hint sau (b) rezultatul e <100km de
 *  centrul județului. Folosit ca să respingem matches geografice complet
 *  greșite (ex: „Strada Scorțeni, București" → Scorțeni Sibiu). */
function isPlausibleForCounty(
  result: ForwardGeocodingResult,
  countyCode: string | null,
): boolean {
  if (!countyCode) return true;
  const centroid = COUNTY_CENTROIDS[countyCode.toUpperCase()];
  if (!centroid) return true;
  const distKm = haversine(result.lat, result.lng, centroid[0], centroid[1]);
  return distKm <= 100;
}

/**
 * Forward geocoding: text → coordinates. Tries a sequence of extracted
 * queries — full text, then street + number + city, then street + city,
 * then just city — stopping at the first hit.
 *
 * This is the version most callers want. For a verbose sesizare text
 * like "Pe trotuarul aferent Calea 13 Septembrie, între intersecția cu
 * Șoseaua Panduri...", the first attempt often misses, but the second
 * ("Calea 13 Septembrie, București") nails it.
 */
export async function forwardGeocode(
  text: string,
  countyHint?: string | null,
  countyCode?: string | null,
): Promise<ForwardGeocodingResult | null> {
  if (!text || text.length < 3) return null;

  // Attempt 1: the original text (cleaned). Works for short, clean
  // queries the user typed into the "locatie" field.
  const cleaned = text.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
  const direct = await nominatimOne(cleaned, true);
  if (direct && isPlausibleForCounty(direct, countyCode ?? null)) return direct;

  // Attempt 2+: extracted queries (street + number + city, then looser).
  // Ultima query e city-only („București, România") — marcăm streetLevel=false
  // ca să poată caller-ul să respingă pin-ul Piața Constituției default.
  const queries = extractGeocodeQueries(text, countyHint);
  const lastIdx = queries.length - 1;
  for (let i = 0; i < queries.length; i++) {
    const isCityOnly = i === lastIdx && !/\d|Strada|Calea|Bd|Bulevardul|Șos|Sos|Piața|Aleea|Drumul|Splaiul/i.test(queries[i]!);
    const hit = await nominatimOne(queries[i]!, !isCityOnly);
    if (hit && isPlausibleForCounty(hit, countyCode ?? null)) return hit;
  }
  return null;
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodingResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=ro`;
    const res = await fetch(url, {
      headers: GEOCODE_HEADERS,
      // Reverse geocode results are stable — cache 24h to cut Nominatim load.
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      address?: {
        road?: string;
        house_number?: string;
        suburb?: string;
        city_district?: string;
        neighbourhood?: string;
      };
      display_name?: string;
    };
    const addr = data.address ?? {};

    // Detect sector — try city_district first, then fallback to keyword detection
    let sector: string | null = null;
    const sectorStr = addr.city_district ?? addr.suburb ?? "";
    const match = sectorStr.match(/Sector(?:ul)?\s*(\d)/i);
    if (match) sector = `S${match[1]}`;

    const parts: string[] = [];
    if (addr.road) parts.push(addr.road);
    if (addr.house_number) parts.push(`nr. ${addr.house_number}`);
    if (addr.neighbourhood) parts.push(addr.neighbourhood);

    const address = parts.join(", ") || data.display_name?.split(",").slice(0, 3).join(",") || "";

    // Fallback: keyword-based detection from full display name + neighborhood
    if (!sector) {
      const searchText = `${address} ${data.display_name ?? ""} ${addr.neighbourhood ?? ""}`;
      sector = detectSectorFromText(searchText);
    }

    return {
      address,
      sector,
      neighborhood: addr.neighbourhood,
      street: addr.road,
      houseNumber: addr.house_number,
    };
  } catch {
    return null;
  }
}

/**
 * Reverse geocoding via Nominatim (OpenStreetMap) — free, no API key.
 * Returns county code + locality name from coordinates.
 * Rate limit: 1 req/sec (Nominatim policy).
 */

import { ALL_COUNTIES } from "@/data/counties";

/**
 * Haversine fallback: when Nominatim confirms the point is in Romania
 * but doesn't return a county/state field (happens for some smaller
 * towns whose OSM record skips admin levels), pick the closest county
 * center. The smoke test in scripts/audit-county-detect.ts caught
 * Rădăuți as a representative case — the API returned only `city` and
 * `country`, leaving the parser empty-handed.
 */
function closestCountyCode(lat: number, lng: number): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const c of ALL_COUNTIES) {
    const dLat = c.center[0] - lat;
    const dLng = c.center[1] - lng;
    const d = dLat * dLat + dLng * dLng;
    if (d < bestDist) {
      bestDist = d;
      best = c.id;
    }
  }
  return best;
}

// Map Romanian county names (from Nominatim) to our 2-letter codes
const COUNTY_NAME_TO_CODE: Record<string, string> = {
  "alba": "AB", "arad": "AR", "argeș": "AG", "arges": "AG",
  "bacău": "BC", "bacau": "BC", "bihor": "BH",
  "bistrița-năsăud": "BN", "bistrita-nasaud": "BN",
  "botoșani": "BT", "botosani": "BT",
  "brăila": "BR", "braila": "BR",
  "brașov": "BV", "brasov": "BV",
  "buzău": "BZ", "buzau": "BZ",
  "călărași": "CL", "calarasi": "CL",
  "caraș-severin": "CS", "caras-severin": "CS",
  "cluj": "CJ", "constanța": "CT", "constanta": "CT",
  "covasna": "CV",
  "dâmbovița": "DB", "dambovita": "DB",
  "dolj": "DJ",
  "galați": "GL", "galati": "GL",
  "gorj": "GJ",
  "giurgiu": "GR",
  "harghita": "HR",
  "hunedoara": "HD",
  "ialomița": "IL", "ialomita": "IL",
  "iași": "IS", "iasi": "IS",
  "ilfov": "IF",
  "maramureș": "MM", "maramures": "MM",
  "mehedinți": "MH", "mehedinti": "MH",
  "mureș": "MS", "mures": "MS",
  "neamț": "NT", "neamt": "NT",
  "olt": "OT",
  "prahova": "PH",
  "sălaj": "SJ", "salaj": "SJ",
  "satu mare": "SM",
  "sibiu": "SB",
  "suceava": "SV",
  "teleorman": "TR",
  "timiș": "TM", "timis": "TM",
  "tulcea": "TL",
  "vâlcea": "VL", "valcea": "VL",
  "vaslui": "VS",
  "vrancea": "VN",
  "bucurești": "B", "bucharest": "B", "municipiul bucurești": "B",
};

/** Detectează codul de județ + sectorul dintr-un obiect `address` Nominatim
 *  + display_name. Folosit de reverse ȘI de search (forward). */
function countyFromNominatim(addr: Record<string, string>, displayName: string, lat: number, lng: number): { countyCode: string | null; sector: string | null } {
  const strip = (raw: string): string =>
    (raw || "").toLowerCase().trim()
      .replace(/^jude[țt](?:ul)?\s+/i, "").replace(/^municipiul\s+/i, "")
      .replace(/^regiunea(?:\s+de\s+dezvoltare)?\s+/i, "").trim();
  let countyCode =
    COUNTY_NAME_TO_CODE[strip(addr.county || "")] ??
    COUNTY_NAME_TO_CODE[strip(addr.state || "")] ??
    COUNTY_NAME_TO_CODE[strip(addr.state_district || "")] ?? null;
  if (!countyCode) {
    const looksBuc = /sector\s*\d/i.test(addr.county || "") || /sector\s*\d/i.test(addr.city_district || "") ||
      /sector\s*\d/i.test(addr.suburb || "") || /bucure[șs]ti|bucharest/i.test(addr.city || "") ||
      /bucure[șs]ti|bucharest/i.test(displayName);
    if (looksBuc) countyCode = "B";
  }
  if (!countyCode && (addr.country_code ?? "").toLowerCase() === "ro") countyCode = closestCountyCode(lat, lng);
  const sectorMatch = `${addr.suburb || ""} ${addr.city_district || ""} ${addr.quarter || ""} ${displayName}`.match(/sector\s*(\d)/i);
  return { countyCode, sector: sectorMatch ? `S${sectorMatch[1]}` : null };
}

export interface AddressSuggestion {
  label: string;          // „Strada Novaci 12, Sector 5, București"
  lat: number;
  lng: number;
  countyCode: string | null;
  sector: string | null;
}

/**
 * Forward geocode (search) — userul scrie o adresă, primește sugestii cu
 * coordonate exacte. Esențial când GPS-ul e imprecis (desktop/wifi ±km):
 * scrii „Strada Novaci 12, București" și primești locul EXACT, nu o stradă
 * apropiată ghicită din coordonate grosiere. Nominatim, gratuit, doar RO.
 */
export async function searchAddress(query: string): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  // Numărul casei din CE A TASTAT userul (număr la finalul query-ului).
  // Nominatim adesea NU are date la nivel de număr pentru străzile din RO →
  // întoarce centroidul străzii fără `house_number`. Păstrăm numărul scris de
  // user („Strada Novaci 12" → „Strada Novaci 12", nu „Strada Novaci").
  // Doar număr TRAILING — ca să nu confundăm „Strada 13 Septembrie" (13 = nume).
  const qNum = q.match(/\b(\d{1,4}[a-z]?)\b\s*$/i)?.[1] ?? "";
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&addressdetails=1&accept-language=ro&countrycodes=ro&limit=8`;
    const res = await fetch(url, { headers: { "User-Agent": "Civia/1.0 (civia.ro)" }, next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<Record<string, unknown>>;
    const mapped = data.map((item) => {
      const addr = (item.address ?? {}) as Record<string, string>;
      const displayName = String(item.display_name ?? "");
      const lat = Number(item.lat);
      const lng = Number(item.lon);
      const { countyCode, sector } = countyFromNominatim(addr, displayName, lat, lng);
      // Label curat: stradă + nr + sector/localitate.
      const street = addr.road || addr.pedestrian || addr.footway || addr.neighbourhood || "";
      // nr: din Nominatim dacă există, altfel din ce-a scris userul.
      const num = addr.house_number ? ` ${addr.house_number}` : (street && qNum ? ` ${qNum}` : "");
      const loc = countyCode === "B" ? `${sector ? `Sector ${sector.replace("S", "")}, ` : ""}București`
        : (addr.city || addr.town || addr.village || addr.municipality || addr.county || "");
      const label = [street ? `${street}${num}` : "", loc].filter(Boolean).join(", ") || displayName.split(",").slice(0, 3).join(",");
      return { label, lat, lng, countyCode, sector };
    }).filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
    // Dedupe pe label (Nominatim întoarce des același rezultat de 2× — ex.
    // „Strada Novaci, Sector 5, București" apărea duplicat).
    const seen = new Set<string>();
    return mapped.filter((s) => {
      const key = s.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 6);
  } catch {
    return [];
  }
}

export interface GeocodedLocation {
  countyCode: string | null;  // "CJ", "B", etc.
  countyName: string | null;  // "Cluj", "București"
  locality: string | null;    // "Cluj-Napoca", "Sector 3"
  sector: string | null;      // "S1"-"S6" for București only
  address: string | null;     // full formatted address from Nominatim
  shortAddress: string | null; // clean: "Strada X nr. Y, Localitate, Județ"
  street: string | null;       // street name
  houseNumber: string | null;  // house number
}

/**
 * Reverse geocode coordinates to county + locality.
 * Uses Nominatim (free, no key needed).
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodedLocation> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=ro&zoom=18`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Civia/1.0 (civia.ro)" },
      // Coordinates resolve to the same address forever — cache 24h at CDN.
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const data = await res.json();

    const addr = data.address ?? {};
    const displayName = (data.display_name ?? "") as string;

    // Strip Romanian admin prefixes Nominatim sometimes adds in front
    // of the actual county name. We've seen all of these in the wild
    // depending on the underlying OSM tagging:
    //   "Județul Cluj", "Judet Brașov", "județ Argeș"
    //   "Municipiul București", "Municipiul Cluj-Napoca"
    //   "Regiunea de Dezvoltare Nord-Est"  (national region — unhelpful)
    const stripAdminPrefix = (raw: string): string =>
      raw
        .toLowerCase()
        .trim()
        .replace(/^jude[țt](?:ul)?\s+/i, "")
        .replace(/^municipiul\s+/i, "")
        .replace(/^regiunea(?:\s+de\s+dezvoltare)?\s+/i, "")
        .trim();

    const countyRaw = stripAdminPrefix(addr.county || "");
    const stateRaw = stripAdminPrefix(addr.state || "");
    // Newer Nominatim builds expose `region` for the dev-region tier;
    // we ignore that one but keep `state_district` as a useful fallback
    // for sub-state divisions like "Sector 1" → "București".
    const stateDistrictRaw = stripAdminPrefix(addr.state_district || "");

    let countyCode = COUNTY_NAME_TO_CODE[countyRaw]
      ?? COUNTY_NAME_TO_CODE[stateRaw]
      ?? COUNTY_NAME_TO_CODE[stateDistrictRaw]
      ?? null;

    // Bucharest-specific fallbacks: Nominatim returns the sector name
    // ("Sector 1") in `addr.county` for Bucharest streets, with the
    // city field as "București"/"Bucharest". When neither field maps
    // directly, infer from display_name or addr.city.
    if (!countyCode) {
      const looksLikeBucharest =
        /sector\s*\d/i.test(addr.county || "") ||
        /sector\s*\d/i.test(addr.city_district || "") ||
        /sector\s*\d/i.test(addr.suburb || "") ||
        /bucure[șs]ti|bucharest/i.test(addr.city || "") ||
        /bucure[șs]ti|bucharest/i.test(displayName);
      if (looksLikeBucharest) countyCode = "B";
    }

    // Last-ditch Haversine fallback: when Nominatim confirms Romania
    // (country_code === "ro") but stripped all admin levels — happens
    // for some smaller towns whose OSM record only has city/road/
    // postcode (Rădăuți was the canonical example). Pick the closest
    // county center. The country_code guard avoids accidentally
    // labeling Moldovan or Ukrainian border points as a Romanian
    // county.
    if (!countyCode && (addr.country_code ?? "").toLowerCase() === "ro") {
      countyCode = closestCountyCode(lat, lng);
    }

    const countyName = addr.county || addr.state || addr.state_district || null;

    // Extract locality
    const locality = addr.city || addr.town || addr.village || addr.municipality || null;

    // Detect sector — check EVERYWHERE in address and display_name
    let sector: string | null = null;
    const allText = `${addr.suburb || ""} ${addr.city_district || ""} ${addr.quarter || ""} ${displayName}`.toLowerCase();
    const sectorMatch = allText.match(/sector\s*(\d)/i);
    if (sectorMatch) {
      sector = `S${sectorMatch[1]}`;
    }

    // Extract street details
    const street = addr.road || addr.pedestrian || addr.footway || null;
    const houseNumber = addr.house_number || null;

    // Build clean short address: "Strada X nr. Y, Sector Z, București"
    const parts: string[] = [];
    if (street) {
      parts.push(houseNumber ? `${street} nr. ${houseNumber}` : street);
    }
    // Add sector for București
    if (sector) {
      parts.push(`Sector ${sector.replace("S", "")}`);
    }
    // Add locality
    if (countyCode === "B" || (locality && locality.toLowerCase().includes("bucurești"))) {
      parts.push("București");
    } else if (locality) {
      parts.push(locality);
    }
    const shortAddress = parts.length > 0 ? parts.join(", ") : displayName;

    return {
      countyCode,
      countyName,
      locality,
      sector,
      address: displayName,
      shortAddress,
      street,
      houseNumber,
    };
  } catch {
    return { countyCode: null, countyName: null, locality: null, sector: null, address: null, shortAddress: null, street: null, houseNumber: null };
  }
}

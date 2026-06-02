// Real emails of Bucharest authorities — verified public contacts

import { detectSectorFromText } from "./sector-detect";
import type { ParkingJurisdiction } from "./parking";
import {
  PRIMARII as COUNTY_PRIMARII,
  PREFECTURI as COUNTY_PREFECTURI,
  POLITIE as COUNTY_POLITIE,
  POLITIA_LOCALA_JUDET,
  findCityContact,
} from "@/data/autoritati-contact";

export interface Authority {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

// Central authorities
export const AUTH = {
  // 2026-06-02: relatiipublice@pmb.ro bounce persistent → sesizari@pmb.ro
  pmb: { id: "pmb", name: "Primăria Municipiului București", email: "sesizari@pmb.ro" },
  pmbDispecerat: { id: "pmb-dispecerat", name: "Dispecerat PMB", email: "dispecerat@pmb.ro" },
  pmbSesizari: { id: "pmb-sesizari", name: "Sesizări PMB", email: "sesizari@pmb.ro" },
  adminStrazi: { id: "admin-strazi", name: "Administrația Străzilor București", email: "office@aspmb.ro", phone: "021 315 1219" },
  brigadaRutiera: { id: "brigada-rutiera", name: "Brigada Rutieră București", email: "bpr@b.politiaromana.ro", phone: "021 9544" },
  politiaLocalaBuc: { id: "pl-bucuresti", name: "Poliția Locală București", email: "office@plmb.ro", phone: "021 9752" },
  apanova: { id: "apanova", name: "ApaNova", email: "clientsc@apanovabucuresti.ro" },
  alpab: { id: "alpab", name: "ALPAB", email: "alpab@alpab.ro" },
  stb: { id: "stb", name: "STB S.A.", email: "relatii.publice@stbsa.ro" },
  asau: { id: "asau", name: "ASAU (animale)", email: "asau@pmb.ro" },
  prefectura: { id: "prefectura", name: "Prefectura București", email: "prefectura@prefecturabucu.ro" },
  isu: { id: "isu", name: "ISU București", email: "112@isubif.ro" },
} as const;

// Primării de sector
export const PRIMARII_SECTOR: Record<string, Authority> = {
  S1: { id: "primarie-s1", name: "Primăria Sector 1", email: "registratura@primariasector1.ro" },
  S2: { id: "primarie-s2", name: "Primăria Sector 2", email: "infopublice@ps2.ro" },
  S3: { id: "primarie-s3", name: "Primăria Sector 3", email: "relatiipublice@primarie3.ro" },
  S4: { id: "primarie-s4", name: "Primăria Sector 4", email: "contact@ps4.ro" },
  // S5: sesizari@sector5.ro used to bounce ("adresa nu există").
  // Verified on sector5.ro/contacte — primarie@sector5.ro is the
  // canonical inbox. Kept here in PRIMARII_SECTOR even though the
  // parking path forces it anyway, so non-parking tip uses it too.
  S5: { id: "primarie-s5", name: "Primăria Sector 5", email: "primarie@sector5.ro" },
  S6: { id: "primarie-s6", name: "Primăria Sector 6", email: "prim6@primarie6.ro" },
};

// Poliția Locală per sector
export const POLITIA_LOCALA_SECTOR: Record<string, Authority> = {
  S1: { id: "pl-s1", name: "Poliția Locală Sector 1", email: "registratura@primariasector1.ro", phone: "021 9540" },
  // Sector 2 routes both Primăria + Poliția Locală pe aceeași adresă —
  // `infopublice@ps2.ro` e singura inbox publică PS2 confirmată; restul
  // (office@politialocalas2.ro, contact@…) bounce sau sunt simboluri.
  // Dedup-ul din `addTo` previne dublarea când ambele se adaugă la
  // aceeași sesizare.
  S2: { id: "pl-s2", name: "Poliția Locală Sector 2", email: "infopublice@ps2.ro", phone: "021 9941" },
  S3: { id: "pl-s3", name: "Poliția Locală Sector 3", email: "secretariat.dgpl@primarie3.ro", phone: "021 9543" },
  S4: { id: "pl-s4", name: "Poliția Locală Sector 4", email: "sesizari@politialocala4.ro", phone: "021 9441" },
  // S5: office@politialocalasector5.ro used to bounce. The working
  // inbox is politialocala@sector5.ro (verified on sector5.ro +
  // infocontact.ro listings). Phone dispatcher 24/7: 031 988 5.
  S5: { id: "pl-s5", name: "Poliția Locală Sector 5", email: "politialocala@sector5.ro", phone: "031 9885" },
  S6: { id: "pl-s6", name: "Poliția Locală Sector 6", email: "contact@politia6.ro", phone: "021 9546" },
};

export interface ResolvedRecipients {
  primary: Authority[]; // TO field
  cc: Authority[]; // CC field
  label: string;
}

/**
 * Parking-specific routing context. Passed in on the "parcare" branch so
 * the dispatcher can pick between Poliția Locală (trotuar/trecere) and
 * Brigada Rutieră (bandă/intersecție), and apply the Sector 5 email
 * override (their other inboxes return NXDOMAIN).
 */
export interface ParkingRoutingContext {
  jurisdiction?: ParkingJurisdiction | null;
}

/**
 * 2026-05-29 — Detecteaza daca descrierea + locatia indica un context de
 * politie (vehicul pe trotuar, soferi periculosi, politie care nu intervine,
 * incalcari rutiere, numere de inmatriculare raportate, etc.). Daca DA,
 * dispatcher-ul adauga Brigada Rutiera + Politia Locala chiar daca tip-ul
 * este "altele" sau "trotuar" (nu doar "parcare").
 *
 * Trigger din feedback Reddit (2026-05-29): user raporteaza masina pe trotuar
 * + politie care nu reactioneaza. Sesizarea „altele" routeaza doar la PMB +
 * sector — politia ramane in afara fluxului. Acum o detectam si o adaugam.
 */
export function detectsPoliceContext(
  descriere?: string | null,
  locationText?: string | null,
): { needsTraffic: boolean; needsLocal: boolean; reasons: string[] } {
  const text = `${descriere || ""} ${locationText || ""}`.toLowerCase();
  if (!text.trim()) return { needsTraffic: false, needsLocal: false, reasons: [] };

  const reasons: string[] = [];
  let needsTraffic = false; // Brigada Rutiera
  let needsLocal = false;   // Politia Locala

  // 1) Vehicul pe trotuar / pe pista bicicleta / pe carosabil unde nu trebuie
  const vehicleOnSidewalk =
    /(masin|auto|sofer|vehicul|camion|duba|tir|sw|suv)/i.test(text) &&
    /(pe trotuar|pe pieton|pe pista|pe carosabil|pe spatiu verde|pe zebra|pe trecere)/i.test(text);
  if (vehicleOnSidewalk) {
    needsLocal = true;
    needsTraffic = true;
    reasons.push("vehicul pe trotuar/pista/zebra");
  }

  // 2) Politie inactiune / ignora / trece prin fata / refuza interventie
  const policeInaction =
    /politi/i.test(text) &&
    /(ignor|salut|trecut prin fata|nu a reactionat|nu au reactionat|nu a facut nimic|nu au facut nimic|s-au intors|refuza|nepasator|nu a vrut|nu au vrut|degeaba)/i.test(text);
  if (policeInaction) {
    needsTraffic = true;
    needsLocal = true;
    reasons.push("inactiune politie raportata");
  }

  // 3) Numar de inmatriculare raportat (pattern românesc B-XXX-XXX sau B 38 BZD)
  const platePattern = /\b[a-z]{1,2}[\s-]?\d{1,3}[\s-]?[a-z]{3}\b/i;
  if (platePattern.test(text) && /(sofer|condus|masin|auto|viteza|incalca|trotuar|zebra|rosu|sens|interzis)/i.test(text)) {
    needsTraffic = true;
    reasons.push("numar inmatriculare raportat");
  }

  // 4) Incalcari rutiere explicite
  const trafficViolation =
    /(viteza|depasit|trec pe rosu|sens interzis|sens unic|interzis|stop ignor|stop nu a oprit|priorit|alcoo|drogu|fara permis|fara centura)/i.test(text);
  if (trafficViolation) {
    needsTraffic = true;
    reasons.push("incalcare rutiera");
  }

  // 5) Conduita periculoasa generala
  const dangerousConduct =
    /(periculos|teribilism|drifturi|cascadorii|ambala|tunat ilegal|zgomot esapament)/i.test(text) &&
    /(masin|auto|vehicul|moto)/i.test(text);
  if (dangerousConduct) {
    needsTraffic = true;
    reasons.push("conduita periculoasa");
  }

  return { needsTraffic, needsLocal, reasons };
}

/**
 * Returns the list of real authorities to contact based on problem type + sector + county.
 * For București: uses sector-specific authorities.
 * For other counties: uses county contacts from autoritati-contact.ts.
 */
export function getAuthoritiesFor(
  tip: string,
  sector: string | null,
  countyCode?: string | null,
  locationText?: string | null,
  parking?: ParkingRoutingContext,
  descriere?: string | null,
): ResolvedRecipients {
  // If not București, route to county authorities
  if (countyCode && countyCode !== "B") {
    return getCountyAuthorities(tip, countyCode, locationText, descriere);
  }
  const primary: Authority[] = [];
  const cc: Authority[] = [];

  // Helper: add unique
  const addTo = (a: Authority) => {
    if (!primary.find((x) => x.email === a.email)) primary.push(a);
  };
  const addCc = (a: Authority) => {
    if (!primary.find((x) => x.email === a.email) && !cc.find((x) => x.email === a.email)) cc.push(a);
  };

  // If form didn't set a sector, try to recover it from the location text
  // (e.g., "Str. Matei Voievod 12, Sector 3, București"). Without this the
  // sector-specific primării + poliții get silently skipped.
  const resolvedSector =
    (sector && sector.trim()) ||
    (locationText ? detectSectorFromText(locationText) : null) ||
    null;
  const sectorPrimarie = resolvedSector ? PRIMARII_SECTOR[resolvedSector] : null;
  const sectorPolitie = resolvedSector ? POLITIA_LOCALA_SECTOR[resolvedSector] : null;

  switch (tip) {
    case "groapa":
    case "trotuar":
      addTo(AUTH.adminStrazi);
      if (sectorPrimarie) addTo(sectorPrimarie);
      addTo(AUTH.pmb);
      addCc(AUTH.pmbDispecerat);
      break;

    case "iluminat":
      addTo(AUTH.pmb);
      addTo(AUTH.pmbDispecerat);
      if (sectorPrimarie) addTo(sectorPrimarie);
      break;

    case "copac":
      addTo(AUTH.alpab);
      addTo(AUTH.pmb);
      if (sectorPrimarie) addTo(sectorPrimarie);
      addCc(AUTH.isu);
      break;

    case "gunoi":
      if (sectorPrimarie) addTo(sectorPrimarie);
      addTo(AUTH.pmb);
      addCc(AUTH.pmbDispecerat);
      break;

    case "parcare": {
      // Jurisdiction split — the user told us whether the car blocks a
      // sidewalk/zebra ("trotuar") or a traffic lane / tram line
      // ("banda"). Poliția Locală handles the former, Brigada Rutieră
      // the latter. If no jurisdiction is set (legacy reports), we keep
      // the original fan-out.
      if (parking?.jurisdiction === "banda") {
        addTo(AUTH.brigadaRutiera);
        addTo(AUTH.politiaLocalaBuc);
        if (sectorPrimarie) addCc(sectorPrimarie);
        addCc(AUTH.pmb);
      } else {
        if (sectorPolitie) addTo(sectorPolitie);
        addTo(AUTH.politiaLocalaBuc);
        if (sectorPrimarie) addTo(sectorPrimarie);
        addCc(AUTH.pmb);
      }

      // Sector 5 exception: user reports that sesizari@sector5.ro
      // and office@politialocalasector5.ro bounce ("adresa nu
      // există"). Kept a DEAD_S5 blocklist that strips ONLY those
      // two specific addresses — the new PRIMARII_SECTOR.S5 and
      // POLITIA_LOCALA_SECTOR.S5 emails (primarie@sector5.ro and
      // politialocala@sector5.ro, verified on sector5.ro/contacte
      // in April 2026) survive. No broad @sector5.ro strip anymore.
      if (resolvedSector === "S5") {
        const DEAD_S5 = new Set([
          "sesizari@sector5.ro",
          "office@politialocalasector5.ro",
        ]);
        for (let i = primary.length - 1; i >= 0; i--) {
          const a = primary[i];
          if (a && DEAD_S5.has(a.email)) primary.splice(i, 1);
        }
        for (let i = cc.length - 1; i >= 0; i--) {
          const c = cc[i];
          if (c && DEAD_S5.has(c.email)) cc.splice(i, 1);
        }
      }
      break;
    }

    case "stalpisori":
      // User pref: all 6 destinatari în TO (nu în CC) — sesizarea
      // stâlpișori cere acțiune coordonată, nu informare pasivă.
      addTo(AUTH.brigadaRutiera);
      addTo(AUTH.pmb);               // relatiipublice@pmb.ro
      addTo(AUTH.politiaLocalaBuc);  // office@plmb.ro
      addTo(AUTH.adminStrazi);       // office@aspmb.ro
      if (sectorPolitie) addTo(sectorPolitie);
      if (sectorPrimarie) addTo(sectorPrimarie);
      break;

    case "canalizare":
      addTo(AUTH.apanova);
      addTo(AUTH.pmb);
      if (sectorPrimarie) addTo(sectorPrimarie);
      addCc(AUTH.pmbDispecerat);
      break;

    case "semafor":
      addTo(AUTH.brigadaRutiera);
      addTo(AUTH.adminStrazi);
      addTo(AUTH.pmb);
      if (sectorPrimarie) addCc(sectorPrimarie);
      break;

    case "pietonal":
      addTo(AUTH.brigadaRutiera);
      addTo(AUTH.adminStrazi);
      addTo(AUTH.pmb);
      if (sectorPrimarie) addCc(sectorPrimarie);
      break;

    case "graffiti":
      if (sectorPolitie) addTo(sectorPolitie);
      if (sectorPrimarie) addTo(sectorPrimarie);
      addTo(AUTH.pmb);
      break;

    case "mobilier":
      if (sectorPrimarie) addTo(sectorPrimarie);
      addTo(AUTH.pmb);
      break;

    case "zgomot":
      if (sectorPolitie) addTo(sectorPolitie);
      addTo(AUTH.politiaLocalaBuc);
      if (sectorPrimarie) addCc(sectorPrimarie);
      break;

    case "animale":
      addTo(AUTH.asau);
      addTo(AUTH.pmb);
      if (sectorPrimarie) addTo(sectorPrimarie);
      break;

    case "transport":
      addTo(AUTH.stb);
      addTo(AUTH.pmb);
      break;

    case "afisaj":
      // Afișaj/publicitate ilegală: Poliția Locală constată contravenția,
      // primăria emite autorizații + dispune înlăturarea, PMB pe domeniul
      // public general. Mash-publicitate pe stâlpi/copaci/garduri intră
      // tot aici.
      addTo(AUTH.politiaLocalaBuc);
      if (sectorPrimarie) addTo(sectorPrimarie);
      addTo(AUTH.pmb);
      break;

    case "altele":
    default:
      addTo(AUTH.pmb);
      if (sectorPrimarie) addTo(sectorPrimarie);
      addCc(AUTH.pmbDispecerat);
      addCc(AUTH.prefectura);
      break;
  }

  // 2026-05-29 — Auto-escalation politie. Daca descrierea/locatia indica
  // un context de politie (vehicul pe trotuar, politie inactiva, plate
  // raportata, incalcare rutiera, conduita periculoasa), adaugam Brigada
  // Rutiera + Politia Locala chiar daca tip-ul nu este parcare/trafic.
  // Trigger din feedback Reddit 2026-05-29.
  const police = detectsPoliceContext(descriere, locationText);
  if (police.needsTraffic) addTo(AUTH.brigadaRutiera);
  if (police.needsLocal) {
    if (sectorPolitie) addTo(sectorPolitie);
    addTo(AUTH.politiaLocalaBuc);
  }
  if (police.needsTraffic || police.needsLocal) {
    addCc(AUTH.prefectura); // oversight
  }

  // Build human-readable label
  const names = primary.map((a) => {
    // Shorten names for display
    if (a.name.startsWith("Primăria Sector")) return a.name.replace("Primăria ", "");
    if (a.name.startsWith("Primăria Municipiului")) return "PMB";
    if (a.name.startsWith("Administrația")) return a.name.replace("Administrația ", "");
    if (a.name.startsWith("Brigada")) return "Brigada Rutieră";
    if (a.name.startsWith("Poliția Locală")) return a.name.replace("Poliția Locală ", "PL ");
    return a.name;
  });
  const label = names.join(" + ") + (cc.length > 0 ? ` (+ ${cc.length} în CC)` : "");

  return { primary, cc, label };
}

/**
 * Route complaints to county-specific authorities for non-București locations.
 *
 * Routing priority:
 *   1. If the location text matches a non-capital city from ORASE_IMPORTANTE,
 *      route to that city's primărie + poliție locală (most specific).
 *   2. Otherwise route to the county reședință's primărie + POLITIA_LOCALA_JUDET.
 *   3. Prefectura always in CC (oversight authority).
 */
function getCountyAuthorities(
  tip: string,
  countyCode: string,
  locationText?: string | null,
  descriere?: string | null,
): ResolvedRecipients {
  const PRIMARII = COUNTY_PRIMARII;
  const PREFECTURI = COUNTY_PREFECTURI;
  const POLITIE = COUNTY_POLITIE;

  const primary: Authority[] = [];
  const cc: Authority[] = [];

  // 1. Try to match a non-capital city from the location text
  const cityMatch = locationText ? findCityContact(locationText, countyCode) : null;

  if (cityMatch) {
    const { slug, city } = cityMatch;
    // City-level routing takes precedence
    if (city.email) {
      primary.push({
        id: `primarie-${slug}`,
        name: `Primăria ${city.name}`,
        email: city.email,
        ...(city.phone ? { phone: city.phone } : {}),
      });
    }
    // For parcare/zgomot/graffiti/afisaj, add city's Poliția Locală if available
    if (
      ["parcare", "zgomot", "graffiti", "afisaj"].includes(tip) &&
      city.politieLocala?.email
    ) {
      primary.unshift({
        id: `pl-${slug}`,
        name: `Poliția Locală ${city.name}`,
        email: city.politieLocala.email,
        ...(city.politieLocala.phone ? { phone: city.politieLocala.phone } : {}),
      });
    }
  } else {
    // 2. County capital fallback
    const primarie = PRIMARII[countyCode];
    const politiaLocala = POLITIA_LOCALA_JUDET[countyCode];
    const politie = POLITIE[countyCode];

    if (primarie?.email) {
      primary.push({
        id: `primarie-${countyCode}`,
        name: `Primăria ${countyCode}`,
        email: primarie.email,
        ...(primarie.phone ? { phone: primarie.phone } : {}),
      });
    }

    // For parcare/zgomot/graffiti/afisaj/mobilier/gunoi, Poliția Locală takes
    // the TO slot; IPJ falls to CC (they only intervene on criminal matters).
    const plTags = new Set(["parcare", "zgomot", "graffiti", "afisaj", "mobilier", "gunoi"]);
    if (plTags.has(tip) && politiaLocala?.email) {
      primary.unshift({
        id: `pl-${countyCode}`,
        name: `Poliția Locală ${countyCode}`,
        email: politiaLocala.email,
        ...(politiaLocala.phone ? { phone: politiaLocala.phone } : {}),
      });
    }

    // IPJ in CC when tip is criminal-adjacent (parcare blocking access,
    // zgomot) — but most IPJ entries have no email, only phone.
    if (["parcare", "zgomot"].includes(tip) && politie?.email) {
      cc.push({ id: `politie-${countyCode}`, name: `IPJ ${countyCode}`, email: politie.email });
    }
  }

  // 3. Prefectura always in CC (oversight)
  const prefectura = PREFECTURI[countyCode];
  if (prefectura?.email) {
    cc.push({ id: `prefectura-${countyCode}`, name: `Prefectura ${countyCode}`, email: prefectura.email });
  }

  // 2026-05-29 — Auto-escalation politie (county-side). Daca descrierea
  // indica un context rutier, adauga IPJ + Politia Locala judet chiar
  // daca tip-ul nu este parcare/zgomot.
  const police = detectsPoliceContext(descriere, locationText);
  if (police.needsTraffic || police.needsLocal) {
    const politiaLocala = POLITIA_LOCALA_JUDET[countyCode];
    const politie = POLITIE[countyCode];
    if (police.needsLocal && politiaLocala?.email && !primary.find((x) => x.email === politiaLocala.email)) {
      primary.push({
        id: `pl-${countyCode}-auto`,
        name: `Poliția Locală ${countyCode}`,
        email: politiaLocala.email,
        ...(politiaLocala.phone ? { phone: politiaLocala.phone } : {}),
      });
    }
    if (police.needsTraffic && politie?.email && !primary.find((x) => x.email === politie.email) && !cc.find((x) => x.email === politie.email)) {
      primary.push({
        id: `politie-${countyCode}-auto`,
        name: `IPJ ${countyCode}`,
        email: politie.email,
      });
    }
  }

  // Fallback: if no specific contacts, generic
  if (primary.length === 0) {
    primary.push({ id: "generic", name: "Primăria locală", email: `registratura@primaria${countyCode.toLowerCase()}.ro` });
  }

  const names = primary.map((a) => a.name);
  const label = names.join(" + ") + (cc.length > 0 ? ` (+ ${cc.length} în CC)` : "");
  return { primary, cc, label };
}

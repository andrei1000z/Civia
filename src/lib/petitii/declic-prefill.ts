/**
 * Declic / CampaniaMea petition URL prefill builder.
 *
 * Declic folosește Vue + JSON config (ctrlshift platform). Form field names
 * (verificate live pe /petitions/<slug>, JSON `data-store-data.fields`):
 *
 *   firstName    — Prenume (required)
 *   lastName     — Nume de familie (required)
 *   email        — Adresa de e-mail (required)
 *   county       — Județ (select din lista RO: „Cluj", „BUCUREȘTI", ...)
 *   phoneNumber  — Număr de telefon (optional)
 *
 * URL-ul de bază (e.g. https://campaniamea.declic.ro/petitions/abc) primește
 * query params cu numele de mai sus, iar Vue-ul auto-completează inputs.
 * User-ul tot face click la „Semnează" pe site-ul Declic — NOI NU SEMNĂM,
 * doar reducem fricțiunea. Vezi eIDAS art. 3 pct. 10 + Termeni Declic.
 *
 * NB: nu funcționează pe alte platforme (Avaaz, Change.org). Pentru acelea
 * fallback la URL curat (= comportamentul de azi).
 */

export interface QuickSignData {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  county: string | null;
  phone: string | null;
}

/**
 * True dacă URL-ul e o petiție Declic — singura platformă unde prefill-ul
 * via params e suportat verificabil.
 */
export function isDeclicPetitionUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return /(^|\.)declic\.ro$/.test(u.hostname) || /(^|\.)de-clic\.ro$/.test(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Construiește URL-ul Declic cu TOATE variantele cunoscute de param pentru
 * sub-domeniile diferite Declic (campaniamea, noifacem, etc.) — fiecare are
 * propria denumire de câmpuri:
 *   campaniamea: firstName, lastName, email, county, phoneNumber
 *   noifacem:    firstname, lastname, emailaddress, region, postalcode
 *
 * Plus formatul Action Network legacy: signature[first_name].
 *
 * NB: testarea live (5/23/2026) a arătat că NICI un sub-domeniu nu citește
 * URL params automat — Declic prefill funcționează doar cu token CRM semnat.
 * Păstrăm params pentru viitor + ca user să-i vadă în URL că suntem
 * transparent ce date se trimit. Real prefill se face via bookmarklet
 * (vezi src/lib/petitii/declic-bookmarklet.ts).
 */
export function buildDeclicSignUrl(
  externalUrl: string,
  data: QuickSignData | null,
): string {
  if (!data || !isDeclicPetitionUrl(externalUrl)) return externalUrl;

  try {
    const url = new URL(externalUrl);

    // Variante pentru campaniamea.declic.ro (camelCase)
    if (data.firstName) url.searchParams.set("firstName", data.firstName);
    if (data.lastName) url.searchParams.set("lastName", data.lastName);
    if (data.email) url.searchParams.set("email", data.email);
    if (data.county) url.searchParams.set("county", data.county);
    if (data.phone) url.searchParams.set("phoneNumber", data.phone);

    // Variante pentru noifacem.declic.ro (lowercase)
    if (data.firstName) url.searchParams.set("firstname", data.firstName);
    if (data.lastName) url.searchParams.set("lastname", data.lastName);
    if (data.email) url.searchParams.set("emailaddress", data.email);
    // County → region: noifacem folosește „București" sentence-case în loc
    // de „BUCUREȘTI" all-caps. Convertim.
    if (data.county) {
      const region = data.county === "BUCUREȘTI" ? "București" : data.county;
      url.searchParams.set("region", region);
    }

    // Action Network legacy format (signature[...])
    if (data.firstName) url.searchParams.set("signature[first_name]", data.firstName);
    if (data.lastName) url.searchParams.set("signature[last_name]", data.lastName);
    if (data.email) url.searchParams.set("signature[email]", data.email);

    // UTM ca să trackuim conversion-urile via Civia (Declic Analytics permite).
    if (!url.searchParams.has("utm_source")) {
      url.searchParams.set("utm_source", "civia");
      url.searchParams.set("utm_medium", "quick-sign");
    }
    return url.toString();
  } catch {
    return externalUrl;
  }
}

/**
 * True dacă user are setul minim de date completat (nume + email) ca să
 * triggerăm prefill. County e recomandat dar nu blocant (poate alege manual).
 */
export function hasMinimumQuickSignData(data: QuickSignData | null): boolean {
  if (!data) return false;
  return Boolean(data.firstName && data.lastName && data.email);
}

/**
 * Lista exactă de județe pe care Declic le acceptă în câmpul `county`.
 * Folosită pe form-ul din /cont ca să nu lăsăm user-ul să introducă o
 * valoare invalidă. Match cu CHECK constraint din migration 062.
 */
export const DECLIC_COUNTIES = [
  "DIASPORA",
  "Alba",
  "Arad",
  "Argeș",
  "Bacău",
  "Bihor",
  "Bistrița-Năsăud",
  "Botoșani",
  "Brașov",
  "Brăila",
  "BUCUREȘTI",
  "Buzău",
  "Caraș-Severin",
  "Călărași",
  "Cluj",
  "Constanța",
  "Covasna",
  "Dâmbovița",
  "Dolj",
  "Galați",
  "Giurgiu",
  "Gorj",
  "Harghita",
  "Hunedoara",
  "Ialomița",
  "Iași",
  "Ilfov",
  "Maramureș",
  "Mehedinți",
  "Mureș",
  "Neamț",
  "Olt",
  "Prahova",
  "Satu Mare",
  "Sălaj",
  "Sibiu",
  "Suceava",
  "Teleorman",
  "Timiș",
  "Tulcea",
  "Vaslui",
  "Vâlcea",
  "Vrancea",
] as const;

export type DeclicCounty = typeof DECLIC_COUNTIES[number];

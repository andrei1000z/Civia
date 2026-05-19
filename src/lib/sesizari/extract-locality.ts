/**
 * Extrage DOAR localitatea/sectorul dintr-o adresa de domiciliu.
 *
 * Folosit cand persistăm partial-info despre un cosigner: vrem să arătăm
 * „un cetățean din Sector 5" / „din Cluj-Napoca" public, dar NU adresa
 * stradală completă (street + nr).
 *
 * Bug fix (5/19/2026): inainte trimiteam adresa intreaga ca `city`
 * (ex: „Strada Novaci 12, Sector 5") si se afisa public in
 * CosignersBadge. Acum extragem doar localitatea.
 *
 * Strategie:
 *   1. Cauta „Sector N" → returneaza acela (Bucuresti).
 *   2. Cauta segmente bine-cunoscute (orase mari, capitale judet).
 *   3. Daca adresa are virgule, ia ultimul segment (ex „Str. X 12,
 *      Cluj-Napoca" → „Cluj-Napoca").
 *   4. Fallback: null (nu inventam — mai bine nimic decat strada).
 */

/**
 * Mapping de la varianta-de-recunoastere (lowercase, cu/fara diacritice)
 * la forma canonica returnata. Iteram ordered-by-length-desc ca sa
 * preferam „cluj-napoca" peste „cluj" (substring match).
 */
const CITY_CANON: Array<[string, string]> = [
  ["bucurești", "București"], ["bucuresti", "București"],
  ["cluj-napoca", "Cluj-Napoca"],
  ["timișoara", "Timișoara"], ["timisoara", "Timișoara"],
  ["constanța", "Constanța"], ["constanta", "Constanța"],
  ["brașov", "Brașov"], ["brasov", "Brașov"],
  ["galați", "Galați"], ["galati", "Galați"],
  ["ploiești", "Ploiești"], ["ploiesti", "Ploiești"],
  ["brăila", "Brăila"], ["braila", "Brăila"],
  ["pitești", "Pitești"], ["pitesti", "Pitești"],
  ["bacău", "Bacău"], ["bacau", "Bacău"],
  ["târgu mureș", "Târgu Mureș"], ["targu mures", "Târgu Mureș"],
  ["baia mare", "Baia Mare"],
  ["buzău", "Buzău"], ["buzau", "Buzău"],
  ["botoșani", "Botoșani"], ["botosani", "Botoșani"],
  ["satu mare", "Satu Mare"],
  ["râmnicu vâlcea", "Râmnicu Vâlcea"], ["ramnicu valcea", "Râmnicu Vâlcea"],
  ["drobeta-turnu severin", "Drobeta-Turnu Severin"], ["drobeta turnu severin", "Drobeta-Turnu Severin"],
  ["piatra neamț", "Piatra Neamț"], ["piatra neamt", "Piatra Neamț"],
  ["târgu jiu", "Târgu Jiu"], ["targu jiu", "Târgu Jiu"],
  ["focșani", "Focșani"], ["focsani", "Focșani"],
  ["bistrița", "Bistrița"], ["bistrita", "Bistrița"],
  ["reșița", "Reșița"], ["resita", "Reșița"],
  ["călărași", "Călărași"], ["calarasi", "Călărași"],
  ["alba iulia", "Alba Iulia"],
  ["zalău", "Zalău"], ["zalau", "Zalău"],
  ["sfântu gheorghe", "Sfântu Gheorghe"], ["sfantu gheorghe", "Sfântu Gheorghe"],
  ["bârlad", "Bârlad"], ["barlad", "Bârlad"],
  ["mediaș", "Mediaș"], ["medias", "Mediaș"],
  ["făgăraș", "Făgăraș"], ["fagaras", "Făgăraș"],
  ["onești", "Onești"], ["onesti", "Onești"],
  ["pașcani", "Pașcani"], ["pascani", "Pașcani"],
  ["miercurea ciuc", "Miercurea Ciuc"],
  ["râmnicu sărat", "Râmnicu Sărat"], ["ramnicu sarat", "Râmnicu Sărat"],
  ["săcele", "Săcele"], ["sacele", "Săcele"],
  ["curtea de argeș", "Curtea de Argeș"], ["curtea de arges", "Curtea de Argeș"],
  ["sighetu marmației", "Sighetu Marmației"], ["sighetu marmatiei", "Sighetu Marmației"],
  ["petroșani", "Petroșani"], ["petrosani", "Petroșani"],
  ["câmpulung", "Câmpulung"], ["campulung", "Câmpulung"],
  ["câmpina", "Câmpina"], ["campina", "Câmpina"],
  // Variante scurte — DUPA cele lungi ca sa nu colideze cu „Cluj-Napoca".
  ["iași", "Iași"], ["iasi", "Iași"],
  ["cluj", "Cluj-Napoca"],
  ["craiova", "Craiova"],
  ["oradea", "Oradea"],
  ["arad", "Arad"],
  ["sibiu", "Sibiu"],
  ["suceava", "Suceava"],
  ["tulcea", "Tulcea"],
  ["slatina", "Slatina"],
  ["giurgiu", "Giurgiu"],
  ["deva", "Deva"],
  ["hunedoara", "Hunedoara"],
  ["roman", "Roman"],
  ["turda", "Turda"],
  ["slobozia", "Slobozia"],
  ["alexandria", "Alexandria"],
  ["vaslui", "Vaslui"],
  ["lugoj", "Lugoj"],
  ["mangalia", "Mangalia"],
  ["tecuci", "Tecuci"],
  ["caracal", "Caracal"],
  ["reghin", "Reghin"],
  ["mioveni", "Mioveni"],
  ["voluntari", "Voluntari"],
];

// Sortat o singura data la modulul-load (longest-first) ca sa preferam
// match-uri specifice peste cele scurte (ex „Cluj-Napoca" inainte de „Cluj").
const CITY_CANON_SORTED = [...CITY_CANON].sort((a, b) => b[0].length - a[0].length);

/** Sector București (1-6). */
const SECTOR_RE = /\bSector\s*([1-6])\b/i;

export function extractLocality(address: string | null | undefined): string | null {
  if (!address) return null;
  const trimmed = address.trim();
  if (trimmed.length === 0) return null;

  // 1. Sector București
  const sectorMatch = trimmed.match(SECTOR_RE);
  if (sectorMatch) {
    return `Sector ${sectorMatch[1]}`;
  }

  // 2. Match pe orașe cunoscute (case-insensitive, varianta cu/fara
  //    diacritice). Iteram longest-first ca sa preferam „Cluj-Napoca"
  //    peste „Cluj" cand ambele apar in mapping.
  const lowered = trimmed.toLowerCase();
  for (const [variant, canonical] of CITY_CANON_SORTED) {
    if (lowered.includes(variant)) {
      return canonical;
    }
  }

  // 3. Daca exista virgule, presupunem „Strada X nr Y, ORAS" si luam ultimul
  //    segment, dar DOAR daca segmentul nu pare strada (nu contine cifre, nu
  //    incepe cu „Str/Bd/Ale/Bld").
  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]!;
    if (
      !/\d/.test(last) &&
      !/^(str\.?|strada|bd\.?|bulevardul|ale\.?|aleea|bld\.?|șos\.?|sos\.?|șoseaua|soseaua|cal\.?|calea|piața|piata|spl\.?|splaiul|intr\.?|intrarea)/i.test(last) &&
      last.length <= 40
    ) {
      return last;
    }
  }

  // 4. Fallback: NU inventam. Mai bine null decat sa expunem adresa.
  return null;
}

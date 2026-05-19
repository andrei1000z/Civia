import { SESIZARE_STATUS_META, SESIZARE_STATUS_VALUES } from "./sesizari/status";

export const SITE_NAME = "Civia";
export const SITE_TAGLINE = "Sesizări civice gratuite, cu AI";
export const SITE_DESCRIPTION =
  "Trimite o sesizare formală la primărie în 2 minute. AI-ul scrie textul, alegem autoritatea corectă, tu urmărești răspunsul. Gratuit, pentru toate cele 42 de județe.";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://civia.ro";

// Romania geographic center + bounds
export const ROMANIA_CENTER: [number, number] = [45.9432, 24.9668];
export const ROMANIA_BOUNDS: [[number, number], [number, number]] = [
  [43.5, 20.2],
  [48.3, 30.0],
];

// București geographic center (fallback for București-specific features)
export const BUCHAREST_CENTER: [number, number] = [44.4268, 26.1025];
export const BUCHAREST_BOUNDS: [[number, number], [number, number]] = [
  [44.33, 25.97],
  [44.55, 26.25],
];

// File upload limits — single source of truth, folosite în
// /api/upload route + PhotoUploader / ParkingProofUploader compress logic.
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const COMPRESS_THRESHOLD_BYTES = 1.5 * 1024 * 1024; // 1.5 MB
export const MAX_IMAGE_DIMENSION = 1920;

// QR generator service — folosit în ShareMenu pentru sesizări.
// goqr.me e gratuit, fără tracking, returnează PNG (300x300 default).
export const QR_API_BASE_URL = "https://api.qrserver.com/v1/create-qr-code/";

// Categorii pentru petiții civice — listă predefinită ca admin să nu
// inventeze 100 de categorii diferite. Folosit în /admin/petitii dropdown.
export const PETITIE_CATEGORII = [
  { value: "Mediu", label: "Mediu și natură", icon: "🌳" },
  { value: "Transport", label: "Transport public și mobilitate", icon: "🚇" },
  { value: "Sănătate", label: "Sănătate publică", icon: "🏥" },
  { value: "Educație", label: "Educație", icon: "🎓" },
  { value: "Drepturi", label: "Drepturile cetățeanului", icon: "⚖️" },
  { value: "Locuințe", label: "Locuințe și urbanism", icon: "🏘️" },
  { value: "Siguranță", label: "Siguranță publică", icon: "🛡️" },
  { value: "Justiție", label: "Justiție și anti-corupție", icon: "⚖️" },
  { value: "Cultură", label: "Cultură și patrimoniu", icon: "🎭" },
  { value: "Tehnologie", label: "Tehnologie și open data", icon: "💻" },
  { value: "Animale", label: "Drepturile animalelor", icon: "🐾" },
  { value: "Egalitate", label: "Egalitate și non-discriminare", icon: "🤝" },
  { value: "Economie", label: "Economie și taxe", icon: "💰" },
  { value: "Altele", label: "Alte cauze civice", icon: "📝" },
] as const;

// ============================================================
// NAVIGATION — main links + "Mai mult" dropdown + date publice submenu
// ============================================================
// Top-level navigation. `national: true` means the link is always
// rendered as the bare /route — never prefixed with /[judet]/ even if
// the user has a county selected. Used for routes that don't have a
// county-scoped counterpart (or where the national view is the only
// useful one — e.g. /petitii is a national civic petition catalog).
// Round 2026-05-04: NAV simplificat dramatic la cererea user-ului.
// Eliminat updateuri/statistici/compara/cum-functioneaza/bilete/
// accesibilitate/impact (toate pagini dezintegrate). Proteste +
// Întreruperi promovate din dropdown la top-level. Search scos din
// navbar (rămâne ⌘K disponibil prin shortcut).
export const NAV_LINKS = [
  { href: "/sesizari", label: "Sesizări", national: true },
  { href: "/petitii", label: "Petiții", national: true },
  { href: "/proteste", label: "Proteste", national: true },
  { href: "/stiri", label: "Știri" },
  { href: "/ghiduri", label: "Ghiduri", national: true },
] as const;

// „Explorează" dropdown: items care nu se incarca in top-level, dar
// raman accesibile. Mai bine ascuns aici decat lipsa cu totul.
export const NAV_MORE: Array<{
  href: string;
  label: string;
  icon: string;
  nationalOnly?: boolean;
  countyOnly?: boolean;
  /**
   * Cand e setat true, ruta finala in Navbar e `{href}/{countySlug}` (NU
   * `/{countySlug}{href}` — comportamentul default). Util pentru rute
   * gen /intreruperi care detin propriul namespace pentru judete.
   */
  countySuffix?: boolean;
}> = [
  { href: "/intreruperi", label: "Întreruperi planificate", icon: "⚡", countySuffix: true },
  { href: "/clasament", label: "Clasament Fix Score", icon: "🏆", nationalOnly: true },
  { href: "/judete", label: "Toate județele", icon: "🗺️", nationalOnly: true },
  { href: "/autoritati", label: "Autorități publice", icon: "🏛️", nationalOnly: true },
];
export const NAV_DATE_PUBLICE: Array<{ href: string; label: string; icon: string }> = [];

export const GHID_DROPDOWN = [
  // Ordered by urgency / usefulness: sesizări (the core action) first,
  // then emergency guides (cutremur), then rights (amendă / 544), then
  // civic-engagement (ONG / dezbatere), then practical (bilete / vară).
  { href: "/ghiduri/ghid-sesizari", label: "Cum faci o sesizare eficientă", icon: "📮" },
  { href: "/ghiduri/ghid-contestatie-amenda", label: "Cum contești o amendă", icon: "⚖️" },
  { href: "/ghiduri/ghid-legea-544", label: "Cere informații publice (Legea 544)", icon: "🔓" },
  { href: "/ghiduri/ghid-cetatean", label: "Drepturile cetățeanului", icon: "📜" },
  { href: "/ghiduri/ghid-ajutor-social", label: "Ajutoare sociale de la stat", icon: "💰" },
  { href: "/ghiduri/ghid-ong", label: "Cum înființezi un ONG", icon: "🤝" },
  { href: "/ghiduri/ghid-dezbatere-publica", label: "Dezbateri publice (Legea 52)", icon: "💬" },
  { href: "/ghiduri/ghid-cutremur", label: "Pregătire cutremur", icon: "🌍" },
  { href: "/ghiduri/ghid-vara", label: "Ghid de caniculă și vară", icon: "☀️" },
  { href: "/ghiduri/ghid-transport", label: "Transport public", icon: "🚇" },
  { href: "/ghiduri/ghid-biciclist", label: "Ghidul biciclistului", icon: "🚲" },
] as const;

// ============================================================
// SESIZARE TYPES + SECTORS (sectors = București only)
// ============================================================
// `short` fits in tight chip-grid layouts (4-col on xs); `label` is the
// full name shown in selects, headers, and emails.
//
// `active: false` = tip DEPRECATED — nu se mai arata in form picker
// dar e pastrat pentru backwards-compat cu sesizari existente in DB
// (filter/sort/export/admin ramane functional pe tipul vechi).
//
// 2026-05-18: scoase din form picker `animale`, `pietonal`, `zgomot`
// (utilizare scazuta + ambiguu — primaria nu poate face mult pe astea).
// Adaugate: `banda_transport`, `trecere_pietoni`, `rampa_acces`,
// `colectare_selectiva`. `altele` ramane ca fallback + AI auto-eticheteaza
// in `custom_category`.
export const SESIZARE_TIPURI = [
  { value: "groapa", label: "Groapă în asfalt", short: "Groapă", icon: "🕳️", active: true },
  { value: "trotuar", label: "Trotuar degradat", short: "Trotuar", icon: "🧱", active: true },
  { value: "iluminat", label: "Iluminat public defect", short: "Iluminat", icon: "💡", active: true },
  { value: "copac", label: "Copac căzut/periculos", short: "Copac", icon: "🌳", active: true },
  { value: "gunoi", label: "Gunoi necolectat", short: "Gunoi", icon: "🗑️", active: true },
  { value: "parcare", label: "Parcare ilegală", short: "Parcare", icon: "🚗", active: true },
  { value: "stalpisori", label: "Montare stâlpișori anti-parcare", short: "Stâlpișori", icon: "🪧", active: true },
  { value: "canalizare", label: "Canalizare/inundație", short: "Canalizare", icon: "💧", active: true },
  { value: "semafor", label: "Semafor/semnalizare defect", short: "Semafor", icon: "🚦", active: true },
  { value: "graffiti", label: "Graffiti/vandalism", short: "Graffiti", icon: "🎨", active: true },
  { value: "mobilier", label: "Mobilier stradal stricat", short: "Mobilier", icon: "🪑", active: true },
  { value: "transport", label: "Problemă transport public", short: "Transport", icon: "🚌", active: true },
  { value: "afisaj", label: "Afișaj/publicitate ilegală", short: "Afișaj", icon: "📢", active: true },
  // Tipuri NOI — propuneri de amenajare/creare (nu probleme, ci cereri).
  { value: "banda_transport", label: "Bandă transport public — cerere", short: "Bandă bus", icon: "🚌", active: true },
  { value: "trecere_pietoni", label: "Trecere pietoni — cerere amenajare", short: "Zebră nouă", icon: "🚸", active: true },
  { value: "rampa_acces", label: "Rampă acces persoane cu dizabilități", short: "Rampă", icon: "♿", active: true },
  { value: "colectare_selectiva", label: "Colectare selectivă — container lipsă", short: "Reciclare", icon: "♻️", active: true },
  { value: "fumat_interzis", label: "Fumat în locuri interzise (Legea 15/2016)", short: "Fumat", icon: "🚭", active: true },
  // DEPRECATED — pastrat pentru compat. NU apar in form.
  { value: "pietonal", label: "Traversare pietoni periculoasă", short: "Pietonal", icon: "🚸", active: false },
  { value: "zgomot", label: "Zgomot excesiv/deranj", short: "Zgomot", icon: "🔊", active: false },
  { value: "animale", label: "Câini periculoși/animale", short: "Animale", icon: "🐕", active: false },
  // FALLBACK — cand niciunul nu se potriveste. AI auto-genereaza
  // custom_category dinăuntru.
  { value: "altele", label: "Altele (categoria se creează automat din descriere)", short: "Altele", icon: "📝", active: true },
] as const;

/** Tipuri vizibile in form picker. */
export const SESIZARE_TIPURI_ACTIVE = SESIZARE_TIPURI.filter((t) => t.active !== false);

// Sectoare — doar pentru municipiul București
export const SECTOARE = [
  { id: "S1", label: "Sector 1" },
  { id: "S2", label: "Sector 2" },
  { id: "S3", label: "Sector 3" },
  { id: "S4", label: "Sector 4" },
  { id: "S5", label: "Sector 5" },
  { id: "S6", label: "Sector 6" },
] as const;

export const METRO_COLORS: Record<string, string> = {
  M1: "#F7941D",
  M2: "#005CA9",
  M3: "#E4022E",
  M4: "#00A650",
  M5: "#663399",
};

// STATUS_COLORS / STATUS_LABELS provin din `SESIZARE_STATUS_META`
// (src/lib/sesizari/status.ts) ca să avem o singură sursă pentru
// label / culoare / hint / emoji per status. Restul codului care a
// citit STATUS_COLORS[s] / STATUS_LABELS[s] continuă să meargă fără
// modificări.
export const STATUS_COLORS: Record<string, string> = Object.fromEntries(
  SESIZARE_STATUS_VALUES.map((s) => [s, SESIZARE_STATUS_META[s].color]),
);

export const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  SESIZARE_STATUS_VALUES.map((s) => [s, SESIZARE_STATUS_META[s].label]),
);

// Brand colors per news source. Picked to match each outlet's actual
// visual identity so the badge / gradient on a card reads like the
// real outlet at a glance:
//   Digi24 = red (their on-air red)
//   Hotnews = yellow (signature yellow logo)
//   G4Media = black (logotype is black on white)
//   Mediafax = blue (logo blue)
//   News.ro = green (logo green)
// Locals get distinct accent colors so they don't all look the same
// on county pages.
export const SOURCE_COLORS: Record<string, string> = {
  // National wire-service tier — colors match each outlet's actual
  // brand kit (cross-checked against logos / mastheads as of 2026-05).
  "Digi24": "#005DAA",          // Digi24 corporate blue — the wordmark sits on blue, the "24" accent is red but the brand is blue
  "Hotnews": "#F59E0B",          // signature golden-orange yellow (not lemon)
  "G4Media": "#0A0A0A",          // near-black wordmark on white
  "Mediafax": "#003D7A",         // deep navy — Mediafax masthead
  "News.ro": "#16A34A",          // green-600
  "Libertatea": "#ED1C24",       // bright red — slightly distinct from Digi
  "Adevărul": "#1E3A8A",         // navy — Adevărul masthead
  "Gândul": "#DB2777",           // hot pink/magenta — current Gândul brand (was teal — wrong)
  // National investigative + independent
  "PressOne": "#7C3AED",         // violet — PressOne brand accent
  "Spotmedia": "#EA580C",        // orange — Spotmedia accent dot (was sky blue — wrong)
  "Europa Liberă": "#0067B1",    // RFE/RL royal blue
  "Recorder": "#DC2626",         // RED — Recorder logo (was orange — wrong)
  // Business / specialist
  "Ziarul Financiar": "#E11D48", // ZF salmon-rose masthead
  // Long-tail aggregators
  "Ediția de Dimineață": "#F59E0B",
  "Știri din România": "#475569",
  // Local — kept distinct per county for badge contrast
  "B365.ro": "#10B981",
  "Alba24": "#06B6D4",
  "Ziarul Unirea": "#0891B2",
  "Aradon": "#F97316",
  "Jurnalul de Argeș": "#84CC16",
  "Deșteptarea": "#0D9488",
  "Bihon": "#A855F7",
  "Gazeta de Bistrița": "#65A30D",
  "Monitorul BT": "#8B5CF6",
  "Obiectiv BR": "#EAB308",
  "BizBrașov": "#059669",
  "Opinia Buzău": "#DB2777",
  "Monitorul CJ": "#7C3AED",
  "Știri de Cluj": "#A855F7",
  "Actual de Cluj": "#9333EA",
  "Telegraf": "#0284C7",
  "Ziua de Constanța": "#0369A1",
  "Gazeta de Sud": "#B91C1C",
  "Replica HD": "#9F1239",
  "Ziarul de Iași": "#6366F1",
  "BZI": "#4F46E5",
  "7Iași": "#7C3AED",
  "eMaramureș": "#15803D",
  "Zi de Zi": "#C2410C",
  "Monitorul NT": "#5B21B6",
  "Observatorul PH": "#0E7490",
  "Gazeta Nord-Vest": "#7E22CE",
  "Turnul Sfatului": "#1D4ED8",
  "Tribuna": "#1E40AF",
  "Monitorul SV": "#14B8A6",
  "News Bucovina": "#0F766E",
  "Opinia Timișoarei": "#EC4899",
  "PressAlert": "#DB2777",
  "TION": "#BE185D",
  "Monitorul VN": "#9333EA",
  // Legacy entries kept for historical badge rendering
  "Știri Suceava": "#14B8A6",
  "Gazeta BT": "#8B5CF6",
};

/**
 * Picks a foreground color (near-black or white) that stays readable
 * over the given background. Hotnews's signature yellow badge would
 * be invisible with white text — this helper returns dark text in
 * that case, white for the rest. Threshold tuned so yellow/lime
 * pick dark, everything else picks white.
 */
export function readableTextColor(bgHex: string): string {
  const hex = bgHex.replace("#", "");
  if (hex.length !== 6) return "white";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Relative luminance per WCAG-ish weights. >0.6 = pale → use dark.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#0A0A0A" : "white";
}

// Mid-tone substitutes for sources whose brand color in SOURCE_COLORS
// has poor contrast when used as plain text on a neutral surface in
// at least one theme. Hotnews yellow-400 disappears on light surface;
// G4Media near-black disappears on dark surface. Use these only for
// `style={{ color: ... }}` text rendering — Badge components should
// keep using SOURCE_COLORS + readableTextColor() for their solid bg.
//
// Picked slate-400 (#94A3B8, luminance ~0.62) for G4Media — readable
// on dark surfaces (the homepage StiriWidget runs on a dark band) and
// still acceptable on light. Slate-500 was too dark on dark surfaces.
const SOURCE_TEXT_OVERRIDES: Record<string, string> = {
  "Hotnews": "#CA8A04",  // yellow-600 — readable on both light and dark
  "G4Media": "#94A3B8",  // slate-400 — neutral; "black wordmark" can't render as black on dark
};

export function sourceTextColor(source: string): string {
  return SOURCE_TEXT_OVERRIDES[source] ?? SOURCE_COLORS[source] ?? "#64748b";
}

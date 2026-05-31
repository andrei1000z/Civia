/**
 * 🎁 MEDIUM #17 — Multilang RO + HU + UK.
 *
 * Lightweight i18n fără next-intl dependency (bundle bloat).
 * UI strings esentiale traduse manual + AI prompts adapted la locale.
 *
 * Cookie `civia-locale` cu valori 'ro' | 'hu' | 'uk'. Server reads → passes
 * to client. Browser detect fallback.
 */

export type Locale = "ro" | "hu" | "uk";

export const LOCALES: Locale[] = ["ro", "hu", "uk"];

export const LOCALE_NAMES: Record<Locale, string> = {
  ro: "Română",
  hu: "Magyar",
  uk: "Українська",
};

export const LOCALE_FLAGS: Record<Locale, string> = {
  ro: "🇷🇴",
  hu: "🇭🇺",
  uk: "🇺🇦",
};

type MessageDict = Record<string, string>;

const RO: MessageDict = {
  "nav.sesizari": "Sesizări",
  "nav.petitii": "Petiții",
  "nav.stiri": "Știri",
  "nav.proteste": "Proteste",
  "nav.exploreaza": "Explorează",
  "common.submit": "Trimite",
  "common.cancel": "Anulează",
  "common.loading": "Se încarcă...",
  "common.error": "A apărut o eroare",
  "sesizari.cta.hero": "Fă o sesizare",
  "sesizari.cta.submit": "Trimite sesizarea",
  "sesizari.cta.card": "Vezi detalii",
  "petitii.cta.sign": "Semnează petiția",
  "petitii.cta.share": "Distribuie",
  "calendar.title": "Calendar civic",
  "calendar.export": "Export iCal",
  "footer.about": "Despre Civia",
  "footer.privacy": "Confidențialitate",
};

const HU: MessageDict = {
  "nav.sesizari": "Bejelentések",
  "nav.petitii": "Petíciók",
  "nav.stiri": "Hírek",
  "nav.proteste": "Tüntetések",
  "nav.exploreaza": "Felfedezés",
  "common.submit": "Küldés",
  "common.cancel": "Mégse",
  "common.loading": "Betöltés...",
  "common.error": "Hiba történt",
  "sesizari.cta.hero": "Bejelentés készítése",
  "sesizari.cta.submit": "Bejelentés elküldése",
  "sesizari.cta.card": "Részletek",
  "petitii.cta.sign": "Petíció aláírása",
  "petitii.cta.share": "Megosztás",
  "calendar.title": "Polgári naptár",
  "calendar.export": "iCal exportálás",
  "footer.about": "A Civiáról",
  "footer.privacy": "Adatvédelem",
};

const UK: MessageDict = {
  "nav.sesizari": "Звернення",
  "nav.petitii": "Петиції",
  "nav.stiri": "Новини",
  "nav.proteste": "Протести",
  "nav.exploreaza": "Дослідити",
  "common.submit": "Надіслати",
  "common.cancel": "Скасувати",
  "common.loading": "Завантаження...",
  "common.error": "Сталася помилка",
  "sesizari.cta.hero": "Створити звернення",
  "sesizari.cta.submit": "Надіслати звернення",
  "sesizari.cta.card": "Деталі",
  "petitii.cta.sign": "Підписати петицію",
  "petitii.cta.share": "Поділитися",
  "calendar.title": "Громадянський календар",
  "calendar.export": "Експорт iCal",
  "footer.about": "Про Civia",
  "footer.privacy": "Конфіденційність",
};

const DICTIONARIES: Record<Locale, MessageDict> = { ro: RO, hu: HU, uk: UK };

/**
 * Get translation pentru un key + locale.
 * Fallback la RO daca lipseste in locale specificat.
 */
export function t(key: string, locale: Locale = "ro"): string {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES.ro;
  return dict[key] ?? DICTIONARIES.ro[key] ?? key;
}

/**
 * Determina locale-ul activ din Accept-Language sau cookie.
 */
export function detectLocale(acceptLanguage: string | null, cookieValue: string | null): Locale {
  if (cookieValue && LOCALES.includes(cookieValue as Locale)) {
    return cookieValue as Locale;
  }
  if (!acceptLanguage) return "ro";
  // Parse Accept-Language: cauta hu, uk, ro in order of preference
  const langs = acceptLanguage.split(",").map((l) => (l.split(";")[0] ?? "").trim().toLowerCase());
  for (const lang of langs) {
    if (lang.startsWith("hu")) return "hu";
    if (lang.startsWith("uk")) return "uk";
    if (lang.startsWith("ro")) return "ro";
  }
  return "ro";
}

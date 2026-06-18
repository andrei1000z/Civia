/**
 * CTA copy constants — single source of truth pentru toate textele
 * call-to-action din UI. Standardizat (P2.454) ca să eliminăm:
 * „Trimite" / „Trimite acum" / „Send" / „Submit" / „Distribuie" / „Share"
 * inconsistente cross-component.
 *
 * Voice: civic-prietenos, „tu", direct.
 * Imperativ pe acțiune (Trimite, Semnează, Distribuie).
 * Descriptiv pe link-uri (Vezi sesizarea, Vezi detalii).
 */

export const CTA = {
  // Sesizare flow
  SESIZARE_HERO: "Fă o sesizare acum",
  SESIZARE_HERO_SHORT: "Fă o sesizare",
  SESIZARE_FORM_SUBMIT: "Trimite sesizarea",
  SESIZARE_FORM_SUBMITTING: "Trimit sesizarea...",
  SESIZARE_VIEW: "Vezi sesizarea",
  SESIZARE_SEND_VIA_CIVIA: "Trimite oficial cu Civia",

  // Petitii
  PETITIE_HERO: "Vezi petițiile civice",
  PETITIE_SIGN: "Semnează acum",
  PETITIE_SIGNING: "Semnez...",
  PETITIE_INITIATE: "Inițiază o petiție",
  PETITIE_VIEW: "Vezi petiția",

  // Proteste
  PROTEST_VIEW: "Vezi protestul",
  PROTEST_PROPOSE: "Propune un protest",

  // Share & social
  SHARE: "Distribuie",
  SHARE_WHATSAPP: "Trimite pe WhatsApp",
  SHARE_TELEGRAM: "Trimite pe Telegram",
  SHARE_LINKEDIN: "Distribuie pe LinkedIn",
  SHARE_TWITTER: "Postează pe X",
  SHARE_FACEBOOK: "Distribuie pe Facebook",
  COPY_LINK: "Copiază link",
  COPY_LINK_COPIED: "Link copiat ✓",

  // Generic
  BACK: "Înapoi",
  NEXT: "Continuă",
  CANCEL: "Anulează",
  SAVE: "Salvează",
  SAVING: "Salvez...",
  SAVED: "✓ Salvat",
  DELETE: "Șterge",
  DELETING: "Șterg...",
  EDIT: "Editează",
  CONFIRM: "Confirm",
  RETRY: "Reîncearcă",
  CLOSE: "Închide",
  LOAD_MORE: "Mai multe",
  SEE_ALL: "Vezi toate",
  DETAILS: "Vezi detalii",

  // Auth
  LOGIN: "Loghează-te",
  LOGOUT: "Ieși din cont",
  SIGNUP: "Creează cont",

  // Engagement
  VOTE_UP: "Mă afectează și pe mine",
  VOTE_DOWN: "Nu cred că e o problemă reală",
  COSIGN: "Co-semnează",
  FOLLOW: "Urmărește",
  UNFOLLOW: "Nu mai urmări",
  REPORT_SIMILAR: "Raportează o problemă similară",
} as const;

/**
 * Loading messages — variante prietenoase per context, în loc de „Loading...".
 * (P2.487)
 */
export const LOADING_MSG = {
  SESIZARI: "Caut sesizările tale...",
  PETITII: "Încarc petițiile civice...",
  PROTESTE: "Verific protestele programate...",
  INTRERUPERI: "Verific întreruperile active...",
  AI_SUMMARY: "Sintetizez articolul...",
  AI_FORMAL_TEXT: "Pregătesc emailul oficial...",
  AI_CLASSIFY: "Identific tipul problemei...",
  AI_VISION: "Analizez poza...",
  GEOCODING: "Detectez locația...",
  UPLOADING_PHOTO: "Încarc poza...",
  SENDING_EMAIL: "Trimit emailul la primărie...",
  GENERIC: "Se încarcă...",
} as const;

/**
 * Error messages — friendly user-facing instead of „Error 500". (P2.455)
 */
export const ERROR_MSG = {
  NETWORK: "Hmm, nu m-am putut conecta. Verifică internetul și reîncearcă.",
  SERVER: "Ceva s-a stricat la noi pe server. Reîncearcă în câteva minute.",
  AI_TIMEOUT: "AI-ul a obosit momentan. Reîncearcă în 30 de secunde.",
  AI_QUOTA: "Am atins limita de utilizare AI pe ziua de azi. Revino mâine!",
  UPLOAD_TOO_BIG: "Poza e prea mare (max 5MB). Compresează și reîncearcă.",
  UPLOAD_WRONG_FORMAT: "Formatul nu e acceptat. Folosește JPG, PNG sau WebP.",
  AUTH_REQUIRED: `Trebuie să fii logat pentru asta. Apasă „Loghează-te" sus.`,
  RATE_LIMITED: "Prea multe încercări. Așteaptă un minut și reîncearcă.",
  VALIDATION: "Verifică datele introduse. Câmpurile evidențiate cu roșu sunt obligatorii.",
  EMAIL_BOUNCED: "Emailul de la primărie n-a putut fi livrat. Verifică în /autoritati dacă adresa e corectă.",
  GENERIC: "Hmm, ceva n-a mers cum trebuie. Reîncarcă pagina sau reîncearcă acțiunea.",
} as const;

/**
 * Success messages — celebratory tone. (P2.456)
 */
export const SUCCESS_MSG = {
  SESIZARE_SUBMITTED: "🎉 Sesizarea ta a plecat la primărie! Te anunțăm când răspund.",
  PETITIE_SIGNED: "✓ Ai semnat petiția. Mulțumim că te implici!",
  COMMENT_POSTED: "✓ Comentariu publicat.",
  VOTE_RECORDED: "✓ Vot înregistrat.",
  PROFILE_SAVED: "✓ Datele tale sunt salvate.",
  NEWSLETTER_CONFIRMED: "🎉 Ești pe lista Civia. Te anunțăm vinerea cu rezolvările săptămânii.",
  COPIED: "✓ Copiat în clipboard",
  PUBLISHED: "🌟 Sesizarea ta e LIVE! Distribuie ca să o vadă mai mulți.",
} as const;

/**
 * Cross-device preferences sync layer.
 *
 * Flow:
 *  1. Anonymous user → localStorage only.
 *  2. La login → hydratePreferences() preia din DB, merge cu localStorage
 *     (DB castiga pe theme + cookie_consent daca preferences_updated_at >
 *     timestamp-ul local; localStorage castiga la dismissed_prompts —
 *     union per key).
 *  3. La fiecare schimbare locala → writePreferences() (debounced 500ms)
 *     trimite PUT la DB.
 *  4. Daca PUT esueaza (offline, 401), pastram in localStorage si retry
 *     la urmatorul change cycle.
 */

export interface CookieConsent {
  essential: boolean;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
  acceptedAt: string;
}

export interface UserPreferences {
  theme: "light" | "dark" | "system" | null;
  cookie_consent: CookieConsent | null;
  dismissed_prompts: Record<string, string> | null;
  updated_at: string | null;
}

const STORAGE_THEME = "civia_theme";
const STORAGE_COOKIE = "civia_cookie_consent_v2";
const STORAGE_DISMISSED = "civia_dismissed_prompts";
const STORAGE_PREFS_TS = "civia_prefs_updated_at";

export function readLocalPreferences(): UserPreferences {
  if (typeof window === "undefined") {
    return { theme: null, cookie_consent: null, dismissed_prompts: null, updated_at: null };
  }
  try {
    const theme = (localStorage.getItem(STORAGE_THEME) as UserPreferences["theme"]) ?? null;
    const consentRaw = localStorage.getItem(STORAGE_COOKIE);
    const dismissedRaw = localStorage.getItem(STORAGE_DISMISSED);
    return {
      theme: theme === "light" || theme === "dark" || theme === "system" ? theme : null,
      cookie_consent: consentRaw ? (JSON.parse(consentRaw) as CookieConsent) : null,
      dismissed_prompts: dismissedRaw ? (JSON.parse(dismissedRaw) as Record<string, string>) : null,
      updated_at: localStorage.getItem(STORAGE_PREFS_TS),
    };
  } catch {
    return { theme: null, cookie_consent: null, dismissed_prompts: null, updated_at: null };
  }
}

export function writeLocalPreferences(prefs: Partial<UserPreferences>): void {
  if (typeof window === "undefined") return;
  try {
    if (prefs.theme !== undefined) {
      if (prefs.theme === null) localStorage.removeItem(STORAGE_THEME);
      else localStorage.setItem(STORAGE_THEME, prefs.theme);
    }
    if (prefs.cookie_consent !== undefined) {
      if (prefs.cookie_consent === null) localStorage.removeItem(STORAGE_COOKIE);
      else localStorage.setItem(STORAGE_COOKIE, JSON.stringify(prefs.cookie_consent));
    }
    if (prefs.dismissed_prompts !== undefined) {
      if (prefs.dismissed_prompts === null) localStorage.removeItem(STORAGE_DISMISSED);
      else localStorage.setItem(STORAGE_DISMISSED, JSON.stringify(prefs.dismissed_prompts));
    }
    localStorage.setItem(STORAGE_PREFS_TS, new Date().toISOString());
  } catch {
    // Quota exceeded / private mode — ignoram (best-effort).
  }
}

/**
 * Merge politică (când avem si local si remote):
 *  - theme: cel mai recent (compare timestamps).
 *  - cookie_consent: la fel — cel mai recent castiga.
 *  - dismissed_prompts: UNION pe cheie, value = max(timestamp) pentru
 *    fiecare prompt id (un prompt dismissed pe orice device ramane dismissed).
 */
export function mergePreferences(
  local: UserPreferences,
  remote: UserPreferences,
): UserPreferences {
  const localTs = local.updated_at ? new Date(local.updated_at).getTime() : 0;
  const remoteTs = remote.updated_at ? new Date(remote.updated_at).getTime() : 0;
  const remoteIsNewer = remoteTs > localTs;

  // theme + cookie: remote wins daca e mai nou, altfel local.
  const theme = remoteIsNewer && remote.theme !== null ? remote.theme : (local.theme ?? remote.theme);
  const cookie_consent =
    remoteIsNewer && remote.cookie_consent !== null
      ? remote.cookie_consent
      : (local.cookie_consent ?? remote.cookie_consent);

  // dismissed_prompts: UNION, cu max timestamp per key.
  const dismissed: Record<string, string> = {};
  for (const [k, v] of Object.entries(local.dismissed_prompts ?? {})) {
    dismissed[k] = v;
  }
  for (const [k, v] of Object.entries(remote.dismissed_prompts ?? {})) {
    if (!dismissed[k] || new Date(v).getTime() > new Date(dismissed[k]!).getTime()) {
      dismissed[k] = v;
    }
  }
  const dismissed_prompts = Object.keys(dismissed).length > 0 ? dismissed : null;

  return {
    theme,
    cookie_consent,
    dismissed_prompts,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Hydrate la login: GET preferences din DB, merge cu locale, write rezultat
 * inapoi in localStorage + DB. Apelat o singura data per session, dupa
 * auth state change → SIGNED_IN.
 */
export async function hydratePreferences(): Promise<UserPreferences> {
  const local = readLocalPreferences();
  try {
    const res = await fetch("/api/profile/preferences", { cache: "no-store" });
    if (!res.ok) return local; // 401 → ramanem cu local
    const remote = (await res.json()) as UserPreferences;
    const merged = mergePreferences(local, remote);
    writeLocalPreferences(merged);
    // Daca mergea a produs ceva diferit fata de remote, push catre DB.
    const remoteHasSame =
      remote.theme === merged.theme &&
      JSON.stringify(remote.cookie_consent) === JSON.stringify(merged.cookie_consent) &&
      JSON.stringify(remote.dismissed_prompts ?? {}) === JSON.stringify(merged.dismissed_prompts ?? {});
    if (!remoteHasSame) {
      void writeRemotePreferences({
        theme: merged.theme,
        cookie_consent: merged.cookie_consent,
        dismissed_prompts: merged.dismissed_prompts,
      });
    }
    return merged;
  } catch {
    return local;
  }
}

let writeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingWrite: Partial<UserPreferences> | null = null;

/**
 * Debounced write (500ms) — collapseaza schimbari rapide intr-un singur PUT.
 */
export function writeRemotePreferences(updates: Partial<UserPreferences>): void {
  if (typeof window === "undefined") return;
  pendingWrite = { ...pendingWrite, ...updates };
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(async () => {
    const payload = pendingWrite;
    pendingWrite = null;
    writeTimer = null;
    if (!payload) return;
    try {
      await fetch("/api/profile/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // Offline / 5xx — pierdere acceptabila, urmatorul change retrimitre tot.
    }
  }, 500);
}

/**
 * Marcheaza un prompt ca dismissed pe acest device + sync cross-device.
 */
export function dismissPrompt(promptId: string): void {
  const local = readLocalPreferences();
  const dismissed = { ...(local.dismissed_prompts ?? {}), [promptId]: new Date().toISOString() };
  writeLocalPreferences({ dismissed_prompts: dismissed });
  writeRemotePreferences({ dismissed_prompts: dismissed });
}

export function isPromptDismissed(promptId: string): boolean {
  const local = readLocalPreferences();
  return Boolean(local.dismissed_prompts?.[promptId]);
}

/**
 * Inversul lui dismissPrompt — scoate un flag din dismissed_prompts (re-opt-in)
 * + sync cross-device. Păstrează celelalte chei. Folosit pentru toggle-uri de
 * opt-out/opt-in (ex. notificări de implicare → cheia `no_broadcast`).
 */
export function undismissPrompt(promptId: string): void {
  const local = readLocalPreferences();
  const dismissed = { ...(local.dismissed_prompts ?? {}) };
  delete dismissed[promptId];
  const next = Object.keys(dismissed).length > 0 ? dismissed : null;
  writeLocalPreferences({ dismissed_prompts: next });
  writeRemotePreferences({ dismissed_prompts: next });
}

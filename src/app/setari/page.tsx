"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Save,
  LogOut,
  CheckCircle2,
  Loader2,
  Plus,
  ExternalLink,
  X,
  AlertTriangle,
  Mail,
  MessageSquareText,
  Trash2,
  ShieldCheck,
  Download,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import { Badge } from "@/components/ui/Badge";
import { STATUS_COLORS, STATUS_LABELS, SESIZARE_TIPURI } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { SoundsToggle } from "@/components/liquid-civic/SoundsToggle";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
// 2026-05-24: BadgesSection + StreakWidget scoase din UI cont la cererea user-ului.
import { PushPermissionButton } from "@/components/notifications/PushPermissionButton";
import { EngagementPushToggle } from "@/components/notifications/EngagementPushToggle";
import { MfaSetup } from "@/components/cont/MfaSetup";
import { AreaSubscriptionsManager } from "@/components/area/AreaSubscriptionsManager";
import {
  SettingsGroup,
  SettingsRow,
  SettingsLinkRow,
  SettingsProfileCard,
} from "@/components/settings/SettingsList";
import { Contact, MapPin, Phone, Bell, BellRing, Volume2, ListChecks, LogIn } from "lucide-react";

interface Profile {
  id: string;
  display_name: string;
  full_name: string | null;
  address: string | null;
  phone: string | null;
  email: string;
  avatar_url: string | null;
  newsletter_email_optin?: boolean;
  newsletter_sms_optin?: boolean;
  notify_petitii_email?: boolean;
  notify_petitii_sms?: boolean;
  notify_proteste_email?: boolean;
  notify_proteste_sms?: boolean;
  hide_name?: boolean;
}

interface SesizareRow {
  id: string;
  code: string;
  tip: string;
  titlu: string;
  locatie: string;
  sector: string;
  status: string;
  created_at: string;
  publica: boolean;
  // 2026-05-19: track real send vs mailto
  sent_via_civia?: boolean | null;
  sent_at?: string | null;
}

interface FormState {
  display_name: string;
  full_name: string;
  address: string;
  phone: string;
  avatar_url: string;
  newsletter_email_optin: boolean;
  newsletter_sms_optin: boolean;
  notify_petitii_email: boolean;
  notify_petitii_sms: boolean;
  notify_proteste_email: boolean;
  notify_proteste_sms: boolean;
  hide_name: boolean;
}

const EMPTY_FORM: FormState = {
  display_name: "",
  full_name: "",
  address: "",
  phone: "",
  avatar_url: "",
  newsletter_email_optin: false,
  newsletter_sms_optin: false,
  notify_petitii_email: false,
  notify_petitii_sms: false,
  notify_proteste_email: false,
  notify_proteste_sms: false,
  hide_name: false,
};

// 2026-05-24 — cache local pentru render instant (zero „Se încarcă...").
// Profilul + sesizările sunt salvate la fiecare load reușit + hydratate la
// mount. Background refetch update-ează silent. Pe primul vizit fără cache
// arătăm skeleton (page structure), nu spinner text.
const CACHE_KEY = "civia:cont-cache-v1";
type ContCache = {
  userId: string;
  profile: Profile;
  sesizari: SesizareRow[];
  t: number;
};

function readCache(): ContCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ContCache;
    // Stale cache after 7d → ignore.
    if (Date.now() - parsed.t > 7 * 24 * 3600 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(userId: string, profile: Profile, sesizari: SesizareRow[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ userId, profile, sesizari, t: Date.now() }),
    );
  } catch {
    /* quota / private mode — silent */
  }
}

export default function ContPage() {
  const { user, loading: authLoading, signOut, openAuthModal } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  // Hidratăm DIRECT din localStorage la prima render — zero flicker dacă
  // există cache. Validăm că user-ul cached e același cu cel curent în
  // useEffect (la prima render, `user` poate fi încă null până AuthProvider
  // hydrateaza — totuși cache hit dă instant page structure).
  const initialCache = typeof window !== "undefined" ? readCache() : null;
  const [profile, setProfile] = useState<Profile | null>(initialCache?.profile ?? null);
  const [sesizari, setSesizari] = useState<SesizareRow[]>(initialCache?.sesizari ?? []);
  // `loading` = true DOAR pentru primul fetch fără cache. Refetch silent (background).
  const [loading, setLoading] = useState(!initialCache);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  // audit a11y: focus management pe modalul de ștergere cont (focus inițial +
  // trap pe Tab + Escape + restaurare focus). Înainte: doar role=dialog pe overlay.
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!deleteModal) return;
    deleteTriggerRef.current = document.activeElement as HTMLElement | null;
    const focusables = () =>
      deleteDialogRef.current
        ? Array.from(deleteDialogRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null)
        : [];
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleting) { setDeleteModal(false); return; }
      if (e.key === "Tab") {
        const els = focusables();
        if (els.length === 0) return;
        const first = els[0]!, last = els[els.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); deleteTriggerRef.current?.focus(); };
  }, [deleteModal, deleting]);
  // Bug #8 fix 5/22/2026 — newsletter auto-save fetch poate complete dupa
  // ce userul navigeaza away; setState pe unmounted component arunca warning
  // si leak. AbortController + mounted ref garanteaza cleanup.
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);
  // 2026-05-24: previne flicker „Se încarcă..." la tab switch revenire.
  // `onAuthStateChange` re-emite user (token refresh) când tab-ul reactiveaza
  // → `user` reference changes (chiar dacă id identic) → useEffect refire →
  // loadData → setLoading(true) flicker. Track ID-ul pentru care am încărcat
  // deja datele; skip refetch dacă același user.
  const loadedForUserIdRef = useRef<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Form state hidratat din cache — zero flicker pe revisit
  const [form, setForm] = useState<FormState>(() => {
    const p = initialCache?.profile;
    if (!p) return EMPTY_FORM;
    return {
      display_name: p.display_name ?? "",
      full_name: p.full_name ?? "",
      address: p.address ?? "",
      phone: p.phone ?? "",
      avatar_url: p.avatar_url ?? "",
      newsletter_email_optin: !!p.newsletter_email_optin,
      newsletter_sms_optin: !!p.newsletter_sms_optin,
      notify_petitii_email: !!p.notify_petitii_email,
      notify_petitii_sms: !!p.notify_petitii_sms,
      notify_proteste_email: !!p.notify_proteste_email,
      notify_proteste_sms: !!p.notify_proteste_sms,
      hide_name: !!p.hide_name,
    };
  });
  const [newsletterSavedAt, setNewsletterSavedAt] = useState<number | null>(null);

  /**
   * Auto-save just the newsletter opt-ins. Used by the per-checkbox onChange
   * handlers so the user doesn't have to click "Salvează" for newsletter
   * toggles. Other profile fields keep the existing explicit Save flow
   * because they need validation (length / format checks).
   */
  const autoSaveNewsletter = async (patch: {
    newsletter_email_optin?: boolean;
    newsletter_sms_optin?: boolean;
    notify_petitii_email?: boolean;
    notify_petitii_sms?: boolean;
    notify_proteste_email?: boolean;
    notify_proteste_sms?: boolean;
  }) => {
    const ctrl = new AbortController();
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
        signal: ctrl.signal,
      });
      if (!res.ok || !mountedRef.current) return;
      setNewsletterSavedAt(Date.now());
      setTimeout(() => {
        if (!mountedRef.current) return;
        setNewsletterSavedAt((t) => (t && Date.now() - t >= 1500 ? null : t));
      }, 1700);
    } catch (e) {
      // AbortError = navigated away, silent. Alte erori → silent (user
      // poate retoggle pentru retry). NU log Sentry — autoSave failures
      // sunt non-critical (Save button explicit acopera).
      if (e instanceof Error && e.name !== "AbortError") {
        // silent
      }
    }
  };

  const loadData = async (opts?: { silent?: boolean }) => {
    // Silent refetch: nu mai toggle `loading=true` (avem deja cached data
    // afișată). Dacă fetch eșuează, cache-ul rămâne vizibil.
    const silent = opts?.silent === true;
    if (!silent) setLoading(true);
    setLoadError(null);
    try {
      const [pRes, sRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/profile/sesizari"),
      ]);
      if (pRes.status === 401 || sRes.status === 401) {
        // Cache invalidat la 401 — sesiune expirată
        if (typeof window !== "undefined") localStorage.removeItem(CACHE_KEY);
        setLoadError("Sesiunea a expirat. Te rog autentifică-te din nou.");
        setTimeout(() => {
          router.push("/");
          openAuthModal();
        }, 1500);
        return;
      }
      const p = await pRes.json().catch(() => ({}));
      const s = await sRes.json().catch(() => ({}));
      if (!pRes.ok) {
        if (!silent) setLoadError(p.error ?? "Nu s-a putut încărca profilul.");
        return;
      }
      if (p.data) {
        setProfile(p.data);
        setForm({
          display_name: p.data.display_name ?? "",
          full_name: p.data.full_name ?? "",
          address: p.data.address ?? "",
          phone: p.data.phone ?? "",
          avatar_url: p.data.avatar_url ?? "",
          newsletter_email_optin: !!p.data.newsletter_email_optin,
          newsletter_sms_optin: !!p.data.newsletter_sms_optin,
          notify_petitii_email: !!p.data.notify_petitii_email,
          notify_petitii_sms: !!p.data.notify_petitii_sms,
          notify_proteste_email: !!p.data.notify_proteste_email,
          notify_proteste_sms: !!p.data.notify_proteste_sms,
          hide_name: !!p.data.hide_name,
        });
        const newSesizari = s.data ?? [];
        if (s.data) setSesizari(s.data);
        // Persistăm în cache pentru render instant la următoarea vizită.
        if (user?.id) writeCache(user.id, p.data, newSesizari);
      }
    } catch (e) {
      if (!silent) setLoadError(e instanceof Error ? e.message : "Eroare la încărcarea contului");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Cache cleared când user e gone (logout din alt tab).
      if (typeof window !== "undefined") localStorage.removeItem(CACHE_KEY);
      openAuthModal();
      return;
    }
    // Skip refetch dacă am încărcat deja pentru acest user (tab focus refresh).
    if (loadedForUserIdRef.current === user.id) return;
    loadedForUserIdRef.current = user.id;
    // Dacă cache-ul e pentru ALT user (login swap), invalidăm.
    if (initialCache && initialCache.userId !== user.id) {
      if (typeof window !== "undefined") localStorage.removeItem(CACHE_KEY);
      setProfile(null);
      setSesizari([]);
      setForm(EMPTY_FORM);
    }
    // Silent refetch dacă avem cache valid (instant render deja făcut).
    const haveValidCache = initialCache && initialCache.userId === user.id;
    loadData({ silent: !!haveValidCache });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    // audit fix: fără telefon NICIUN opt-in SMS nu poate fi activ → resetăm toate
    // cele 3 înainte de POST. Înainte doar newsletter_sms_optin era validat, iar
    // notify_petitii_sms/notify_proteste_sms rămâneau true în DB după ștergerea
    // telefonului (UI „off" vs DB „on" — și SMS-uri fără telefon valid).
    const payload = form.phone.trim()
      ? form
      : { ...form, newsletter_sms_optin: false, notify_petitii_sms: false, notify_proteste_sms: false };
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveError(json.error ?? "Eroare salvare");
      } else {
        if (json.data) {
          const next = { ...json.data, email: profile?.email ?? "" };
          setProfile(next);
          if (user?.id) writeCache(user.id, next, sesizari);
        }
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Eroare salvare");
    } finally {
      setSaving(false);
    }
  };

  // 2026-05-24 — zero „Se încarcă..." UX. Cu cache localStorage hydrate,
  // 99% din vizite vor avea `profile` valid din prima render. Pentru primul
  // vizit fără cache, arătăm skeleton (page structure) — nu spinner text.
  // Auth în curs → skeleton scurt.
  if (authLoading) {
    return (
      <div className="container-narrow py-4 sm:py-8 md:py-14 px-3 sm:px-6">
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="h-9 w-32 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] skeleton-shimmer" />
          <div className="h-20 rounded-2xl bg-[var(--color-surface-2)] skeleton-shimmer" />
          <div className="h-64 rounded-2xl bg-[var(--color-surface-2)] skeleton-shimmer" />
        </div>
      </div>
    );
  }
  // NELOGAT → pagina „Setări": aspect + accesibilitate (device-level, fără cont)
  // + invitație la conectare. Înlocuiește /setari (consolidat aici).
  if (!user) {
    return (
      <div className="container-narrow py-4 sm:py-8 md:py-14 px-3 sm:px-6">
        <div className="max-w-2xl mx-auto space-y-3 sm:space-y-4 lc-stagger">
          <div className="space-y-1 px-1 mb-1">
            <h1 className="font-[family-name:var(--font-sora)] text-2xl sm:text-3xl font-extrabold">Setări</h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Aspectul și accesibilitatea se salvează pe acest dispozitiv, fără cont.
            </p>
          </div>
          {/* Cont — invitație la conectare (rând cu iconiță colorată, stil Samsung) */}
          <SettingsGroup>
            <SettingsLinkRow
              icon={<LogIn size={20} aria-hidden="true" />}
              iconClass="bg-blue-500 text-white"
              label="Conectează-te"
              sublabel="Magic link pe email, fără parolă — pentru sesizări, co-semnături și notificări"
              onClick={openAuthModal}
            />
          </SettingsGroup>
          {/* Aspect & accesibilitate — device-level (temă + sticlă + a11y) */}
          <AppearanceSettings />
        </div>
      </div>
    );
  }
  // Logged-in dar lipsește cache + primul fetch e in progress → skeleton scurt.
  if (loading || !profile) {
    return (
      <div className="container-narrow py-4 sm:py-8 md:py-14 px-3 sm:px-6">
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="h-9 w-32 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] skeleton-shimmer" />
          <div className="h-20 rounded-2xl bg-[var(--color-surface-2)] skeleton-shimmer" />
          <div className="h-56 rounded-2xl bg-[var(--color-surface-2)] skeleton-shimmer" />
          <div className="h-40 rounded-2xl bg-[var(--color-surface-2)] skeleton-shimmer" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div role="alert" className="container-narrow py-20 max-w-md text-center">
        <AlertTriangle size={32} className="mx-auto mb-4 text-red-500" aria-hidden="true" />
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-extrabold mb-2">
          Nu s-a putut încărca contul
        </h1>
        <p className="text-[var(--color-text-muted)] mb-6">{loadError}</p>
        <button
          type="button"
          onClick={() => loadData()}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
        >
          Încearcă din nou
        </button>
      </div>
    );
  }

  const initial = ((profile?.display_name ?? profile?.email ?? "C")[0] ?? "C").toUpperCase();

  return (
    <div className="container-narrow py-4 sm:py-8 md:py-14 px-3 sm:px-6">
      {/* ─── Titlu „Setări" + grup profil (stil iOS Settings) ───────── */}
      <div className="max-w-2xl mx-auto mb-3 sm:mb-4 space-y-3 sm:space-y-4 lc-stagger">
        <h1 className="font-[family-name:var(--font-sora)] text-2xl sm:text-3xl font-extrabold px-1">Setări</h1>
        {/* Card profil — nume + email + avatar (stil Samsung One UI) */}
        <SettingsProfileCard
          name={profile?.display_name || "Cetățean"}
          sub={profile?.email}
          initial={initial}
        />
      </div>

      {/* Grupuri de setări — o singură coloană centrată (max-w-2xl),
          carduri care plutesc pe fundal cu gap-uri uniforme (stil Samsung). */}
      <div className="space-y-3 sm:space-y-4 max-w-2xl mx-auto">
        <div className="space-y-3 sm:space-y-4 lc-stagger">
          {/* Date personale + abonări — un singur form cu buton Save.
              2026-06-18 — restructurat în grupuri stil „Setări de telefon". */}
          <form onSubmit={handleSave} className="space-y-3 sm:space-y-4">
            {/* Date pentru sesizări — fiecare câmp = rând cu iconiță colorată */}
            <SettingsGroup>
              <SettingsRow
                align="start"
                icon={<User size={20} aria-hidden="true" />}
                iconClass="bg-blue-500 text-white"
                label="Nume afișat"
              >
                <input
                  type="text"
                  autoComplete="nickname"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  placeholder="Maria P."
                  aria-label="Nume afișat"
                  className={`${inputClass} mt-2`}
                />
              </SettingsRow>
              <SettingsRow
                align="start"
                icon={<Contact size={20} aria-hidden="true" />}
                iconClass="bg-indigo-500 text-white"
                label="Nume complet"
                sublabel="Apare pe sesizarea trimisă autorității (OG 27/2002)"
              >
                <input
                  type="text"
                  autoComplete="name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Maria Popescu"
                  aria-label="Nume complet"
                  className={`${inputClass} mt-2`}
                />
              </SettingsRow>
              <SettingsRow
                align="start"
                icon={<MapPin size={20} aria-hidden="true" />}
                iconClass="bg-emerald-500 text-white"
                label="Adresă domiciliu"
                sublabel="Apare pe sesizarea trimisă autorității"
              >
                <input
                  type="text"
                  autoComplete="street-address"
                  autoCapitalize="words"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Str. Exemplu 12, Sector 3"
                  aria-label="Adresă domiciliu"
                  className={`${inputClass} mt-2`}
                />
              </SettingsRow>
              <SettingsRow
                align="start"
                icon={<Phone size={20} aria-hidden="true" />}
                iconClass="bg-teal-500 text-white"
                label="Telefon"
                sublabel="Opțional — newsletter + SMS la petiții/proteste"
              >
                <input
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="07XX..."
                  aria-label="Telefon"
                  className={`${inputClass} mt-2`}
                />
              </SettingsRow>
            </SettingsGroup>

            {/* Notificări email/SMS — header colorat + grila de abonări (auto-save).
                5/23/2026 — 3 surse × 2 canale, opt-in GDPR per fiecare, SMS gated pe phone. */}
            <SettingsGroup>
              <SettingsRow
                icon={<Bell size={20} aria-hidden="true" />}
                iconClass="bg-orange-500 text-white"
                label="Notificări pe email & SMS"
                sublabel="Newsletter, petiții și proteste — alege canalele"
              />
              <div className="px-4 pb-4 pt-1">
                <SubscriptionsGrid
                  form={form}
                  onChange={(patch) => {
                    setForm({ ...form, ...patch });
                    autoSaveNewsletter(patch);
                  }}
                  phoneAvailable={!!form.phone.trim()}
                  savedAt={newsletterSavedAt}
                />
              </div>
            </SettingsGroup>

            {/* Save button */}
            <div className="px-1">
              {saveError && (
                <div role="alert" className="mb-3 p-2.5 rounded-[var(--radius-xs)] bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                  {saveError}
                </div>
              )}
              <button
                type="submit"
                disabled={saving}
                aria-busy={saving}
                className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : saved ? (
                  <CheckCircle2 size={14} aria-hidden="true" />
                ) : (
                  <Save size={14} aria-hidden="true" />
                )}
                {saving ? "Se salvează..." : saved ? "Salvat!" : "Salvează modificările"}
              </button>
            </div>
          </form>

          {/* Aspect & accesibilitate — device-level (temă + sticlă + a11y).
              AppearanceSettings include deja toggle-ul de temă (fără duplicat). */}
          <AppearanceSettings />

          {/* Sunete UI — header colorat + toggle */}
          <SettingsGroup>
            <SettingsRow
              icon={<Volume2 size={20} aria-hidden="true" />}
              iconClass="bg-violet-500 text-white"
              label="Sunete în interfață"
              sublabel="Feedback sonor discret la acțiuni"
            />
            <div className="px-4 pb-4 pt-1">
              <SoundsToggle />
            </div>
          </SettingsGroup>

          {/* Notificări push pe device — doar logat + browser cu suport (PWA). */}
          {user && (
            <SettingsGroup>
              <SettingsRow
                icon={<BellRing size={20} aria-hidden="true" />}
                iconClass="bg-amber-500 text-white"
                label="Notificări push pe acest device"
                sublabel="Native, când o autoritate răspunde — chiar dacă Civia nu e deschis"
              />
              <div className="px-4 pb-4 pt-1 space-y-2">
                <PushPermissionButton />
                <EngagementPushToggle />
              </div>
            </SettingsGroup>
          )}

          {/* Zone urmărite (Faza 2) — abonările la digestul local. Ascuns dacă none. */}
          {user && <AreaSubscriptionsManager />}

          {/* 2026-06-07 (audit #11) — securitate cont: 2FA opt-in (Supabase MFA nativ). */}
          {user && <MfaSetup />}
        </div>

        {/* ─── Sesizările tale (sub setări, în aceeași coloană) ──────── */}
        <div className="min-w-0">
          {/* Stats */}
          {sesizari.length > 0 && (() => {
            const rezolvate = sesizari.filter((s) => s.status === "rezolvat").length;
            const inLucru = sesizari.filter((s) => s.status === "in-lucru").length;
            const procent = Math.round((rezolvate / sesizari.length) * 100);
            return (
              <div className="grid grid-cols-3 gap-3 mb-6">
                <StatBox label="Totale" value={sesizari.length.toString()} color="var(--color-news)" />
                <StatBox label="Rezolvate" value={rezolvate.toString()} delta={`${procent}%`} color="var(--color-primary)" />
                <StatBox label="În lucru" value={inLucru.toString()} color="var(--color-warning)" />
              </div>
            );
          })()}

          <div className="flex items-center justify-between gap-3 mb-4 mt-2 px-1">
            <h2 className="font-[family-name:var(--font-sora)] text-lg sm:text-xl font-bold inline-flex items-center gap-2.5 min-w-0">
              <span className="shrink-0 w-9 h-9 rounded-full bg-sky-500 text-white grid place-items-center" aria-hidden="true">
                <ListChecks size={18} />
              </span>
              <span className="truncate">Sesizările tale ({sesizari.length})</span>
            </h2>
            <Link
              href="/sesizari"
              className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-[var(--color-primary)] text-white text-xs font-medium hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
            >
              <Plus size={14} aria-hidden="true" />
              Nouă
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 animate-pulse">
                  <div className="h-4 bg-[var(--color-surface-2)] rounded w-1/3 mb-2" />
                  <div className="h-5 bg-[var(--color-surface-2)] rounded w-3/4 mb-2" />
                  <div className="h-3 bg-[var(--color-surface-2)] rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : sesizari.length === 0 ? (
            <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-md)] p-10 text-center">
              <User size={32} className="mx-auto text-[var(--color-text-muted)] mb-3" aria-hidden="true" />
              <p className="text-[var(--color-text-muted)] mb-2 font-medium">Nu ai încă nicio sesizare</p>
              <p className="text-xs text-[var(--color-text-muted)] mb-4 max-w-md mx-auto">
                Sesizările apar aici după ce le depui — primești cod de urmărire și emailul ajunge automat la autoritate.
              </p>
              <Link
                href="/sesizari"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-full)] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
              >
                Depune prima sesizare <span aria-hidden="true">→</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {sesizari.map((s) => {
                const tipLabel = SESIZARE_TIPURI.find((t) => t.value === s.tip)?.label ?? s.tip;
                return (
                  <Link
                    key={s.id}
                    href={`/sesizari/${s.code}`}
                    className="block bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 hover:border-[var(--color-primary)]/40 hover:shadow-[var(--shadow-2)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
                  >
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge bgColor={STATUS_COLORS[s.status] ?? "var(--color-text-muted)"} color="white">
                        {STATUS_LABELS[s.status] ?? s.status}
                      </Badge>
                      <Badge variant="neutral">{tipLabel}</Badge>
                      <Badge variant="neutral">{s.sector}</Badge>
                      {!s.publica && (
                        <Badge variant="warning" className="text-[10px]">Privat</Badge>
                      )}
                      {s.sent_via_civia && (
                        <Badge variant="success" className="text-[10px] inline-flex items-center gap-1">
                          <CheckCircle2 size={10} aria-hidden="true" />
                          Trimis via Civia
                        </Badge>
                      )}
                      <span className="text-[10px] font-mono text-[var(--color-text-muted)] ml-auto" aria-label={`Cod sesizare ${s.code}`}>
                        {s.code}
                      </span>
                    </div>
                    <h3 className="font-semibold mb-1 line-clamp-1 break-words">{s.titlu}</h3>
                    <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-2 min-w-0">
                      <span className="truncate min-w-0 flex-1">{s.locatie}</span>
                      <span aria-hidden="true" className="shrink-0">·</span>
                      <span className="shrink-0 whitespace-nowrap">{formatDate(s.created_at)}</span>
                      <ExternalLink size={10} className="shrink-0" aria-hidden="true" />
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Confidențialitate (GDPR) + Deconectare — grupuri stil Samsung ─── */}
      <div className="max-w-2xl mx-auto mt-3 sm:mt-4 space-y-3 sm:space-y-4 lc-stagger">
        <SettingsGroup>
          {/* Export = <a download> (NU Link — descarcă JSON), stilizat ca rând */}
          <a
            href="/api/profile/export"
            download="civia-export.json"
            onClick={(e) => {
              const today = new Date().toISOString().slice(0, 10);
              e.currentTarget.setAttribute("download", `civia-export-${today}.json`);
            }}
            className="relative flex items-center gap-3.5 px-4 min-h-[60px] hover:bg-black/[0.035] dark:hover:bg-white/[0.05] focus:outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-primary)] focus-visible:bg-black/[0.035] dark:focus-visible:bg-white/[0.05] transition-[transform,background-color] duration-200 ease-out active:scale-[0.99] after:content-[''] after:absolute after:left-[70px] after:right-0 after:bottom-0 after:h-px after:bg-[var(--color-border)]"
          >
            <span className="shrink-0 w-10 h-10 rounded-full grid place-items-center bg-cyan-500 text-white [&>svg]:w-5 [&>svg]:h-5" aria-hidden="true">
              <Download />
            </span>
            <div className="flex-1 min-w-0 py-2.5">
              <div className="text-[15px] font-medium text-[var(--color-text)]">Descarcă datele mele</div>
              <div className="text-[13px] text-[var(--color-text-muted)] mt-0.5">Export GDPR complet (JSON)</div>
            </div>
          </a>
          <SettingsLinkRow
            icon={<Trash2 size={20} aria-hidden="true" />}
            iconClass="bg-red-500 text-white"
            label="Șterge contul definitiv"
            sublabel="Acțiune ireversibilă"
            danger
            onClick={() => setDeleteModal(true)}
          />
        </SettingsGroup>

        {/* Deconectare */}
        <SettingsGroup>
          <SettingsLinkRow
            icon={<LogOut size={20} aria-hidden="true" />}
            iconClass="bg-slate-500 text-white"
            label="Deconectare"
            onClick={async () => {
              // Invalidăm cache-ul înainte de signOut ca să nu păstrăm datele
              // user-ului anterior dacă altcineva intră în cont pe același device.
              if (typeof window !== "undefined") localStorage.removeItem(CACHE_KEY);
              await signOut();
              toast("Te-ai deconectat. La revedere!", "info");
              router.push("/");
            }}
          />
        </SettingsGroup>
      </div>

      {/* Delete confirmation modal */}
      {deleteModal && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !deleting && setDeleteModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div
            ref={deleteDialogRef}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[var(--color-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-xl)] overflow-hidden"
          >
            <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-5 relative">
              {!deleting && (
                <button
                  type="button"
                  onClick={() => setDeleteModal(false)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  aria-label="Închide modalul de ștergere cont"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
              <div className="flex items-start gap-3">
                <AlertTriangle size={28} className="shrink-0 mt-1" aria-hidden="true" />
                <div>
                  <h3 id="delete-modal-title" className="font-[family-name:var(--font-sora)] text-xl font-bold">
                    Șterge contul definitiv
                  </h3>
                  <p className="text-sm text-white/90 mt-1">
                    Această acțiune NU poate fi anulată.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-[var(--color-text)]">
                Toate datele personale din contul tău vor fi șterse definitiv:
              </p>
              <ul className="text-sm text-[var(--color-text-muted)] space-y-1.5 pl-4">
                <li>• Numele, emailul, adresa, telefonul, poza de profil</li>
                <li>• Voturile și comentariile tale</li>
                <li>• Sesizările urmărite</li>
                <li>• Abonamentele la newsletter</li>
              </ul>
              <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)] rounded-[var(--radius-xs)] p-3">
                Sesizările publice pe care le-ai depus rămân pe platformă, dar vor fi anonimizate
                (numele înlocuit cu &ldquo;Cetățean&rdquo;).
              </p>
              <div className="pt-2">
                <label htmlFor="confirm-delete" className="block text-xs font-medium mb-1.5 text-[var(--color-text)]">
                  Tastează <span className="font-mono font-bold">ȘTERGE</span> pentru a confirma
                </label>
                <input
                  id="confirm-delete"
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="w-full h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-mono uppercase tracking-wider focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  disabled={deleting}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setDeleteModal(false); setDeleteConfirmText(""); }}
                  disabled={deleting}
                  className="flex-1 h-11 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] text-sm font-medium hover:bg-[var(--color-border)] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                >
                  Anulează
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      const res = await fetch("/api/profile/delete", { method: "DELETE" });
                      if (!res.ok) throw new Error();
                      toast("Contul a fost șters. La revedere!", "success");
                      setTimeout(() => { window.location.href = "/"; }, 1500);
                    } catch {
                      toast("Eroare la ștergere. Încearcă din nou.", "error");
                      setDeleting(false);
                    }
                  }}
                  disabled={deleting || deleteConfirmText.trim().toUpperCase().replace(/[ȘŞ]/g, "S").replace(/[ȚŢ]/g, "T") !== "STERGE"}
                  className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-[var(--radius-xs)] bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-red-500"
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
                  Da, șterge definitiv
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

// h-11 (era h-10 sub WCAG 44px) + text-base sm:text-sm (era text-sm → iOS zoom).
const inputClass =
  "w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]";

/**
 * 3 surse de abonare × 2 canale (email + SMS) — UI compact.
 * Layout: grid cu o coloană label-uri + două coloane checkbox-uri.
 * SMS-urile sunt dezactivate dacă user nu are phone setat.
 */
interface SubscriptionsGridProps {
  form: FormState;
  phoneAvailable: boolean;
  onChange: (patch: Partial<FormState>) => void;
  savedAt: number | null;
}

function SubscriptionsGrid({
  form,
  phoneAvailable,
  onChange,
  savedAt,
}: SubscriptionsGridProps) {
  const rows: Array<{
    label: string;
    sub: string;
    emailField: keyof FormState;
    smsField: keyof FormState;
  }> = [
    {
      label: "Newsletter săptămânal",
      sub: "Lunea — sesizări rezolvate, petiții, deadline-uri",
      emailField: "newsletter_email_optin",
      smsField: "newsletter_sms_optin",
    },
    {
      label: "Petiții noi",
      sub: "Cetățean, când apare o petiție pe Civia",
      emailField: "notify_petitii_email",
      smsField: "notify_petitii_sms",
    },
    {
      label: "Proteste noi",
      sub: "Când e aprobat un protest în calendar",
      emailField: "notify_proteste_email",
      smsField: "notify_proteste_sms",
    },
  ];

  return (
    <div className="pt-1">
      <div className="rounded-[var(--radius-xs)] border border-[var(--color-border)] overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 sm:gap-x-4 bg-[var(--color-surface-2)] px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">
          <span>Abonare</span>
          <span className="text-center w-12 sm:w-16">Email</span>
          <span className="text-center w-12 sm:w-16">SMS</span>
        </div>
        {rows.map((r, i) => {
          const emailOn = form[r.emailField] as boolean;
          const smsOn = form[r.smsField] as boolean;
          return (
            <div
              key={r.label}
              className={`grid grid-cols-[1fr_auto_auto] gap-x-2 sm:gap-x-4 px-3 py-3 items-center ${
                i > 0 ? "border-t border-[var(--color-border)]" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug">{r.label}</p>
                <p className="text-[11px] text-[var(--color-text-muted)] leading-snug mt-0.5">
                  {r.sub}
                </p>
              </div>
              <label className="w-12 sm:w-16 flex justify-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailOn}
                  onChange={(e) =>
                    onChange({ [r.emailField]: e.target.checked } as Partial<FormState>)
                  }
                  className="w-5 h-5 accent-[var(--color-primary)] cursor-pointer"
                  aria-label={`${r.label} pe email`}
                />
              </label>
              <label
                className={`w-12 sm:w-16 flex justify-center ${
                  phoneAvailable ? "cursor-pointer" : "cursor-not-allowed opacity-40"
                }`}
                title={phoneAvailable ? `${r.label} pe SMS` : "Completează telefonul mai sus pentru SMS"}
              >
                <input
                  type="checkbox"
                  checked={smsOn && phoneAvailable}
                  disabled={!phoneAvailable}
                  onChange={(e) =>
                    onChange({ [r.smsField]: e.target.checked } as Partial<FormState>)
                  }
                  className="w-5 h-5 accent-[var(--color-primary)] cursor-pointer disabled:cursor-not-allowed"
                  aria-label={`${r.label} pe SMS`}
                />
              </label>
            </div>
          );
        })}
      </div>
      {!phoneAvailable && (
        <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5 italic">
          ℹ Completează telefonul mai sus pentru a activa SMS-urile.
        </p>
      )}
      {savedAt && (
        <p
          role="status"
          className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium pt-2 inline-flex items-center gap-1"
        >
          <CheckCircle2 size={11} aria-hidden="true" />
          Preferințele de abonare au fost salvate
        </p>
      )}
    </div>
  );
}

function StatBox({ label, value, delta, color }: { label: string; value: string; delta?: string; color: string }) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-4 text-center shadow-[var(--shadow-1)]">
      <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
      {delta && <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{delta}</p>}
    </div>
  );
}

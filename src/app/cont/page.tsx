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
  Camera,
  Trash2,
  ShieldCheck,
  Download,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import { Badge } from "@/components/ui/Badge";
import { STATUS_COLORS, STATUS_LABELS, SESIZARE_TIPURI } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
// ThemeSettings eliminat 5/22/2026 — dark mode forever, fara toggle.
import { SoundsToggle } from "@/components/liquid-civic/SoundsToggle";
import { BadgesSection } from "@/components/profile/BadgesSection";
import { StreakWidget } from "@/components/profile/StreakWidget";
import { PushPermissionButton } from "@/components/notifications/PushPermissionButton";

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

export default function ContPage() {
  const { user, loading: authLoading, signOut, openAuthModal } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sesizari, setSesizari] = useState<SesizareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  // Bug #8 fix 5/22/2026 — newsletter auto-save fetch poate complete dupa
  // ce userul navigeaza away; setState pe unmounted component arunca warning
  // si leak. AbortController + mounted ref garanteaza cleanup.
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
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

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [pRes, sRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/profile/sesizari"),
      ]);
      if (pRes.status === 401 || sRes.status === 401) {
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
        setLoadError(p.error ?? "Nu s-a putut încărca profilul.");
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
      }
      if (s.data) setSesizari(s.data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Eroare la încărcarea contului");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      openAuthModal();
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast("Doar fișiere imagine (jpg, png, webp)", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast("Imagine prea mare. Maxim 5MB.", "error");
      return;
    }
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      const url = json.data?.urls?.[0];
      if (!url) throw new Error("Nu am primit URL-ul");

      // Persist immediately so the avatar survives a page reload even
      // if the user closes without clicking "Salvează modificările".
      const saveRes = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: url }),
      });
      const saveJson = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveJson.error || "Eroare salvare avatar");

      setForm((f) => ({ ...f, avatar_url: url }));
      setProfile((p) => (p ? { ...p, avatar_url: url } : p));
      toast("Poză de profil actualizată", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare upload", "error");
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAvatar = async () => {
    if (!form.avatar_url) return;
    setAvatarUploading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Eroare ștergere avatar");
      setForm((f) => ({ ...f, avatar_url: "" }));
      setProfile((p) => (p ? { ...p, avatar_url: null } : p));
      toast("Poza de profil ștearsă", "info");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare", "error");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newsletter_sms_optin && !form.phone.trim()) {
      setSaveError("Pentru newsletter pe SMS, completează numărul de telefon.");
      return;
    }
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveError(json.error ?? "Eroare salvare");
      } else {
        if (json.data) setProfile({ ...json.data, email: profile?.email ?? "" });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Eroare salvare");
    } finally {
      setSaving(false);
    }
  };

  // Wait for both auth AND profile fetch to resolve before rendering.
  // Without the `loading || !profile` check, we briefly render the page
  // with `profile=null`, which falls through to „Salut, Cetățean!" and
  // then snaps to the real name when the fetch resolves — exactly the
  // flicker users complained about.
  if (authLoading || !user || loading || !profile) {
    return (
      <div className="container-narrow py-20 text-center">
        <Loader2 size={28} className="animate-spin mx-auto text-[var(--color-text-muted)]" />
        <p className="text-sm text-[var(--color-text-muted)] mt-3">
          {!user ? "Autentifică-te pentru a accesa contul..." : "Se încarcă..."}
        </p>
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
          onClick={loadData}
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
      {/* ─── Header strip ─────────────────────────────────────────── */}
      <header className="relative mb-4 sm:mb-6 md:mb-8 overflow-hidden rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--color-primary)] via-emerald-700 to-indigo-800 p-4 sm:p-6 md:p-8 text-white shadow-[var(--shadow-3)]">
        <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="absolute -bottom-16 -left-8 w-72 h-72 rounded-full bg-indigo-400/20 blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="relative">
              {form.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.avatar_url}
                  alt=""
                  className="w-14 h-14 sm:w-20 sm:h-20 rounded-full object-cover ring-2 sm:ring-4 ring-white/30 shadow-lg"
                />
              ) : (
                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-white/15 backdrop-blur-sm ring-2 sm:ring-4 ring-white/30 grid place-items-center text-2xl sm:text-3xl font-bold shadow-lg">
                  {initial}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="absolute -bottom-1 -right-1 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white text-[var(--color-primary)] grid place-items-center shadow-md hover:scale-110 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)] disabled:opacity-50"
                aria-label="Schimbă poza de profil"
                title="Schimbă poza de profil"
              >
                {avatarUploading ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Camera size={14} aria-hidden="true" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadAvatar(file);
                }}
                className="hidden"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-[family-name:var(--font-sora)] text-lg sm:text-2xl md:text-3xl font-extrabold leading-tight break-words">
                Salut, {profile?.display_name?.split(" ")[0] ?? "Cetățean"}!
              </h1>
              <p className="text-xs sm:text-sm text-white/80 truncate">
                {profile?.email}
              </p>
              {form.avatar_url && (
                <button
                  type="button"
                  onClick={removeAvatar}
                  disabled={avatarUploading}
                  className="text-[11px] text-white/70 hover:text-white underline mt-1 inline-flex items-center gap-1"
                >
                  <Trash2 size={10} aria-hidden="true" />
                  Șterge poza
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              toast("Te-ai deconectat. La revedere!", "info");
              router.push("/");
            }}
            aria-label="Deconectare"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 h-9 sm:h-10 px-2.5 sm:px-4 rounded-[var(--radius-full)] bg-white/15 backdrop-blur-sm border border-white/30 text-xs sm:text-sm font-medium hover:bg-white/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <LogOut size={14} aria-hidden="true" />
            <span className="hidden sm:inline">Deconectare</span>
          </button>
        </div>
      </header>

      {/* ─── Main grid: Profile (left) + Sesizari (right) ───────────
          IMPORTANT: minmax(0, 1fr) NU 1fr — by default „1fr" implicit
          „minmax(auto, 1fr)" si „auto" = min-content => coloana se
          extinde la latimea continutului. Daca un card are text neromp-
          ut (location lung, cod URL), coloana iese din viewport.
          minmax(0, 1fr) forteaza shrink. */}
      <div className="grid lg:grid-cols-[400px_minmax(0,1fr)] gap-6 lg:gap-8">
        <aside className="lg:sticky lg:top-24 lg:self-start space-y-5">
          <form
            onSubmit={handleSave}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-1)] min-w-0 overflow-hidden"
          >
            {/* Date personale */}
            <section className="p-4 sm:p-5 space-y-4 min-w-0">
              <SectionTitle icon={User}>Date personale</SectionTitle>
              <Field label="Nume afișat">
                <input
                  type="text"
                  autoComplete="nickname"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  placeholder="Maria P."
                  className={inputClass}
                />
              </Field>
              <Field label="Nume complet (pentru sesizări)">
                <input
                  type="text"
                  autoComplete="name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Maria Popescu"
                  className={inputClass}
                />
              </Field>
              <Field label="Adresă domiciliu (pentru sesizări)">
                <input
                  type="text"
                  autoComplete="street-address"
                  autoCapitalize="words"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Str. Exemplu 12, Sector 3"
                  className={inputClass}
                />
              </Field>
              <Field label="Telefon (opțional, pentru newsletter + notificări SMS la petiții/proteste)">
                <input
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="07XX..."
                  className={inputClass}
                />
              </Field>

              {/* 5/23/2026 — Abonări granular: 3 surse × 2 canale.
                  GDPR explicit opt-in per fiecare. SMS gated pe phone non-empty
                  (UI dezactivat dacă lipsește, cu hint). Auto-save pe toggle. */}
              <SubscriptionsGrid
                form={form}
                onChange={(patch) => {
                  setForm({ ...form, ...patch });
                  autoSaveNewsletter(patch);
                }}
                phoneAvailable={!!form.phone.trim()}
                savedAt={newsletterSavedAt}
              />
            </section>

            {/* Aspect — ThemeSettings (light/dark/system toggle) eliminat
                5/22/2026, dark mode e default permanent. Pastram doar
                SoundsToggle pentru efectele audio UI. */}
            <section className="border-t border-[var(--color-border)] p-4 sm:p-5 space-y-3 min-w-0">
              <SectionTitle icon={Sparkles}>Aspect</SectionTitle>
              <SoundsToggle />
            </section>


            {/* Save button */}
            <div className="border-t border-[var(--color-border)] p-4 sm:p-5 min-w-0">
              {saveError && (
                <div role="alert" className="mb-3 p-2.5 rounded-[var(--radius-xs)] bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                  {saveError}
                </div>
              )}
              <button
                type="submit"
                disabled={saving}
                aria-busy={saving}
                className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
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

          {/* Civic Streak — retention loop. Prominent deasupra badges. */}
          {user && <StreakWidget userId={user.id} />}

          {/* Insigne civice — calculate dinamic din count-uri (sesizari,
              voturi, comentarii, verificari, sesizari rezolvate). Public
              read via /api/profile/[id]/badges. */}
          {user && <BadgesSection userId={user.id} />}

          {/* Notificări push pe device — vizibil doar daca browser-ul
              suporta + user logat. Configurabil din PWA (Chrome/Firefox
              full, iOS Safari 16.4+ INSTALAT). */}
          {user && (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 shadow-[var(--shadow-1)]">
              <h3 className="font-semibold text-sm mb-2">Notificări push pe acest device</h3>
              <p className="text-xs text-[var(--color-text-muted)] mb-3 leading-relaxed">
                Primește notificare native când o sesizare urmărită își schimbă statusul sau
                când o autoritate răspunde. Funcționează și când Civia nu e deschis.
              </p>
              <PushPermissionButton />
            </div>
          )}
        </aside>

        {/* ─── Sesizari column ────────────────────────────────────── */}
        <div className="min-w-0">
          {/* Stats */}
          {sesizari.length > 0 && (() => {
            const rezolvate = sesizari.filter((s) => s.status === "rezolvat").length;
            const inLucru = sesizari.filter((s) => s.status === "in-lucru").length;
            const procent = Math.round((rezolvate / sesizari.length) * 100);
            return (
              <div className="grid grid-cols-3 gap-3 mb-6">
                <StatBox label="Totale" value={sesizari.length.toString()} color="#2563EB" />
                <StatBox label="Rezolvate" value={rezolvate.toString()} delta={`${procent}%`} color="#059669" />
                <StatBox label="În lucru" value={inLucru.toString()} color="#EAB308" />
              </div>
            );
          })()}

          <div className="flex items-center justify-between mb-5">
            <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold">
              Sesizările tale ({sesizari.length})
            </h2>
            <Link
              href="/sesizari"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-[var(--radius-full)] bg-[var(--color-primary)] text-white text-xs font-medium hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
            >
              <Plus size={14} aria-hidden="true" />
              Sesizare nouă
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
                      <Badge bgColor={STATUS_COLORS[s.status] ?? "#64748b"} color="white">
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

      {/* ─── GDPR footer ─────────────────────────────────────────── */}
      <div className="mt-14 pt-8 border-t border-[var(--color-border)]">
        <h3 className="text-sm font-semibold mb-2 text-[var(--color-text)] break-words inline-flex items-center gap-2">
          <ShieldCheck size={14} className="text-[var(--color-primary)] shrink-0" aria-hidden="true" />
          Drepturile tale (GDPR)
        </h3>
        <p className="text-xs text-[var(--color-text-muted)] mb-4 max-w-2xl leading-relaxed">
          Conform Regulamentului UE 2016/679, ai dreptul de acces, rectificare, ștergere,
          portabilitate, restricționare și opoziție. Detalii complete în{" "}
          <Link href="/legal/confidentialitate" className="text-[var(--color-primary)] underline">
            politica de confidențialitate
          </Link>
          .
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/profile/export"
            download="civia-export.json"
            onClick={(e) => {
              const today = new Date().toISOString().slice(0, 10);
              e.currentTarget.setAttribute("download", `civia-export-${today}.json`);
            }}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-surface-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <Download size={12} aria-hidden="true" />
            Descarcă datele mele (JSON)
          </a>
          <button
            type="button"
            onClick={() => setDeleteModal(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-xs)] border border-red-300 dark:border-red-900 text-red-700 dark:text-red-400 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <Trash2 size={12} aria-hidden="true" />
            Șterge contul definitiv
          </button>
        </div>
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
                  disabled={deleting || deleteConfirmText.trim().toUpperCase() !== "ȘTERGE"}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="block text-[11px] sm:text-xs font-semibold mb-1 text-[var(--color-text-muted)] break-words leading-tight">
        {label}
      </label>
      {children}
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <h2 className="!text-[13px] sm:!text-sm !font-semibold text-[var(--color-text)] inline-flex items-center gap-1.5 break-words leading-tight m-0">
      <Icon size={13} className="text-[var(--color-primary)] shrink-0" aria-hidden="true" />
      {children}
    </h2>
  );
}

function CheckboxRow({
  icon: Icon,
  checked,
  onChange,
  title,
  description,
  disabled = false,
  disabledHint,
}: {
  icon: typeof User;
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description: string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-[var(--radius-xs)] border transition-colors cursor-pointer ${
        disabled
          ? "border-[var(--color-border)] bg-[var(--color-surface-2)]/50 opacity-60 cursor-not-allowed"
          : checked
            ? "border-[var(--color-primary)]/40 bg-[var(--color-primary-soft)]"
            : "border-[var(--color-border)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)]"
      }`}
    >
      <input
        type="checkbox"
        checked={checked && !disabled}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 w-4 h-4 accent-[var(--color-primary)] cursor-pointer disabled:cursor-not-allowed"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Icon size={12} className="text-[var(--color-primary)] shrink-0" aria-hidden="true" />
          {title}
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
          {disabled && disabledHint ? disabledHint : description}
        </p>
      </div>
    </label>
  );
}

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

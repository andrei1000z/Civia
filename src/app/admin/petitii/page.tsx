"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
  Clock,
  Eye,
  ImageIcon,
  Sparkles,
  Upload,
  Infinity as InfinityIcon,
  Wand2,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";
import { PETITIE_CATEGORII } from "@/lib/constants";
import { ALL_COUNTIES } from "@/data/counties";

export const dynamic = "force-dynamic";

interface PetitieRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  image_url: string | null;
  external_url: string | null;
  target_signatures: number | null;
  category: string | null;
  county_code: string | null;
  starts_at: string;
  ends_at: string | null;
  status: "draft" | "active" | "closed" | "archived";
  signature_count: number;
  created_at: string;
  updated_at: string;
}

const DRAFT_KEY_NEW = "civia_admin_petitie_draft_new";
const DRAFT_KEY_EDIT_PREFIX = "civia_admin_petitie_draft_edit_";

interface FormState {
  slug: string;
  title: string;
  summary: string;
  body: string;
  image_url: string;
  external_url: string;
  target_unlimited: boolean;
  target_signatures: number;
  category: string;
  county_code: string; // empty string = național
  ends_at: string;
}

const EMPTY_FORM: FormState = {
  slug: "",
  title: "",
  summary: "",
  body: "",
  image_url: "",
  external_url: "",
  target_unlimited: false,
  target_signatures: 1000,
  category: "",
  county_code: "",
  ends_at: "",
};

function getDraftKey(editingId: string | null): string {
  return editingId ? `${DRAFT_KEY_EDIT_PREFIX}${editingId}` : DRAFT_KEY_NEW;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export default function AdminPetitiiPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<PetitieRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  // Seed data pasat la PetitieForm după import dintr-un URL extern.
  // Permite admin-ului să PUNĂ DOAR URL-ul, restul (titlu, sumar, conținut,
  // imagine, categorie, slug) sunt completate de AI scrape, apoi admin
  // verifică/ajustează în form-ul deschis pre-populat.
  const [importSeed, setImportSeed] = useState<Partial<FormState> | null>(null);
  const [quickImportUrl, setQuickImportUrl] = useState("");
  const [quickImporting, setQuickImporting] = useState(false);

  const handleQuickImport = async () => {
    const url = quickImportUrl.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      toast("Pune un URL valid (https://...)", "error");
      return;
    }
    setQuickImporting(true);
    try {
      const res = await fetch("/api/admin/petitii/scrape-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scrape eșuat");
      // Construim seed-ul pentru PetitieForm cu ce a returnat AI-ul.
      const data = json.data ?? {};
      setImportSeed({
        external_url: url,
        title: data.title ?? "",
        summary: data.summary ?? "",
        body: data.body ?? data.content ?? "",
        image_url: data.image_url ?? "",
        slug: data.slug ?? "",
        category: data.category ?? "",
      });
      setEditingId(null);
      setShowForm(true);
      setQuickImportUrl("");
      toast("Petiție importată — verifică datele și salvează", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare import", "error");
    } finally {
      setQuickImporting(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/petitii", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setRows(json.data ?? []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare la încărcare", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Ștergi petiția „${title}"? Toate semnăturile dispar.`)) return;
    try {
      const res = await fetch(`/api/admin/petitii/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast("Șters", "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare", "error");
    }
  };

  return (
    <div className="container-narrow py-8 md:py-12">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-sora)] text-3xl font-extrabold flex items-center gap-2">
            <Megaphone size={26} className="text-purple-600" aria-hidden="true" />
            Petiții civice
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Postează petițiile pe /petitii. Auto-save la 2s + AI helpers pentru sumar și slug.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setImportSeed(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-[var(--radius-full)] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
        >
          <Plus size={16} aria-hidden="true" />
          Petiție nouă
        </button>
      </header>

      {/* Quick-import: admin pune doar URL extern (Declic/Avaaz/Change.org/
          petitie.civica.ro), AI completează automat titlu, sumar, conținut,
          imagine, categorie, slug. Apoi se deschide form-ul pentru
          verificare. Ascuns când form-ul e deja deschis. */}
      {!showForm && (
        <div className="mb-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:p-5">
          <div className="flex items-start gap-3 mb-3">
            <span
              className="shrink-0 w-9 h-9 rounded-[var(--radius-xs)] bg-gradient-to-br from-purple-500/15 to-indigo-500/15 grid place-items-center"
              aria-hidden="true"
            >
              <Wand2 size={16} className="text-purple-600 dark:text-purple-400" />
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">Adaugă petiție din URL extern</h3>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mt-0.5">
                Pune doar link-ul (Declic, Avaaz, Change.org, petitie.civica.ro) — AI extrage automat titlu, sumar, conținut, imagine, categorie. Tu verifici și salvezi.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={quickImportUrl}
              onChange={(e) => setQuickImportUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleQuickImport();
                }
              }}
              placeholder="https://declic.ro/petitii/..."
              disabled={quickImporting}
              className="flex-1 h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            />
            <button
              type="button"
              onClick={handleQuickImport}
              disabled={quickImporting || !quickImportUrl.trim()}
              className="h-11 px-4 inline-flex items-center justify-center gap-2 rounded-[var(--radius-xs)] bg-gradient-to-br from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
            >
              {quickImporting ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Wand2 size={14} aria-hidden="true" />
              )}
              {quickImporting ? "Import..." : "Adaugă din URL"}
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <PetitieForm
          editingId={editingId}
          existing={editingId ? rows.find((r) => r.id === editingId) ?? null : null}
          seedData={importSeed ?? undefined}
          onClose={() => {
            setShowForm(false);
            setEditingId(null);
            setImportSeed(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditingId(null);
            setImportSeed(null);
            load();
          }}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-[var(--color-text-muted)]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-md)] p-8 text-center">
          <Megaphone size={32} className="mx-auto text-[var(--color-text-muted)] mb-3" aria-hidden="true" />
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            Niciun petiție creată. Apasă „Petiție nouă" sus.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => {
            const cat = PETITIE_CATEGORII.find((c) => c.value === p.category);
            return (
              <article
                key={p.id}
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 flex items-start gap-4"
              >
                {p.image_url && (
                  <div className="relative shrink-0 w-20 h-20 rounded-[var(--radius-xs)] overflow-hidden bg-[var(--color-surface-2)] hidden sm:block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {cat && (
                      <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 inline-flex items-center gap-1">
                        <span aria-hidden="true">{cat.icon}</span>
                        {cat.value}
                      </span>
                    )}
                    {p.county_code ? (
                      <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                        {p.county_code}
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                        🇷🇴 Național
                      </span>
                    )}
                  </div>
                  <h2 className="font-[family-name:var(--font-sora)] font-bold text-base mb-1 line-clamp-1">
                    {p.title}
                  </h2>
                  <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 mb-2">
                    {p.summary}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] flex-wrap">
                    <span className="font-mono">/{p.slug}</span>
                    {p.external_url && (
                      <>
                        <span aria-hidden="true">·</span>
                        <a
                          href={p.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:text-[var(--color-primary)]"
                        >
                          <ExternalLink size={11} aria-hidden="true" />
                          {new URL(p.external_url).hostname.replace(/^www\./, "")}
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    href={`/petitii/${p.slug}`}
                    target="_blank"
                    className="w-9 h-9 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                    aria-label="Vezi pe site"
                    title="Vezi pe site"
                  >
                    <Eye size={14} aria-hidden="true" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(p.id);
                      setShowForm(true);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="w-9 h-9 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                    aria-label="Editează"
                    title="Editează"
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id, p.title)}
                    className="w-9 h-9 rounded-[var(--radius-xs)] bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-900 flex items-center justify-center text-red-600 dark:text-red-400 transition-colors"
                    aria-label="Șterge"
                    title="Șterge"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PetitieForm
// ─────────────────────────────────────────────────────────────────

function PetitieForm({
  editingId,
  existing,
  seedData,
  onClose,
  onSaved,
}: {
  editingId: string | null;
  existing: PetitieRow | null;
  /** Pre-populate form fields when creating new (e.g. after URL import). */
  seedData?: Partial<FormState>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [restoredBanner, setRestoredBanner] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [aiBusy, setAiBusy] = useState<"slug" | "summary" | null>(null);
  const [scrapingUrl, setScrapingUrl] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const slugManuallyEditedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const baseForm: FormState = existing
    ? {
        slug: existing.slug,
        title: existing.title,
        summary: existing.summary,
        body: existing.body,
        image_url: existing.image_url ?? "",
        external_url: existing.external_url ?? "",
        target_unlimited: existing.target_signatures === null,
        target_signatures: existing.target_signatures ?? 1000,
        category: existing.category ?? "",
        county_code: existing.county_code ?? "",
        ends_at: existing.ends_at?.slice(0, 10) ?? "",
      }
    : { ...EMPTY_FORM, ...(seedData ?? {}) };

  const [form, setForm] = useState<FormState>(baseForm);

  // ─── Restore draft on mount ────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(getDraftKey(editingId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as { form: FormState; savedAt: number };
      const hasContent =
        parsed.form.title.trim().length > 0 ||
        parsed.form.summary.trim().length > 0 ||
        parsed.form.body.trim().length > 0;
      if (hasContent) {
        setForm(parsed.form);
        setDraftSavedAt(parsed.savedAt);
        setRestoredBanner(true);
        if (parsed.form.slug && parsed.form.slug !== slugify(parsed.form.title)) {
          slugManuallyEditedRef.current = true;
        }
      }
    } catch {
      // Corrupt draft — ignore.
    }
  }, [editingId]);

  // ─── Auto-save 2s ──────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = getDraftKey(editingId);
    const t = setTimeout(() => {
      try {
        const hasContent =
          form.title.trim().length > 0 ||
          form.summary.trim().length > 0 ||
          form.body.trim().length > 0;
        if (!hasContent) return;
        localStorage.setItem(key, JSON.stringify({ form, savedAt: Date.now() }));
        setDraftSavedAt(Date.now());
      } catch {
        // Quota exceeded — silent.
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [form, editingId]);

  // ─── "Salvat acum X" updater ──────────────────────────────────
  useEffect(() => {
    if (!draftSavedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [draftSavedAt]);

  // ─── Auto-slug ─────────────────────────────────────────────────
  const updateTitle = (title: string) => {
    setForm((f) => ({
      ...f,
      title,
      slug: slugManuallyEditedRef.current ? f.slug : slugify(title),
    }));
  };

  const updateSlug = (slug: string) => {
    slugManuallyEditedRef.current = true;
    setForm((f) => ({ ...f, slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-") }));
  };

  const clearDraft = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(getDraftKey(editingId));
    setForm(baseForm);
    setDraftSavedAt(null);
    setRestoredBanner(false);
    slugManuallyEditedRef.current = !!existing;
    toast("Ciorna ștearsă", "info");
  };

  // ─── AI helpers ────────────────────────────────────────────────
  const runAi = async (type: "slug" | "summary") => {
    if (!form.title.trim() || form.title.trim().length < 8) {
      toast("Completează titlul mai întâi (min. 8 caractere)", "error");
      return;
    }
    if (type === "summary" && form.body.trim().length < 50) {
      toast("Completează conținutul mai întâi (min. 50 caractere) pentru AI summary", "error");
      return;
    }
    setAiBusy(type);
    try {
      const res = await fetch("/api/admin/petitii/ai-helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: form.title,
          ...(type === "summary" ? { body: form.body } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "AI failed");
      const text = json.data?.text ?? "";
      if (type === "slug") {
        slugManuallyEditedRef.current = true;
        setForm((f) => ({ ...f, slug: text }));
        toast("Slug generat cu AI", "success");
      } else {
        setForm((f) => ({ ...f, summary: text }));
        toast("Sumar generat cu AI", "success");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "AI helper a eșuat", "error");
    } finally {
      setAiBusy(null);
    }
  };

  // ─── Massive URL scrape ────────────────────────────────────────
  // Fetches the external petition page, extracts og:* + body text, runs
  // Groq to produce structured fields (title, summary, body, category,
  // slug, county, image), then auto-fills the entire form.
  const scrapeFromUrl = async () => {
    const url = form.external_url.trim();
    if (!url) {
      toast("Pune un URL în câmpul Link extern mai întâi", "error");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      toast("URL-ul trebuie să înceapă cu http:// sau https://", "error");
      return;
    }
    const hasContent =
      form.title.trim().length > 0 ||
      form.summary.trim().length > 0 ||
      form.body.trim().length > 0;
    if (hasContent && !confirm("Asta va suprascrie câmpurile completate (titlu, sumar, conținut, etc). Continui?")) {
      return;
    }
    setScrapingUrl(true);
    try {
      const res = await fetch("/api/admin/petitii/scrape-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scrape failed");
      const d = json.data ?? {};
      setForm((f) => ({
        ...f,
        title: d.title || f.title,
        summary: d.summary || f.summary,
        body: d.body || f.body,
        slug: d.slug || f.slug,
        category: d.category || f.category,
        county_code: d.county_code || f.county_code,
        image_url: d.image_url || f.image_url,
        external_url: url,
      }));
      // After auto-fill the slug came from AI — mark as manually edited so
      // the title typer doesn't overwrite it.
      if (d.slug) slugManuallyEditedRef.current = true;
      toast("Auto-completat din URL ✨", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare scrape", "error");
    } finally {
      setScrapingUrl(false);
    }
  };

  // ─── Image upload ──────────────────────────────────────────────
  const uploadImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast("Doar fișiere imagine (jpg, png, webp, gif)", "error");
      return;
    }
    setImageUploading(true);
    try {
      const fd = new FormData();
      // /api/upload așteaptă "files" (plural), răspunde cu data.urls array.
      fd.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      const url = json.data?.urls?.[0];
      if (!url) throw new Error("No URL returned");
      setForm((f) => ({ ...f, image_url: url }));
      toast("Imagine încărcată", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare upload", "error");
    } finally {
      setImageUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.external_url.trim()) {
      toast("Link-ul extern e obligatoriu (sursa oficială a petiției)", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        slug: form.slug.trim(),
        title: form.title.trim(),
        summary: form.summary.trim(),
        body: form.body.trim(),
        image_url: form.image_url.trim() || null,
        external_url: form.external_url.trim(),
        target_signatures: form.target_unlimited ? null : Number(form.target_signatures),
        category: form.category.trim() || null,
        county_code: form.county_code.trim() || null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        status: "active" as const,
      };
      const url = editingId ? `/api/admin/petitii/${editingId}` : "/api/admin/petitii";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      if (typeof window !== "undefined") localStorage.removeItem(getDraftKey(editingId));
      toast(editingId ? "Salvat" : "Publicată!", "success");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare", "error");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full h-11 px-4 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]";
  const labelCls = "block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5";

  const wordCount = form.body.trim().split(/\s+/).filter(Boolean).length;
  const readMinutes = Math.max(1, Math.ceil(wordCount / 200));

  const draftAge = draftSavedAt ? Math.floor((now - draftSavedAt) / 1000) : 0;
  const draftAgeText =
    draftAge < 5
      ? "acum"
      : draftAge < 60
        ? `acum ${draftAge}s`
        : draftAge < 3600
          ? `acum ${Math.floor(draftAge / 60)}min`
          : `acum ${Math.floor(draftAge / 3600)}h`;

  const sortedCounties = [...ALL_COUNTIES].sort((a, b) => a.name.localeCompare(b.name, "ro"));

  return (
    <form
      onSubmit={submit}
      className="bg-[var(--color-surface)] border border-[var(--color-primary)]/30 rounded-[var(--radius-md)] p-6 mb-6 shadow-[var(--shadow-3)]"
    >
      <header className="mb-5 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-[family-name:var(--font-sora)] text-xl font-bold flex items-center gap-2">
            {editingId ? (
              <>
                <Pencil size={18} aria-hidden="true" /> Editează petiția
              </>
            ) : (
              <>
                <Plus size={18} aria-hidden="true" /> Petiție nouă
              </>
            )}
          </h2>
          {draftSavedAt && (
            <p className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1 mt-1">
              <Clock size={10} aria-hidden="true" />
              Ciornă salvată {draftAgeText} (autosave la 2s)
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-xs)] border text-xs font-medium transition-colors",
              showPreview
                ? "bg-[var(--color-primary-soft)] border-[var(--color-primary)]/30 text-[var(--color-primary-on-soft)]"
                : "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
            )}
          >
            <Eye size={12} aria-hidden="true" />
            {showPreview ? "Ascunde preview" : "Preview live"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Închide formularul"
            className="w-9 h-9 rounded-full bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </header>

      {restoredBanner && (
        <div
          role="status"
          className="mb-5 p-3 rounded-[var(--radius-xs)] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 flex items-start gap-2"
        >
          <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <div className="flex-1 text-xs text-amber-800 dark:text-amber-300">
            <p className="font-semibold mb-0.5">Ciornă restaurată</p>
            <p>Am găsit o ciornă nesalvată din sesiunea anterioară. Continuă sau șterge.</p>
          </div>
          <button
            type="button"
            onClick={clearDraft}
            className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-300 underline hover:no-underline"
          >
            Șterge
          </button>
        </div>
      )}

      <div className={showPreview ? "grid lg:grid-cols-2 gap-6" : ""}>
        <div className="space-y-4">
          <div>
            <label htmlFor="p-title" className={labelCls}>Titlu *</label>
            <input
              id="p-title"
              type="text"
              value={form.title}
              onChange={(e) => updateTitle(e.target.value)}
              placeholder="ex: Mai multe parcuri pentru București"
              required
              className={inputCls}
              autoCapitalize="words"
            />
          </div>

          <div className="grid sm:grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <label htmlFor="p-slug" className={labelCls}>
                Slug (URL) *
                {!slugManuallyEditedRef.current && form.title && (
                  <span className="ml-2 text-[10px] normal-case text-emerald-600 dark:text-emerald-400">
                    auto-generat
                  </span>
                )}
              </label>
              <input
                id="p-slug"
                type="text"
                value={form.slug}
                onChange={(e) => updateSlug(e.target.value)}
                placeholder="parcuri-mai-multe-bucuresti"
                required
                className={`${inputCls} font-mono text-xs`}
              />
            </div>
            <button
              type="button"
              onClick={() => runAi("slug")}
              disabled={aiBusy !== null || !form.title.trim()}
              className="h-11 inline-flex items-center gap-1.5 px-3 rounded-[var(--radius-xs)] bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              title="Generează slug cu AI din titlu"
            >
              {aiBusy === "slug" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              AI
            </button>
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] -mt-3">
            URL: civia.ro/petitii/<strong className="font-mono">{form.slug || "slug"}</strong>
          </p>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="p-summary" className={`${labelCls} mb-0`}>
                Sumar (afișat pe card) *
              </label>
              <button
                type="button"
                onClick={() => runAi("summary")}
                disabled={aiBusy !== null || form.body.trim().length < 50}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-xs)] bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-[10px] font-semibold transition-colors"
                title="Generează sumar cu AI din titlu + conținut"
              >
                {aiBusy === "summary" ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                Generează cu AI
              </button>
            </div>
            <textarea
              id="p-summary"
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value.slice(0, 500) })}
              placeholder={`2-3 propoziții cu contextul. Sau apasă "Generează cu AI" după ce completezi conținutul.`}
              required
              rows={3}
              maxLength={500}
              className={`${inputCls} h-auto py-3`}
              autoCapitalize="sentences"
              spellCheck
            />
            <p className={cn(
              "text-[10px] mt-1 tabular-nums font-medium",
              form.summary.length >= 480 ? "text-red-500" : form.summary.length >= 400 ? "text-amber-500" : "text-[var(--color-text-muted)]",
            )}>
              {form.summary.length}/500
            </p>
          </div>

          <div>
            <label htmlFor="p-body" className={labelCls}>
              Conținut complet *{" "}
              <span className="tabular-nums normal-case text-[var(--color-text-muted)] font-medium">
                {wordCount.toLocaleString("ro-RO")} cuvinte · ~{readMinutes} min lectură
              </span>
            </label>
            <textarea
              id="p-body"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Argumentul detaliat al petiției. Contextul, ce ceri, motivul. Linii noi se păstrează."
              required
              rows={10}
              className={`${inputCls} h-auto py-3 font-mono text-xs leading-relaxed`}
              autoCapitalize="sentences"
              spellCheck
            />
          </div>

          <div>
            <label htmlFor="p-ext" className={labelCls}>
              <ExternalLink size={11} className="inline mr-1" aria-hidden="true" />
              Link extern obligatoriu *
            </label>
            <div className="flex gap-2">
              <input
                id="p-ext"
                type="url"
                value={form.external_url}
                onChange={(e) => setForm({ ...form, external_url: e.target.value })}
                placeholder="https://declic.ro/petitii/..."
                required
                className={inputCls}
              />
              <button
                type="button"
                onClick={scrapeFromUrl}
                disabled={scrapingUrl || !form.external_url.trim()}
                className="h-11 inline-flex items-center gap-1.5 px-4 rounded-[var(--radius-xs)] bg-gradient-to-br from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 shadow-sm"
                title="Extrage automat titlu, sumar, conținut, categorie, imagine din URL"
              >
                {scrapingUrl ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Wand2 size={14} aria-hidden="true" />}
                {scrapingUrl ? "Scrape..." : "Auto-completează din URL"}
              </button>
            </div>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
              Sursa oficială (Declic / Avaaz / Change.org / petitie.civica.ro). Apasă <strong>Auto-completează</strong> ca AI-ul să umple titlul, sumarul, conținutul, categoria, imaginea și slug-ul.
            </p>
          </div>

          {/* IMAGE */}
          <div>
            <label htmlFor="p-image" className={labelCls}>
              <ImageIcon size={11} className="inline mr-1" aria-hidden="true" />
              Imagine (opțional)
            </label>
            <div className="flex gap-2">
              <input
                id="p-image"
                type="url"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="URL imagine sau încarcă din disc"
                className={inputCls}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadImage(file);
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={imageUploading}
                className="h-11 inline-flex items-center gap-1.5 px-4 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-sm font-medium disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                title="Încarcă imagine din disc"
              >
                {imageUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Încarcă
              </button>
            </div>
            {form.image_url && (
              <div className="mt-2 relative w-full aspect-[16/9] rounded-[var(--radius-xs)] overflow-hidden bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.image_url}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* CATEGORIE */}
            <div>
              <label htmlFor="p-cat" className={labelCls}>Categorie</label>
              <select
                id="p-cat"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className={inputCls}
              >
                <option value="">— alege —</option>
                {PETITIE_CATEGORII.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
            </div>
            {/* JUDET */}
            <div>
              <label htmlFor="p-county" className={labelCls}>Județ / Național</label>
              <select
                id="p-county"
                value={form.county_code}
                onChange={(e) => setForm({ ...form, county_code: e.target.value })}
                className={inputCls}
              >
                <option value="">🇷🇴 Național</option>
                {sortedCounties.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {/* TARGET */}
            <div>
              <label className={labelCls}>Semnături țintă</label>
              <div className="flex items-center gap-3 h-11">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.target_unlimited}
                    onChange={(e) => setForm({ ...form, target_unlimited: e.target.checked })}
                    className="w-4 h-4 accent-[var(--color-primary)]"
                  />
                  <span className="text-sm flex items-center gap-1">
                    <InfinityIcon size={14} aria-hidden="true" />
                    Nelimitat
                  </span>
                </label>
                {!form.target_unlimited && (
                  <input
                    type="number"
                    min={10}
                    max={10_000_000}
                    value={form.target_signatures}
                    onChange={(e) => setForm({ ...form, target_signatures: Number(e.target.value) })}
                    className={`${inputCls} max-w-[160px]`}
                  />
                )}
              </div>
            </div>
            {/* ENDS AT */}
            <div>
              <label htmlFor="p-ends" className={labelCls}>Data de încheiere (opțional)</label>
              <input
                id="p-ends"
                type="date"
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* Live preview */}
        {showPreview && (
          <aside className="lg:sticky lg:top-24 self-start bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-5 max-h-[80vh] overflow-y-auto">
            <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-3 flex items-center gap-1">
              <Eye size={10} aria-hidden="true" /> Preview live
            </p>
            {form.image_url && (
              <div className="relative w-full aspect-[16/9] rounded-[var(--radius-xs)] overflow-hidden bg-[var(--color-surface)] mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.image_url} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {form.category && (
                <span className="text-[10px] uppercase tracking-wider font-bold text-purple-600 dark:text-purple-400">
                  {PETITIE_CATEGORII.find((c) => c.value === form.category)?.icon}{" "}
                  {form.category}
                </span>
              )}
              <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
                {form.county_code ? `📍 ${form.county_code}` : "🇷🇴 Național"}
              </span>
            </div>
            <h3 className="font-[family-name:var(--font-sora)] font-bold text-lg mb-2">
              {form.title || "Titlul petiției"}
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-4 leading-relaxed">
              {form.summary || "Sumar..."}
            </p>
            <div className="text-sm whitespace-pre-line leading-relaxed">
              {form.body || "Conținut petiție..."}
            </div>
          </aside>
        )}
      </div>

      <div className="flex gap-3 pt-5 mt-5 border-t border-[var(--color-border)]">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="h-11 px-5 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] text-sm font-medium hover:bg-[var(--color-border)] disabled:opacity-50 transition-colors"
        >
          Anulează
        </button>
        {draftSavedAt && (
          <button
            type="button"
            onClick={clearDraft}
            disabled={saving}
            className="h-11 px-4 rounded-[var(--radius-xs)] text-xs text-[var(--color-text-muted)] hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            Șterge ciornă
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          aria-busy={saving}
          className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 size={14} aria-hidden="true" />
          )}
          {editingId ? "Salvează modificările" : "Publică petiția"}
        </button>
      </div>
    </form>
  );
}

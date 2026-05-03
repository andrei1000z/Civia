"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Megaphone,
  Plus,
  Edit3,
  Trash2,
  ExternalLink,
  Loader2,
  X,
  Save,
  Upload,
  ImageIcon,
  Calendar,
  MapPin,
  Users,
  Hash,
  Building2,
  Tag,
  Eye,
  EyeOff,
  Star,
  Trash,
  Check,
  Clock,
  Mail,
  MessageSquare,
  ShieldX,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { ALL_COUNTIES } from "@/data/counties";

export const dynamic = "force-dynamic";

interface ProtestRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  cause: string | null;
  description: string;
  demands: string[];
  tags: string[];
  start_at: string;
  end_at: string | null;
  location_name: string;
  city: string | null;
  county_slug: string | null;
  lat: number | null;
  lng: number | null;
  organizer: string | null;
  organizer_url: string | null;
  contact_email: string | null;
  external_url: string | null;
  hashtag: string | null;
  cover_image_url: string | null;
  cover_image_credit: string | null;
  expected_attendance: number | null;
  status: "planificat" | "in_desfasurare" | "incheiat" | "anulat";
  visibility: "publica" | "draft";
  featured: boolean;
  color_theme: string;
  // Moderation fields (migration 030)
  moderation_status: "pending" | "approved" | "rejected";
  submitter_name: string | null;
  submitter_email: string | null;
  submitter_note: string | null;
  rejected_reason: string | null;
  created_at: string;
  updated_at: string;
}

type FilterTab = "pending" | "approved" | "rejected" | "all";

interface DraftState {
  editingId: string | null;
  slug: string;
  title: string;
  subtitle: string;
  cause: string;
  description: string;
  demands: string[];
  tags: string[];
  start_at: string; // local datetime input
  end_at: string;
  location_name: string;
  city: string;
  county_slug: string;
  lat: string;
  lng: string;
  organizer: string;
  organizer_url: string;
  contact_email: string;
  external_url: string;
  hashtag: string;
  cover_image_url: string;
  cover_image_credit: string;
  expected_attendance: string;
  status: ProtestRow["status"];
  visibility: ProtestRow["visibility"];
  featured: boolean;
  color_theme: string;
}

const EMPTY_DRAFT: DraftState = {
  editingId: null,
  slug: "",
  title: "",
  subtitle: "",
  cause: "",
  description: "",
  demands: [],
  tags: [],
  start_at: "",
  end_at: "",
  location_name: "",
  city: "",
  county_slug: "",
  lat: "",
  lng: "",
  organizer: "",
  organizer_url: "",
  contact_email: "",
  external_url: "",
  hashtag: "",
  cover_image_url: "",
  cover_image_credit: "",
  expected_attendance: "",
  status: "planificat",
  visibility: "publica",
  featured: false,
  color_theme: "warning",
};

const COLOR_THEMES: { value: string; label: string; preview: string }[] = [
  { value: "warning", label: "Alert (amber/orange)", preview: "from-amber-600 to-rose-800" },
  { value: "primary", label: "Civic (verde)", preview: "from-emerald-600 to-indigo-800" },
  { value: "petition", label: "Petiție (purple)", preview: "from-purple-600 to-indigo-900" },
  { value: "news", label: "Sobru (slate)", preview: "from-slate-700 to-indigo-900" },
  { value: "success", label: "Pozitiv (teal)", preview: "from-emerald-600 to-teal-800" },
  { value: "data", label: "Informativ (sky)", preview: "from-sky-600 to-indigo-800" },
  { value: "authority", label: "Formal (slate-purple)", preview: "from-slate-700 to-indigo-900" },
  { value: "health", label: "Health (teal)", preview: "from-teal-600 to-cyan-800" },
];

function isoToInputDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function inputDateTimeToIso(local: string): string {
  if (!local) return "";
  return new Date(local).toISOString();
}

function rowToDraft(r: ProtestRow): DraftState {
  return {
    editingId: r.id,
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle ?? "",
    cause: r.cause ?? "",
    description: r.description,
    demands: r.demands ?? [],
    tags: r.tags ?? [],
    start_at: isoToInputDateTime(r.start_at),
    end_at: r.end_at ? isoToInputDateTime(r.end_at) : "",
    location_name: r.location_name,
    city: r.city ?? "",
    county_slug: r.county_slug ?? "",
    lat: r.lat != null ? String(r.lat) : "",
    lng: r.lng != null ? String(r.lng) : "",
    organizer: r.organizer ?? "",
    organizer_url: r.organizer_url ?? "",
    contact_email: r.contact_email ?? "",
    external_url: r.external_url ?? "",
    hashtag: r.hashtag ?? "",
    cover_image_url: r.cover_image_url ?? "",
    cover_image_credit: r.cover_image_credit ?? "",
    expected_attendance: r.expected_attendance != null ? String(r.expected_attendance) : "",
    status: r.status,
    visibility: r.visibility,
    featured: r.featured,
    color_theme: r.color_theme,
  };
}

const STATUS_LABEL: Record<ProtestRow["status"], string> = {
  planificat: "Programat",
  in_desfasurare: "În desfășurare",
  incheiat: "Încheiat",
  anulat: "Anulat",
};

export default function AdminProtestePage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ProtestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [demandsInput, setDemandsInput] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [filter, setFilter] = useState<FilterTab>("pending");
  const [moderating, setModerating] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/proteste")
      .then((r) => r.json())
      .then((j) => setRows(j.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    // Default start = next round hour
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 24);
    setDraft({
      ...EMPTY_DRAFT,
      start_at: isoToInputDateTime(now.toISOString()),
    });
    setDemandsInput("");
    setTagsInput("");
    setShowForm(true);
  };

  const openEdit = (row: ProtestRow) => {
    setDraft(rowToDraft(row));
    setDemandsInput("");
    setTagsInput("");
    setShowForm(true);
  };

  const cancelForm = () => {
    if (
      (draft.title || draft.description) &&
      !confirm("Renunți la modificări?")
    ) {
      return;
    }
    setDraft(EMPTY_DRAFT);
    setShowForm(false);
  };

  const addDemand = () => {
    const v = demandsInput.trim();
    if (!v) return;
    if (draft.demands.length >= 30) {
      toast("Maxim 30 de revendicări.", "error");
      return;
    }
    setDraft({ ...draft, demands: [...draft.demands, v] });
    setDemandsInput("");
  };

  const removeDemand = (i: number) => {
    setDraft({ ...draft, demands: draft.demands.filter((_, idx) => idx !== i) });
  };

  const addTag = () => {
    const v = tagsInput.trim();
    if (!v) return;
    if (draft.tags.includes(v)) {
      setTagsInput("");
      return;
    }
    if (draft.tags.length >= 20) {
      toast("Maxim 20 de tag-uri.", "error");
      return;
    }
    setDraft({ ...draft, tags: [...draft.tags, v] });
    setTagsInput("");
  };

  const removeTag = (t: string) => {
    setDraft({ ...draft, tags: draft.tags.filter((x) => x !== t) });
  };

  const uploadCover = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("files", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Eroare upload");
      const url = j.data?.urls?.[0];
      if (!url) throw new Error("Nu am primit URL");
      setDraft((d) => ({ ...d, cover_image_url: url }));
      toast("Imagine încărcată.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare upload", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const save = async () => {
    if (!draft.title.trim() || !draft.location_name.trim() || !draft.start_at) {
      toast("Completează cel puțin: titlu, locație, dată început.", "error");
      return;
    }
    if (draft.description.trim().length < 10) {
      toast("Descrierea trebuie să aibă minim 10 caractere.", "error");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim() || null,
        cause: draft.cause.trim() || null,
        description: draft.description.trim(),
        demands: draft.demands,
        tags: draft.tags,
        start_at: inputDateTimeToIso(draft.start_at),
        end_at: draft.end_at ? inputDateTimeToIso(draft.end_at) : null,
        location_name: draft.location_name.trim(),
        city: draft.city.trim() || null,
        county_slug: draft.county_slug || null,
        lat: draft.lat ? Number(draft.lat) : null,
        lng: draft.lng ? Number(draft.lng) : null,
        organizer: draft.organizer.trim() || null,
        organizer_url: draft.organizer_url.trim() || null,
        contact_email: draft.contact_email.trim() || null,
        external_url: draft.external_url.trim() || null,
        hashtag: draft.hashtag.trim() || null,
        cover_image_url: draft.cover_image_url.trim() || null,
        cover_image_credit: draft.cover_image_credit.trim() || null,
        expected_attendance: draft.expected_attendance
          ? Number(draft.expected_attendance)
          : null,
        status: draft.status,
        visibility: draft.visibility,
        featured: draft.featured,
        color_theme: draft.color_theme,
      };
      if (draft.slug.trim()) payload.slug = draft.slug.trim();

      const url = draft.editingId
        ? `/api/admin/proteste/${draft.editingId}`
        : "/api/admin/proteste";
      const method = draft.editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Eroare salvare");
      const saved = j.data as ProtestRow;
      if (draft.editingId) {
        setRows((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
        toast(`„${saved.title}" actualizat.`, "success");
      } else {
        setRows((prev) =>
          [saved, ...prev].sort(
            (a, b) =>
              new Date(b.start_at).getTime() - new Date(a.start_at).getTime(),
          ),
        );
        toast(`„${saved.title}" publicat.`, "success");
      }
      setDraft(EMPTY_DRAFT);
      setShowForm(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare", "error");
    } finally {
      setSaving(false);
    }
  };

  const del = async (row: ProtestRow) => {
    if (
      !confirm(
        `Ștergi „${row.title}"?\n\nAcțiunea nu poate fi anulată.`,
      )
    ) {
      return;
    }
    setDeleting(row.id);
    try {
      const res = await fetch(`/api/admin/proteste/${row.id}`, {
        method: "DELETE",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Eroare ștergere");
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast(`„${row.title}" șters.`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare", "error");
    } finally {
      setDeleting(null);
    }
  };

  const counts = useMemo(
    () => ({
      pending: rows.filter((r) => r.moderation_status === "pending").length,
      approved: rows.filter((r) => r.moderation_status === "approved").length,
      rejected: rows.filter((r) => r.moderation_status === "rejected").length,
      all: rows.length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.moderation_status === filter);
  }, [rows, filter]);

  const grouped = useMemo(() => {
    const upcoming = filtered.filter((r) =>
      r.status === "planificat" || r.status === "in_desfasurare",
    );
    const past = filtered.filter((r) =>
      r.status === "incheiat" || r.status === "anulat",
    );
    return { upcoming, past };
  }, [filtered]);

  const approve = async (row: ProtestRow) => {
    setModerating(row.id);
    try {
      const res = await fetch(`/api/admin/proteste/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moderation_status: "approved",
          visibility: "publica",
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Eroare aprobare");
      setRows((prev) => prev.map((r) => (r.id === row.id ? (j.data as ProtestRow) : r)));
      toast(`„${row.title}" aprobat și publicat.`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare", "error");
    } finally {
      setModerating(null);
    }
  };

  const reject = async (row: ProtestRow) => {
    const reason = prompt(
      `Motivul respingerii pentru „${row.title}"?\n\n(Apare în adminul tău, nu se trimite automat la submitter.)`,
      "",
    );
    if (reason === null) return;
    setModerating(row.id);
    try {
      const res = await fetch(`/api/admin/proteste/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moderation_status: "rejected",
          rejected_reason: reason.trim() || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Eroare respingere");
      setRows((prev) => prev.map((r) => (r.id === row.id ? (j.data as ProtestRow) : r)));
      toast(`„${row.title}" respins.`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare", "error");
    } finally {
      setModerating(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="font-[family-name:var(--font-sora)] text-xl md:text-2xl font-extrabold inline-flex items-center gap-2">
            <Megaphone size={20} className="text-[var(--color-primary)]" />
            Proteste programate
            {counts.pending > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold motion-safe:animate-pulse"
                aria-label={`${counts.pending} în așteptare`}
              >
                {counts.pending}
              </span>
            )}
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Listate public la{" "}
            <Link
              href="/proteste"
              target="_blank"
              className="text-[var(--color-primary)] hover:underline inline-flex items-center gap-0.5"
            >
              /proteste <ExternalLink size={10} aria-hidden="true" />
            </Link>
            . Submisii publice intră ca <strong>pending</strong> — verifică tab-ul „În așteptare" și aprobă sau respinge.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
          >
            <Plus size={14} aria-hidden="true" />
            Adaugă protest
          </button>
        )}
      </div>

      {/* Moderation filter tabs */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto no-scrollbar -mx-2 px-2">
        {([
          { value: "pending", label: "În așteptare", icon: Clock, count: counts.pending },
          { value: "approved", label: "Aprobate", icon: Check, count: counts.approved },
          { value: "rejected", label: "Respinse", icon: ShieldX, count: counts.rejected },
          { value: "all", label: "Toate", icon: Tag, count: counts.all },
        ] as const).map((t) => {
          const Icon = t.icon;
          const active = filter === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setFilter(t.value)}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-full)] text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
                active
                  ? "bg-[var(--color-primary)] text-white shadow-[var(--shadow-1)]"
                  : "text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
              }`}
            >
              <Icon size={12} aria-hidden="true" />
              {t.label}
              <span
                className={`min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full text-[10px] font-bold tabular-nums ${
                  active
                    ? "bg-white/25 text-white"
                    : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* FORM */}
      {showForm && (
        <div className="bg-[var(--color-surface)] border-2 border-[var(--color-primary)]/40 rounded-[var(--radius-md)] shadow-[var(--shadow-2)] p-5 md:p-6 mb-6 space-y-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-[family-name:var(--font-sora)] font-bold text-base">
              {draft.editingId ? "Editează protest" : "Protest nou"}
            </h2>
            <button
              type="button"
              onClick={cancelForm}
              className="w-9 h-9 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center hover:bg-[var(--color-bg)] transition-colors"
              aria-label="Închide formularul"
            >
              <X size={14} />
            </button>
          </div>

          {/* SECTION 1 — Identitate */}
          <Section title="Identitate" icon={Megaphone}>
            <Field label="Titlu *">
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder='ex: "Marș pentru aer curat în București"'
                maxLength={200}
                className={inputCls}
              />
            </Field>
            <Field label="Cauza pe scurt (4-8 cuvinte)">
              <input
                type="text"
                value={draft.cause}
                onChange={(e) => setDraft({ ...draft, cause: e.target.value })}
                placeholder='ex: "Poluarea din Capitală"'
                maxLength={120}
                className={inputCls}
              />
            </Field>
            <Field label="Subtitlu / one-liner">
              <textarea
                value={draft.subtitle}
                onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
                placeholder="Propoziție-două care explică ce e protestul"
                rows={2}
                maxLength={280}
                className={`${inputCls} resize-y`}
              />
            </Field>
            <Field label="Slug URL (opțional — generat din titlu)">
              <input
                type="text"
                value={draft.slug}
                onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                placeholder="mars-aer-curat-bucuresti"
                maxLength={120}
                className={`${inputCls} font-mono text-xs`}
              />
            </Field>
          </Section>

          {/* SECTION 2 — Dată + Locație */}
          <Section title="Dată și locație" icon={Calendar}>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Început *">
                <input
                  type="datetime-local"
                  value={draft.start_at}
                  onChange={(e) => setDraft({ ...draft, start_at: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Sfârșit estimat">
                <input
                  type="datetime-local"
                  value={draft.end_at}
                  onChange={(e) => setDraft({ ...draft, end_at: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Locație (denumire) *">
              <input
                type="text"
                value={draft.location_name}
                onChange={(e) => setDraft({ ...draft, location_name: e.target.value })}
                placeholder="ex: Piața Victoriei"
                maxLength={200}
                className={inputCls}
              />
            </Field>
            <div className="grid sm:grid-cols-[1fr_180px] gap-3">
              <Field label="Oraș">
                <input
                  type="text"
                  value={draft.city}
                  onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                  placeholder="București"
                  maxLength={120}
                  className={inputCls}
                />
              </Field>
              <Field label="Județ">
                <select
                  value={draft.county_slug}
                  onChange={(e) => setDraft({ ...draft, county_slug: e.target.value })}
                  className={inputCls}
                >
                  <option value="">— niciunul —</option>
                  {ALL_COUNTIES.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Latitudine (opțional)">
                <input
                  type="number"
                  step="any"
                  value={draft.lat}
                  onChange={(e) => setDraft({ ...draft, lat: e.target.value })}
                  placeholder="44.4523"
                  className={`${inputCls} font-mono text-xs`}
                />
              </Field>
              <Field label="Longitudine (opțional)">
                <input
                  type="number"
                  step="any"
                  value={draft.lng}
                  onChange={(e) => setDraft({ ...draft, lng: e.target.value })}
                  placeholder="26.0863"
                  className={`${inputCls} font-mono text-xs`}
                />
              </Field>
            </div>
          </Section>

          {/* SECTION 3 — Conținut */}
          <Section title="Descriere și revendicări" icon={Tag}>
            <Field label="Descriere completă (markdown light) *">
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder={`## Context

Paragraf despre situație...

- Punct 1
- Punct 2 cu **bold**

Mai mult text aici.`}
                rows={10}
                maxLength={20000}
                className={`${inputCls} font-mono text-xs leading-relaxed resize-y`}
              />
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                Suport: <code>## titlu</code>, <code>- bullet</code>,{" "}
                <code>**bold**</code>, paragrafe separate de linie goală.
              </p>
            </Field>

            <Field label="Revendicări (lista numerotată)">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={demandsInput}
                  onChange={(e) => setDemandsInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addDemand();
                    }
                  }}
                  placeholder='ex: "Reducere PM2.5 sub limita UE"'
                  maxLength={500}
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={addDemand}
                  className="h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-xs font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
                >
                  Adaugă
                </button>
              </div>
              {draft.demands.length > 0 && (
                <ol className="mt-2 space-y-1">
                  {draft.demands.map((d, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-2"
                    >
                      <span className="font-mono text-[10px] text-[var(--color-text-muted)] mt-0.5 shrink-0">
                        {i + 1}.
                      </span>
                      <span className="flex-1">{d}</span>
                      <button
                        type="button"
                        onClick={() => removeDemand(i)}
                        className="shrink-0 text-rose-500 hover:text-rose-700"
                        aria-label="Șterge revendicare"
                      >
                        <Trash size={11} />
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </Field>

            <Field label="Tag-uri (Enter pentru a adăuga)">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="ex: ecologie, anti-coruptie, drepturi"
                  maxLength={40}
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-semibold hover:bg-[var(--color-bg)] transition-colors"
                >
                  +
                </button>
              </div>
              {draft.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {draft.tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-[var(--radius-pill)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-xs"
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTag(t)}
                        className="w-4 h-4 grid place-items-center hover:bg-[var(--color-primary)]/20 rounded-full"
                        aria-label={`Șterge ${t}`}
                      >
                        <X size={9} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </Field>
          </Section>

          {/* SECTION 4 — Imagine */}
          <Section title="Imagine cover" icon={ImageIcon}>
            {draft.cover_image_url ? (
              <div className="relative rounded-[var(--radius-md)] overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-2)]">
                <div className="relative aspect-[16/9]">
                  {/* Use plain img to avoid Next/Image domain config friction
                      with arbitrary uploaded URLs while previewing. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={draft.cover_image_url}
                    alt="Preview"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, cover_image_url: "" })}
                  className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/60 text-white grid place-items-center hover:bg-black/80 transition-colors"
                  aria-label="Elimină imaginea"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed border-[var(--color-border)] rounded-[var(--radius-md)] p-8 text-center hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors flex flex-col items-center gap-2 disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 size={22} className="text-[var(--color-primary)] motion-safe:animate-spin" />
                ) : (
                  <Upload size={22} className="text-[var(--color-text-muted)]" />
                )}
                <p className="text-sm font-semibold">
                  {uploading ? "Se încarcă..." : "Click pentru a încărca"}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  JPG, PNG, WebP. Recomandat 1600×900.
                </p>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadCover(f);
              }}
            />
            <Field label="URL imagine (alternativă: paste direct)">
              <input
                type="url"
                value={draft.cover_image_url}
                onChange={(e) => setDraft({ ...draft, cover_image_url: e.target.value })}
                placeholder="https://..."
                className={`${inputCls} text-xs`}
              />
            </Field>
            <Field label="Credit foto">
              <input
                type="text"
                value={draft.cover_image_credit}
                onChange={(e) => setDraft({ ...draft, cover_image_credit: e.target.value })}
                placeholder='ex: "Foto: Andrei Pungovschi / Inquam"'
                maxLength={200}
                className={inputCls}
              />
            </Field>
          </Section>

          {/* SECTION 5 — Organizator + contact */}
          <Section title="Organizator și contact" icon={Building2}>
            <Field label="Organizator">
              <input
                type="text"
                value={draft.organizer}
                onChange={(e) => setDraft({ ...draft, organizer: e.target.value })}
                placeholder="ex: Declic, Greenpeace România, Inițiativa România"
                maxLength={200}
                className={inputCls}
              />
            </Field>
            <Field label="Site / pagină organizator">
              <input
                type="url"
                value={draft.organizer_url}
                onChange={(e) => setDraft({ ...draft, organizer_url: e.target.value })}
                placeholder="https://declic.ro"
                className={inputCls}
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Email contact">
                <input
                  type="email"
                  value={draft.contact_email}
                  onChange={(e) => setDraft({ ...draft, contact_email: e.target.value })}
                  placeholder="contact@..."
                  className={inputCls}
                />
              </Field>
              <Field label="Estimare participanți">
                <input
                  type="number"
                  min={0}
                  value={draft.expected_attendance}
                  onChange={(e) =>
                    setDraft({ ...draft, expected_attendance: e.target.value })
                  }
                  placeholder="ex: 5000"
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Eveniment extern (Facebook etc.)">
                <input
                  type="url"
                  value={draft.external_url}
                  onChange={(e) => setDraft({ ...draft, external_url: e.target.value })}
                  placeholder="https://facebook.com/events/..."
                  className={inputCls}
                />
              </Field>
              <Field label="Hashtag">
                <input
                  type="text"
                  value={draft.hashtag}
                  onChange={(e) => setDraft({ ...draft, hashtag: e.target.value })}
                  placeholder="#FaraCorupție"
                  maxLength={60}
                  className={inputCls}
                />
              </Field>
            </div>
          </Section>

          {/* SECTION 6 — Publicare */}
          <Section title="Publicare și aspect" icon={Eye}>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Status">
                <select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value as DraftState["status"] })
                  }
                  className={inputCls}
                >
                  <option value="planificat">Programat</option>
                  <option value="in_desfasurare">În desfășurare</option>
                  <option value="incheiat">Încheiat</option>
                  <option value="anulat">Anulat</option>
                </select>
              </Field>
              <Field label="Vizibilitate">
                <select
                  value={draft.visibility}
                  onChange={(e) =>
                    setDraft({ ...draft, visibility: e.target.value as DraftState["visibility"] })
                  }
                  className={inputCls}
                >
                  <option value="publica">Publică</option>
                  <option value="draft">Draft (ascuns)</option>
                </select>
              </Field>
            </div>

            <Field label="Tema vizuală (gradient hero)">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {COLOR_THEMES.map((t) => (
                  <button
                    type="button"
                    key={t.value}
                    onClick={() => setDraft({ ...draft, color_theme: t.value })}
                    className={`relative h-14 rounded-[var(--radius-xs)] bg-gradient-to-br ${t.preview} text-white text-[10px] font-semibold p-2 text-left overflow-hidden ${
                      draft.color_theme === t.value
                        ? "ring-2 ring-offset-2 ring-[var(--color-primary)] ring-offset-[var(--color-surface)]"
                        : "opacity-70 hover:opacity-100"
                    } transition-all`}
                  >
                    <span className="relative z-10">{t.label}</span>
                  </button>
                ))}
              </div>
            </Field>

            <label className="flex items-center gap-2.5 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={draft.featured}
                onChange={(e) => setDraft({ ...draft, featured: e.target.checked })}
                className="w-4 h-4 accent-[var(--color-primary)]"
              />
              <Star size={14} className="text-amber-500" aria-hidden="true" />
              <span>Featured — apare cu badge auriu și e listat primul</span>
            </label>
          </Section>

          {/* ACTIONS */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={cancelForm}
              disabled={saving}
              className="h-10 px-4 rounded-[var(--radius-button)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-bg)] transition-colors"
            >
              Anulează
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 h-10 px-5 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
            >
              {saving ? (
                <Loader2 size={14} className="motion-safe:animate-spin" />
              ) : (
                <Save size={14} aria-hidden="true" />
              )}
              {draft.editingId ? "Salvează modificările" : "Publică protestul"}
            </button>
          </div>
        </div>
      )}

      {/* LIST */}
      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          <Loader2 size={20} className="motion-safe:animate-spin mx-auto mb-2" />
          Se încarcă...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] rounded-[var(--radius-md)] p-10 text-center">
          <Megaphone size={28} className="text-[var(--color-text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--color-text-muted)] mb-3">
            {filter === "pending" && "Nicio submisie publică în așteptare. 🎉"}
            {filter === "approved" && "Niciun protest aprobat încă."}
            {filter === "rejected" && "Niciun protest respins."}
            {filter === "all" && "Nu există încă niciun protest."}
          </p>
          {!showForm && filter !== "pending" && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
            >
              <Plus size={14} aria-hidden="true" />
              Adaugă protest
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.upcoming.length > 0 && (
            <ListGroup
              title="Active și viitoare"
              rows={grouped.upcoming}
              onEdit={openEdit}
              onDelete={del}
              onApprove={approve}
              onReject={reject}
              deleting={deleting}
              moderating={moderating}
              saving={saving}
            />
          )}
          {grouped.past.length > 0 && (
            <ListGroup
              title="Arhivă"
              rows={grouped.past}
              onEdit={openEdit}
              onDelete={del}
              onApprove={approve}
              onReject={reject}
              deleting={deleting}
              moderating={moderating}
              saving={saving}
              muted
            />
          )}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full h-10 px-3 rounded-[var(--radius-xs)] bg-[var(--color-bg)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Calendar;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="font-[family-name:var(--font-sora)] font-bold text-sm inline-flex items-center gap-2 mb-1">
        <Icon size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function ListGroup({
  title,
  rows,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  deleting,
  moderating,
  saving,
  muted = false,
}: {
  title: string;
  rows: ProtestRow[];
  onEdit: (r: ProtestRow) => void;
  onDelete: (r: ProtestRow) => void;
  onApprove: (r: ProtestRow) => void;
  onReject: (r: ProtestRow) => void;
  deleting: string | null;
  moderating: string | null;
  saving: boolean;
  muted?: boolean;
}) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-2">
        {title} ({rows.length})
      </h2>
      <ul className="space-y-3">
        {rows.map((r) => {
          const isPending = r.moderation_status === "pending";
          const isRejected = r.moderation_status === "rejected";
          const submittedByPublic = !!r.submitter_email;
          return (
            <li
              key={r.id}
              className={`rounded-[var(--radius-md)] shadow-[var(--shadow-1)] p-4 border ${
                isPending
                  ? "bg-amber-500/5 border-amber-500/40"
                  : isRejected
                    ? "bg-rose-500/5 border-rose-500/30 opacity-80"
                    : `bg-[var(--color-surface)] border-[var(--color-border)] ${muted ? "opacity-80" : ""}`
              }`}
            >
              <div className="flex items-start gap-3 flex-wrap">
                {r.cover_image_url && (
                  <div className="relative w-20 h-14 rounded-[var(--radius-xs)] overflow-hidden bg-[var(--color-surface-2)] shrink-0">
                    <Image
                      src={r.cover_image_url}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap mb-1">
                    {isPending && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider">
                        <Clock size={9} /> În așteptare
                      </span>
                    )}
                    {isRejected && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-rose-500/15 text-rose-700 dark:text-rose-300 text-[10px] font-bold uppercase">
                        <ShieldX size={9} /> Respins
                      </span>
                    )}
                    {r.featured && (
                      <Star size={12} className="text-amber-500 shrink-0" aria-hidden="true" />
                    )}
                    {!isPending && !isRejected && (
                      r.visibility === "draft" ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase">
                          <EyeOff size={9} /> Draft
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase">
                          <Eye size={9} /> Public
                        </span>
                      )
                    )}
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] text-[10px] font-semibold uppercase tracking-wider">
                      {STATUS_LABEL[r.status]}
                    </span>
                    <h3 className="font-[family-name:var(--font-sora)] font-bold text-base truncate flex-1 min-w-0">
                      {r.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap text-[11px] text-[var(--color-text-muted)] tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={10} aria-hidden="true" />
                      {new Date(r.start_at).toLocaleString("ro-RO", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Europe/Bucharest",
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={10} aria-hidden="true" />
                      {r.location_name}
                    </span>
                    {r.expected_attendance != null && (
                      <span className="inline-flex items-center gap-1">
                        <Users size={10} aria-hidden="true" />
                        ~{r.expected_attendance.toLocaleString("ro-RO")}
                      </span>
                    )}
                    {r.hashtag && (
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Hash size={10} aria-hidden="true" />
                        {r.hashtag.replace(/^#/, "")}
                      </span>
                    )}
                  </div>

                  {/* Submitter info — apare doar pe entry-urile venite din public */}
                  {submittedByPublic && (
                    <div className="mt-2 flex items-center gap-3 flex-wrap text-[11px] text-[var(--color-text)]">
                      <span className="inline-flex items-center gap-1">
                        <Users size={10} className="text-[var(--color-text-muted)]" aria-hidden="true" />
                        Trimis de <strong>{r.submitter_name ?? "necunoscut"}</strong>
                      </span>
                      {r.submitter_email && (
                        <a
                          href={`mailto:${r.submitter_email}`}
                          className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                        >
                          <Mail size={10} aria-hidden="true" />
                          {r.submitter_email}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Mesajul submitter-ului către admin */}
                  {r.submitter_note && (
                    <div className="mt-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-2 text-[11px] text-[var(--color-text)] leading-relaxed">
                      <p className="inline-flex items-center gap-1 font-semibold text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-0.5">
                        <MessageSquare size={9} aria-hidden="true" />
                        Mesaj de la submitter
                      </p>
                      <p className="whitespace-pre-wrap">{r.submitter_note}</p>
                    </div>
                  )}

                  {/* Motivul respingerii */}
                  {isRejected && r.rejected_reason && (
                    <div className="mt-2 bg-rose-500/10 border border-rose-500/30 rounded-[var(--radius-xs)] p-2 text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed">
                      <p className="font-semibold text-[10px] uppercase tracking-wider mb-0.5">
                        Motiv respingere
                      </p>
                      <p>{r.rejected_reason}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  {isPending && (
                    <>
                      <button
                        type="button"
                        onClick={() => onApprove(r)}
                        disabled={moderating === r.id || saving}
                        className="inline-flex items-center gap-1 h-9 px-3 rounded-[var(--radius-xs)] bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        title="Aprobă și publică"
                      >
                        {moderating === r.id ? (
                          <Loader2 size={12} className="motion-safe:animate-spin" />
                        ) : (
                          <Check size={12} />
                        )}
                        Aprobă
                      </button>
                      <button
                        type="button"
                        onClick={() => onReject(r)}
                        disabled={moderating === r.id || saving}
                        className="inline-flex items-center gap-1 h-9 px-3 rounded-[var(--radius-xs)] bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-500/20 disabled:opacity-50 transition-colors"
                        title="Respinge"
                      >
                        <ShieldX size={12} />
                        Respinge
                      </button>
                    </>
                  )}
                  <Link
                    href={`/proteste/${r.slug}`}
                    target="_blank"
                    className="w-9 h-9 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-primary)]/40 transition-colors"
                    title="Vezi public"
                  >
                    <ExternalLink size={13} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => onEdit(r)}
                    disabled={deleting === r.id || saving || moderating === r.id}
                    className="w-9 h-9 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center hover:border-[var(--color-primary)]/40 transition-colors disabled:opacity-50"
                    title="Editează"
                  >
                    <Edit3 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(r)}
                    disabled={deleting === r.id || saving || moderating === r.id}
                    className="w-9 h-9 rounded-[var(--radius-xs)] bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center hover:bg-rose-500/20 hover:border-rose-500/50 disabled:opacity-50 transition-colors"
                    title="Șterge"
                  >
                    {deleting === r.id ? (
                      <Loader2 size={13} className="motion-safe:animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}


"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Plus,
  X,
  Loader2,
  Send,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Video,
  Link as LinkIcon,
} from "lucide-react";
import type {
  AftermathData,
  AftermathImage,
  AftermathVideo,
  AftermathSource,
} from "@/lib/proteste/aftermath";
import { EMPTY_AFTERMATH } from "@/lib/proteste/aftermath";

interface Props {
  slug: string;
  protestTitle: string;
}

interface ScrapeResponse {
  data?: AftermathData;
  scraped_summary?: { total: number; ok: number; failed: number };
  error?: string;
}

interface SaveResponse {
  ok?: boolean;
  status?: string;
  error?: string;
}

export function AftermathForm({ slug, protestTitle: _protestTitle }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // ----- AI scrape state -----
  const [urlsRaw, setUrlsRaw] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapeSummary, setScrapeSummary] = useState<string | null>(null);

  // ----- Form state -----
  const [data, setData] = useState<AftermathData>(EMPTY_AFTERMATH);

  // ----- Submission state -----
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitOk, setSubmitOk] = useState(false);

  function patch(patch: Partial<AftermathData>) {
    setData((d) => ({ ...d, ...patch }));
  }

  async function handleScrape() {
    setScrapeError(null);
    setScrapeSummary(null);

    const urls = urlsRaw
      .split(/[\n,\s]+/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//i.test(u));

    if (urls.length === 0) {
      setScrapeError("Adaugă cel puțin un link valid (cu https://).");
      return;
    }
    if (urls.length > 10) {
      setScrapeError("Maxim 10 link-uri o dată.");
      return;
    }

    setScraping(true);
    try {
      const res = await fetch(`/api/proteste/${slug}/aftermath/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_urls: urls }),
      });
      const json: ScrapeResponse = await res.json();
      if (!res.ok || !json.data) {
        setScrapeError(json.error ?? "AI nu a putut completa.");
        return;
      }
      setData(json.data);
      if (json.scraped_summary) {
        const { total, ok, failed } = json.scraped_summary;
        setScrapeSummary(
          failed > 0
            ? `Citite ${ok}/${total} link-uri (${failed} au eșuat — verifică-le manual).`
            : `Citite cu succes ${ok}/${total} link-uri. Verifică câmpurile mai jos.`,
        );
      }
    } catch {
      setScrapeError("Eroare de rețea. Încearcă din nou.");
    } finally {
      setScraping(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/proteste/${slug}/aftermath/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aftermath: data }),
      });
      const json: SaveResponse = await res.json();
      if (!res.ok) {
        setSubmitError(json.error ?? "Submisia a eșuat.");
        return;
      }
      setSubmitOk(true);
      startTransition(() => {
        // Redirect to public detail page so admin vede aftermath-ul publicat
        setTimeout(() => router.push(`/proteste/${slug}?aftermath=published`), 1200);
      });
    } catch {
      setSubmitError("Eroare de rețea. Încearcă din nou.");
    } finally {
      setSubmitting(false);
    }
  }

  // ----- List editors -----
  const addChant = () => patch({ chants: [...data.chants, ""] });
  const updateChant = (i: number, v: string) =>
    patch({ chants: data.chants.map((x, idx) => (idx === i ? v : x)) });
  const removeChant = (i: number) =>
    patch({ chants: data.chants.filter((_, idx) => idx !== i) });

  const addMoment = () => patch({ key_moments: [...data.key_moments, ""] });
  const updateMoment = (i: number, v: string) =>
    patch({ key_moments: data.key_moments.map((x, idx) => (idx === i ? v : x)) });
  const removeMoment = (i: number) =>
    patch({ key_moments: data.key_moments.filter((_, idx) => idx !== i) });

  const addImage = () => patch({ images: [...data.images, { url: "" }] });
  const updateImage = (i: number, p: Partial<AftermathImage>) =>
    patch({
      images: data.images.map((x, idx) => (idx === i ? { ...x, ...p } : x)),
    });
  const removeImage = (i: number) =>
    patch({ images: data.images.filter((_, idx) => idx !== i) });

  const addVideo = () => patch({ videos: [...data.videos, { url: "" }] });
  const updateVideo = (i: number, p: Partial<AftermathVideo>) =>
    patch({
      videos: data.videos.map((x, idx) => (idx === i ? { ...x, ...p } : x)),
    });
  const removeVideo = (i: number) =>
    patch({ videos: data.videos.filter((_, idx) => idx !== i) });

  const addSource = () => patch({ sources: [...data.sources, { url: "" }] });
  const updateSource = (i: number, p: Partial<AftermathSource>) =>
    patch({
      sources: data.sources.map((x, idx) => (idx === i ? { ...x, ...p } : x)),
    });
  const removeSource = (i: number) =>
    patch({ sources: data.sources.filter((_, idx) => idx !== i) });

  if (submitOk) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-emerald-500/30 bg-emerald-500/10 p-8 text-center space-y-3">
        <CheckCircle2 size={48} className="mx-auto text-emerald-500" aria-hidden />
        <h2 className="font-[family-name:var(--font-sora)] font-bold text-xl">
          Aftermath publicat!
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Conținutul e LIVE pe pagina protestului. Te redirecționez...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* AI scrape block */}
      <section className="rounded-[var(--radius-lg)] border-2 border-[var(--color-primary)]/30 bg-gradient-to-br from-[var(--color-primary)]/5 to-transparent p-5 md:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Sparkles
            size={22}
            className="text-[var(--color-primary)] shrink-0 mt-1"
            aria-hidden
          />
          <div className="flex-1 min-w-0">
            <h2 className="font-[family-name:var(--font-sora)] font-bold text-base md:text-lg mb-1">
              Completează automat din presă
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              Lipește 1-10 link-uri către articole care relatează protestul (un link per linie).
              AI citește toate și completează câmpurile.
            </p>
          </div>
        </div>

        <textarea
          value={urlsRaw}
          onChange={(e) => setUrlsRaw(e.target.value)}
          placeholder={
            "https://www.digi24.ro/...\nhttps://hotnews.ro/...\nhttps://g4media.ro/..."
          }
          rows={5}
          className="w-full rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />

        {scrapeError && (
          <div className="flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle size={14} className="shrink-0 mt-0.5" aria-hidden />
            <span>{scrapeError}</span>
          </div>
        )}
        {scrapeSummary && (
          <div className="flex items-start gap-2 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={14} className="shrink-0 mt-0.5" aria-hidden />
            <span>{scrapeSummary}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleScrape}
          disabled={scraping || !urlsRaw.trim()}
          className="w-full inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white font-semibold py-3 text-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {scraping ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden />
              Citesc articolele și sintetizez (10-30 sec)...
            </>
          ) : (
            <>
              <Sparkles size={16} aria-hidden />
              Completează cu AI
            </>
          )}
        </button>
      </section>

      {/* MAIN FORM FIELDS */}
      <section className="space-y-6">
        {/* Attendance */}
        <Field
          label="Estimare participanți"
          hint="Cifre apar de obicei în articole. Lasă gol dacă nu știi."
        >
          <input
            type="number"
            min={0}
            max={10_000_000}
            value={data.attendance_estimate ?? ""}
            onChange={(e) =>
              patch({
                attendance_estimate: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            placeholder="ex: 3500"
            className="w-full rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </Field>

        {/* Narrative */}
        <Field
          label="Cum a fost — narativ"
          hint="3-6 paragrafe: atmosfera, traseul, momente cheie, reacții. Stil neutru."
          required
        >
          <textarea
            value={data.narrative}
            onChange={(e) => patch({ narrative: e.target.value })}
            rows={8}
            maxLength={8000}
            placeholder="Câteva mii de oameni s-au adunat în Piața Universității începând cu ora 18:00..."
            className="w-full rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1 text-right">
            {data.narrative.length} / 8000
          </p>
        </Field>

        {/* Chants */}
        <Field
          label="Sloganuri scandate"
          hint={`Câte unul per câmp. Ex: „Nu vrem dictatură”, „Justiție pentru victime”.`}
        >
          <ListEditor
            items={data.chants}
            onAdd={addChant}
            onUpdate={updateChant}
            onRemove={removeChant}
            placeholder="Slogan scandat..."
            addLabel="Adaugă slogan"
            maxItems={12}
          />
        </Field>

        {/* Key moments */}
        <Field
          label="Momente cheie"
          hint={`Cronologic. Ex: „17:30 — pornire marș”, „discurs reprezentant cetățeni”.`}
        >
          <ListEditor
            items={data.key_moments}
            onAdd={addMoment}
            onUpdate={updateMoment}
            onRemove={removeMoment}
            placeholder="ex: 18:00 — sosire în Piața Victoriei"
            addLabel="Adaugă moment"
            maxItems={8}
          />
        </Field>

        {/* Outcome */}
        <Field
          label="Ce a urmat după"
          hint="Declarații oficiale, decizii, reacții politice (max 4000 caractere)."
        >
          <textarea
            value={data.outcome}
            onChange={(e) => patch({ outcome: e.target.value })}
            rows={5}
            maxLength={4000}
            placeholder="A doua zi, ministrul X a declarat că..."
            className="w-full rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </Field>

        {/* Images */}
        <Field
          label="Galerie poze"
          hint="URL-uri publice (Imgur, Twitter media, OG images din articole). Max 12."
          icon={ImageIcon}
        >
          <div className="space-y-2">
            {data.images.map((img, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto] gap-2 items-start"
              >
                <div className="space-y-1.5">
                  <input
                    type="url"
                    value={img.url}
                    onChange={(e) => updateImage(i, { url: e.target.value })}
                    placeholder="https://exemplu.com/poza.jpg"
                    className="w-full rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                  <input
                    type="text"
                    value={img.credit ?? ""}
                    onChange={(e) => updateImage(i, { credit: e.target.value })}
                    placeholder="Credit / sursă (optional)"
                    className="w-full rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="shrink-0 w-9 h-9 rounded-[var(--radius-xs)] bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 grid place-items-center transition-colors"
                  aria-label="Șterge poza"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {data.images.length < 12 && (
              <button
                type="button"
                onClick={addImage}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] py-2 text-xs text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
              >
                <Plus size={13} aria-hidden /> Adaugă poză
              </button>
            )}
          </div>
        </Field>

        {/* Videos */}
        <Field
          label="Video-uri"
          hint="Link-uri YouTube, TikTok, Instagram, Facebook video."
          icon={Video}
        >
          <div className="space-y-2">
            {data.videos.map((vid, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto] gap-2 items-start"
              >
                <div className="space-y-1.5">
                  <input
                    type="url"
                    value={vid.url}
                    onChange={(e) => updateVideo(i, { url: e.target.value })}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                  <input
                    type="text"
                    value={vid.title ?? ""}
                    onChange={(e) => updateVideo(i, { title: e.target.value })}
                    placeholder="Titlu / descriere video (optional)"
                    className="w-full rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeVideo(i)}
                  className="shrink-0 w-9 h-9 rounded-[var(--radius-xs)] bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 grid place-items-center transition-colors"
                  aria-label="Șterge video"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {data.videos.length < 8 && (
              <button
                type="button"
                onClick={addVideo}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] py-2 text-xs text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
              >
                <Plus size={13} aria-hidden /> Adaugă video
              </button>
            )}
          </div>
        </Field>

        {/* Sources */}
        <Field
          label="Surse presă"
          hint="Articole de presă care relatează protestul. Completate automat de AI dacă ai folosit scrape-ul de sus."
          icon={LinkIcon}
        >
          <div className="space-y-2">
            {data.sources.map((src, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_auto] gap-2 items-start"
              >
                <div className="space-y-1.5">
                  <input
                    type="url"
                    value={src.url}
                    onChange={(e) => updateSource(i, { url: e.target.value })}
                    placeholder="https://hotnews.ro/articol-..."
                    className="w-full rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                  <input
                    type="text"
                    value={src.title ?? ""}
                    onChange={(e) => updateSource(i, { title: e.target.value })}
                    placeholder="Titlu articol"
                    className="w-full rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                  <input
                    type="text"
                    value={src.publication ?? ""}
                    onChange={(e) => updateSource(i, { publication: e.target.value })}
                    placeholder="Publicație (ex: HotNews, Digi24)"
                    className="w-full rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeSource(i)}
                  className="shrink-0 w-9 h-9 rounded-[var(--radius-xs)] bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 grid place-items-center transition-colors"
                  aria-label="Șterge sursă"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {data.sources.length < 15 && (
              <button
                type="button"
                onClick={addSource}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] py-2 text-xs text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
              >
                <Plus size={13} aria-hidden /> Adaugă sursă
              </button>
            )}
          </div>
        </Field>
      </section>

      {/* Submit */}
      <div className="space-y-3">
        {submitError && (
          <div className="flex items-start gap-2 text-sm text-rose-600 dark:text-rose-400 rounded-[var(--radius-sm)] bg-rose-500/10 border border-rose-500/30 p-3">
            <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden />
            <span>{submitError}</span>
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-[var(--radius-button)] bg-[var(--color-primary)] text-white font-semibold py-3.5 text-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden />
              Se publică...
            </>
          ) : (
            <>
              <Send size={15} aria-hidden />
              Publică direct (admin)
            </>
          )}
        </button>
      </div>
    </form>
  );
}

// ----- Helper components -----

function Field({
  label,
  hint,
  required,
  icon: Icon,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  icon?: React.ComponentType<{ size?: number; "aria-hidden"?: boolean; className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-[var(--color-text)] inline-flex items-center gap-1.5">
        {Icon && <Icon size={13} aria-hidden className="text-[var(--color-text-muted)]" />}
        {label}
        {required && <span className="text-rose-500">*</span>}
      </label>
      {hint && (
        <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">{hint}</p>
      )}
      {children}
    </div>
  );
}

function ListEditor({
  items,
  onAdd,
  onUpdate,
  onRemove,
  placeholder,
  addLabel,
  maxItems,
}: {
  items: string[];
  onAdd: () => void;
  onUpdate: (i: number, v: string) => void;
  onRemove: (i: number) => void;
  placeholder: string;
  addLabel: string;
  maxItems: number;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-start">
          <input
            type="text"
            value={item}
            onChange={(e) => onUpdate(i, e.target.value)}
            placeholder={placeholder}
            className="flex-1 rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="shrink-0 w-9 h-9 rounded-[var(--radius-xs)] bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 grid place-items-center transition-colors"
            aria-label="Șterge"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      {items.length < maxItems && (
        <button
          type="button"
          onClick={onAdd}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] py-2 text-xs text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
        >
          <Plus size={13} aria-hidden /> {addLabel}
        </button>
      )}
    </div>
  );
}

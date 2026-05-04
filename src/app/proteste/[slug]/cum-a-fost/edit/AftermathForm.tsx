"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
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
  Upload,
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

interface ScrapedUrlStatus {
  url: string;
  ok: boolean;
  title?: string | null;
  error?: string;
}

interface ScrapeResponse {
  data?: AftermathData;
  scraped_summary?: { total: number; ok: number; failed: number };
  scraped_details?: ScrapedUrlStatus[];
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
  const [scrapeDetails, setScrapeDetails] = useState<ScrapedUrlStatus[]>([]);

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
    setScrapeDetails([]);

    // Extragem URL-urile din text liber (regex pe https?://...).
    // Restul text-ului — non-URL — devine `notes` (observații admin)
    // pe care AI-ul le folosește ca sursă PRIMARĂ.
    const URL_RE = /https?:\/\/[^\s<>"]+/gi;
    const urls = (urlsRaw.match(URL_RE) ?? [])
      .map((u) => u.trim().replace(/[.,;:!?)]+$/, ""))
      .slice(0, 10);
    const notes = urlsRaw.replace(URL_RE, " ").replace(/\s+/g, " ").trim();

    if (urls.length === 0 && notes.length < 30) {
      setScrapeError("Adaugă link-uri presă SAU scrie observații (min. 30 caractere).");
      return;
    }
    if (urls.length > 10) {
      setScrapeError("Maxim 10 link-uri.");
      return;
    }

    setScraping(true);
    try {
      const res = await fetch(`/api/proteste/${slug}/aftermath/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_urls: urls, notes: notes || undefined }),
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
            ? `Citite ${ok}/${total} link-uri (${failed} au eșuat — vezi detalii mai jos).`
            : `Citite cu succes ${ok}/${total} link-uri. Verifică câmpurile mai jos.`,
        );
      }
      if (json.scraped_details) setScrapeDetails(json.scraped_details);
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

  const addMessage = () => patch({ messages: [...data.messages, ""] });
  const updateMessage = (i: number, v: string) =>
    patch({ messages: data.messages.map((x, idx) => (idx === i ? v : x)) });
  const removeMessage = (i: number) =>
    patch({ messages: data.messages.filter((_, idx) => idx !== i) });

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

  // Upload state — admin poate alege fișiere locale (poze sau video) și
  // le urcăm pe Supabase Storage via /api/upload, apoi auto-append-uim
  // URL-urile la lista de images/videos. Mai prietenos decât „pastează URL".
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleImageUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError(null);

    const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const MAX = 10 * 1024 * 1024; // 10 MB după compresie tipic safe; iPhone HEIC poate veni mare
    const filesArr = Array.from(files).slice(0, 5);
    for (const f of filesArr) {
      if (!ALLOWED.includes(f.type)) {
        setUploadError(`Format imagine nesuportat: ${f.type}. Folosește JPG, PNG, WebP sau GIF.`);
        return;
      }
      if (f.size > MAX) {
        setUploadError(`Imaginea „${f.name}" e prea mare (${(f.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`);
        return;
      }
    }

    setUploadingImages(true);
    try {
      // Upload DIRECT la Supabase din browser pentru a bypass-ăui Vercel
      // body limit 4.5MB (Hobby plan). iPhone photos pot fi 4-7MB.
      const supabase = createSupabaseBrowser();
      const uploaded: string[] = [];
      for (const f of filesArr) {
        const extMap: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
          "image/gif": "gif",
        };
        const ext = extMap[f.type] ?? "jpg";
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const path = `public/${filename}`;
        const { error: upErr } = await supabase.storage
          .from("sesizari-photos")
          .upload(path, f, { contentType: f.type, cacheControl: "3600" });
        if (upErr) {
          setUploadError(`Upload eșuat „${f.name}": ${upErr.message}`);
          break;
        }
        const { data: pub } = supabase.storage
          .from("sesizari-photos")
          .getPublicUrl(path);
        if (pub?.publicUrl) uploaded.push(pub.publicUrl);
      }
      if (uploaded.length > 0) {
        // Functional setData ca să evităm stale closure (când user
        // dă 2 upload-uri rapid în succesiune, `data` e capturat la
        // momentul primului apel și nu vede primul update).
        setData((d) => ({
          ...d,
          // În plus, scoatem entry-urile cu url="" (placeholder de la
          // „Lipește URL" rămase goale) ca să nu rămână linii moarte.
          images: [
            ...d.images.filter((img) => img.url.trim().length > 0),
            ...uploaded.map((url) => ({ url })),
          ].slice(0, 12),
        }));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Eroare necunoscută";
      setUploadError(`Eroare la upload: ${msg}`);
    } finally {
      setUploadingImages(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  async function handleVideoUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file) return;
    setUploadError(null);

    // Validare CLIENT-side înainte de upload — Vercel Hobby plan are
    // body limit 4.5MB pentru serverless functions, deci /api/upload nu
    // poate primi video > 4.5MB. Soluția: upload DIRECT la Supabase
    // Storage din browser (anon key + RLS allows public uploads la
    // bucketul sesizari-photos), bypass complet routerul Vercel.
    const ALLOWED = ["video/mp4", "video/webm", "video/quicktime"];
    if (!ALLOWED.includes(file.type)) {
      setUploadError(`Format video nesuportat: ${file.type}. Folosește MP4, WebM sau MOV.`);
      return;
    }
    const MAX = 50 * 1024 * 1024;
    if (file.size > MAX) {
      setUploadError(`Fișier prea mare (${(file.size / 1024 / 1024).toFixed(1)} MB). Maxim 50 MB.`);
      return;
    }

    setUploadingVideo(true);
    try {
      const supabase = createSupabaseBrowser();
      const ext =
        file.type === "video/mp4" ? "mp4" : file.type === "video/webm" ? "webm" : "mov";
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const path = `public/${filename}`;

      const { error: upErr } = await supabase.storage
        .from("sesizari-photos")
        .upload(path, file, {
          contentType: file.type,
          cacheControl: "3600",
        });

      if (upErr) {
        setUploadError(`Upload eșuat: ${upErr.message}`);
        return;
      }
      const { data: pub } = supabase.storage
        .from("sesizari-photos")
        .getPublicUrl(path);
      const url = pub?.publicUrl;
      if (!url) {
        setUploadError("Nu am putut obține URL-ul fișierului uploadat.");
        return;
      }
      // Functional setData — race condition fix. Plus scoatem entry-urile
      // cu URL gol ca să nu rămână rânduri moarte după upload.
      // Numele fișierului local poate fi „IMG_1234.mp4" sau un token
      // base64 random (screen recordings, downloads din Twitter etc.).
      // Dacă e junk, nu setăm title — UI-ul cade pe fallback „Video N".
      const cleanedTitle = sanitizeFileTitle(file.name);
      setData((d) => ({
        ...d,
        videos: [
          ...d.videos.filter((v) => v.url.trim().length > 0),
          { url, source: "direct", ...(cleanedTitle ? { title: cleanedTitle } : {}) },
        ].slice(0, 8),
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Eroare necunoscută";
      setUploadError(`Eroare la upload video: ${msg}`);
    } finally {
      setUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  }

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
              Lipește link-uri presă (până la 10) <strong>și/sau</strong> scrie observații proprii — ce ai văzut la protest, sloganuri, atmosferă, momente.
              AI le combină și completează câmpurile de mai jos.
            </p>
          </div>
        </div>

        <textarea
          value={urlsRaw}
          onChange={(e) => setUrlsRaw(e.target.value)}
          placeholder={`Lipește link-uri presă pe linii separate sau scrie ce ai văzut.

Exemplu:
https://www.digi24.ro/articol-protest
https://g4media.ro/...

Observații proprii: am fost azi la protest, atmosfera a fost pașnică, au scandat „Justiție" și „Dreptate". Au venit aproximativ 800 de persoane, în special tineri și pensionari...`}
          rows={7}
          className="w-full rounded-[var(--radius-sm)] bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
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

        {/* Per-URL diagnostic — utility pentru admin să vadă exact care
            link-uri au fost citite cu succes și care au eșuat (și de ce). */}
        {scrapeDetails.length > 0 && (
          <ul className="space-y-1.5 text-xs">
            {scrapeDetails.map((d, i) => (
              <li
                key={i}
                className={`flex items-start gap-2 ${
                  d.ok
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-rose-700 dark:text-rose-400"
                }`}
              >
                {d.ok ? (
                  <CheckCircle2 size={12} className="shrink-0 mt-0.5" aria-hidden />
                ) : (
                  <AlertCircle size={12} className="shrink-0 mt-0.5" aria-hidden />
                )}
                <span className="break-all flex-1">
                  <span className="font-mono opacity-80">
                    {(() => {
                      try {
                        return new URL(d.url).hostname.replace(/^www\./, "");
                      } catch {
                        return d.url.slice(0, 40);
                      }
                    })()}
                  </span>
                  {d.ok && d.title && (
                    <span className="ml-2 text-[var(--color-text)] opacity-80">
                      {d.title.slice(0, 80)}
                    </span>
                  )}
                  {!d.ok && d.error && (
                    <span className="ml-2 italic">— {d.error}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
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

        {/* Chants — ce au strigat efectiv în cor */}
        <Field
          label="Sloganuri scandate"
          hint={`Doar ce s-a strigat în cor. Ex: „Justiție pentru victime", „Nu vrem dictatură".`}
        >
          <ListEditor
            items={data.chants}
            onAdd={addChant}
            onUpdate={updateChant}
            onRemove={removeChant}
            placeholder="Slogan scandat..."
            addLabel="Adaugă slogan"
            maxItems={20}
          />
        </Field>

        {/* Messages — pe pancarte / declarații / banner-e */}
        <Field
          label="Mesaje transmise"
          hint={`Mesaje de pe pancarte, citate din discursuri, declarații publice. Diferit de scandări.`}
        >
          <ListEditor
            items={data.messages}
            onAdd={addMessage}
            onUpdate={updateMessage}
            onRemove={removeMessage}
            placeholder={`ex: „Susținem reformele lui Bolojan!"`}
            addLabel="Adaugă mesaj"
            maxItems={25}
          />
        </Field>

        {/* Key moments */}
        <Field
          label="Momente cheie"
          hint={`Cronologic. Ex: „17:30 — pornire marș", „discurs reprezentant cetățeni".`}
        >
          <ListEditor
            items={data.key_moments}
            onAdd={addMoment}
            onUpdate={updateMoment}
            onRemove={removeMoment}
            placeholder="ex: 18:00 — sosire în Piața Victoriei"
            addLabel="Adaugă moment"
            maxItems={12}
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
          hint="Încarcă fișiere de pe device sau lipește URL-uri publice. Max 12."
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
              <div className="grid grid-cols-2 gap-2">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={(e) => handleImageUpload(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImages}
                  className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 py-2 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/15 disabled:opacity-50 transition-colors"
                >
                  {uploadingImages ? (
                    <>
                      <Loader2 size={13} className="animate-spin" aria-hidden />
                      Se încarcă...
                    </>
                  ) : (
                    <>
                      <Upload size={13} aria-hidden /> Încarcă poze
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={addImage}
                  className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] py-2 text-xs text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                >
                  <LinkIcon size={13} aria-hidden /> Lipește URL
                </button>
              </div>
            )}
          </div>
        </Field>

        {/* Videos */}
        <Field
          label="Video-uri"
          hint="Încarcă MP4/WebM/MOV (max 50 MB) sau lipește link YouTube/TikTok/Facebook."
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
              <div className="grid grid-cols-2 gap-2">
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={(e) => handleVideoUpload(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={uploadingVideo}
                  className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 py-2 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/15 disabled:opacity-50 transition-colors"
                >
                  {uploadingVideo ? (
                    <>
                      <Loader2 size={13} className="animate-spin" aria-hidden />
                      Se încarcă...
                    </>
                  ) : (
                    <>
                      <Upload size={13} aria-hidden /> Încarcă video
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={addVideo}
                  className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] py-2 text-xs text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                >
                  <LinkIcon size={13} aria-hidden /> Lipește URL
                </button>
              </div>
            )}
            {uploadError && (
              <div className="flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle size={12} className="shrink-0 mt-0.5" aria-hidden />
                <span>{uploadError}</span>
              </div>
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

// ----- Helpers -----

/**
 * Curăță numele fișierului pentru a fi folosit ca titlu video. Returnează
 * null dacă numele e junk (random base64-like din screen recordings sau
 * downloads automate, fără valoare semantică) — caller-ul lasă title gol
 * și UI-ul cade pe „Video N".
 */
function sanitizeFileTitle(filename: string): string | null {
  if (!filename) return null;
  // Strip extensia
  const base = filename.replace(/\.(mp4|webm|mov|m4v)$/i, "").trim();
  if (!base) return null;
  // Junk patterns:
  // 1. 20+ alfanumerice consecutive (token base64, upload IDs)
  // 2. Doar cifre + dash + ID (ex: "1777918862991-3ocuqq")
  // 3. UUID
  if (/^[A-Za-z0-9_-]{20,}$/.test(base)) return null;
  if (/^[0-9]{10,}-[a-z0-9]+$/i.test(base)) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(base)) return null;
  // OK, pare nume real (gen „Marș protest 3 mai" sau „IMG_1234")
  return base.slice(0, 200);
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

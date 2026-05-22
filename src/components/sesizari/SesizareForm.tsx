"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Locate,
  Copy,
  Mail,
  Send,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { SESIZARE_TIPURI, SESIZARE_TIPURI_ACTIVE } from "@/lib/constants";
import { getAuthoritiesFor } from "@/lib/sesizari/authorities";
import { capitalizeName, formatAddress } from "@/lib/sesizari/format-helpers";
import { detectSectorFromCoords } from "@/lib/geo/sector-from-coords";
import { detectSectorFromText } from "@/lib/sesizari/sector-detect";
// Gender-detection helpers are no longer needed — the new email template uses
// the neutral "Mă numesc X, locuiesc în Y" opening instead of Subsemnatul(a).
import { cn } from "@/lib/utils";
import nextDynamic from "next/dynamic";
import { PhotoUploader } from "./PhotoUploader";
// FormField primitive extras la sprint 10 — local Field e acum alias.
import { FormField as Field, FORM_INPUT_CLASS as inputClass } from "./FormField";
// Parking-specific UI — heavy (Tesseract.js + canvas work). Only mount
// when the user actually picks tip="parcare" so the rest of the form
// ships without the OCR bundle.
const ParkingProofUploader = nextDynamic(
  () => import("./ParkingProofUploader").then((m) => ({ default: m.ParkingProofUploader })),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] animate-pulse" aria-hidden="true" />
    ),
  },
);
const ParkingHotspotModal = nextDynamic(
  () => import("./ParkingHotspotModal").then((m) => ({ default: m.ParkingHotspotModal })),
  { ssr: false },
);
// 2026-05-20 — SuccessScreen extras in fisier separat (~370 LOC) si lazy-loaded.
// Acelasi cod (Gmail link builders, mailto auto-open, code copy, viral share)
// dar nu mai e in main bundle — economie ~12KB minified.
const SuccessScreen = nextDynamic(
  () => import("./SuccessScreen").then((m) => ({ default: m.SuccessScreen })),
  {
    ssr: false,
    loading: () => (
      <div className="max-w-md mx-auto py-8 text-center" aria-busy="true">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-surface-2)] animate-pulse" />
        <div className="h-7 w-48 mx-auto bg-[var(--color-surface-2)] rounded animate-pulse mb-3" />
        <div className="h-4 w-64 mx-auto bg-[var(--color-surface-2)] rounded animate-pulse" />
      </div>
    ),
  },
);
import { PARKING_JURISDICTION_OPTIONS, type ParkingJurisdiction } from "@/lib/sesizari/parking";
import { VoiceInput } from "./VoiceInput";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  buildFormalText,
  buildGmailLink,
  buildMailtoLink,
  buildGmailAndroidIntent,
  buildGmailIosLink,
  type MailtoInput,
} from "@/lib/sesizari/mailto";
import { trackFunnelStep, trackAiUsage, trackFormAbandon } from "@/components/analytics/CiviaTracker";
import { SendViaCiviaButton } from "./SendViaCiviaButton";
import { CivicSprite } from "@/components/liquid-civic/CivicSprite";
import { playSound } from "@/lib/liquid-civic/sound";
import { DuplicateDetector } from "./DuplicateDetector";
import { announce } from "@/components/ui/LiveAnnouncer";
import { useCountyOptional } from "@/lib/county-context";

interface FormData {
  nume: string;
  adresa: string;
  email: string;
  tip: string;
  titlu: string;
  locatie: string;
  sector: string;
  lat: number | null;
  lng: number | null;
  descriere: string;
  formal_text: string;
  publica: boolean;
}

const INITIAL: FormData = {
  nume: "",
  adresa: "",
  email: "",
  tip: "",
  titlu: "",
  locatie: "",
  sector: "",
  lat: null,
  lng: null,
  descriere: "",
  formal_text: "",
  publica: true,
};

// capitalizeName + formatAddress extras în lib/sesizari/format-helpers.ts
// pentru unit-test coverage (componenta-mom de 1485 linii e neftestabilă).

export function SesizareForm() {
  const { user } = useAuth();
  const county = useCountyOptional();
  const mode = "complet"; // single mode, no choice screen
  const [data, setData] = useState<FormData>(INITIAL);
  const [imagini, setImagini] = useState<string[]>([]);
  // Data/ora constatării a fost scoasă — majoritatea cetățenilor nu
  // văd valoare în câmp. "Astăzi, {data_de_azi}" din textul formal
  // acoperă oricum momentul trimiterii.
  const [aiLoading, setAiLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ code: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [honey, setHoney] = useState(""); // anti-bot honeypot
  // Bug fix 5/22/2026 — Civic Sprite „prima sesizare" se afisa la fiecare
  // submit pentru ca localStorage poate fi clear-uit. Acum verificam si
  // count-ul real al sesizarilor user-ului (autenticat). Anonim → fallback
  // la localStorage in CivicSprite (singura sursa).
  const [priorSesizariCount, setPriorSesizariCount] = useState<number | null>(null);
  const classifyTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Smooth-scroll la error box cand apare (2026-05-19): inainte error
  // aparea jos in pagina iar utilizatorul nu observa pe mobile.
  const errorRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);

  // National geocoding state — pre-fill from county context if available
  const [detectedCounty, setDetectedCounty] = useState<string | null>(county?.id ?? null);
  const [detectedCountyName, setDetectedCountyName] = useState<string | null>(county?.name ?? null);
  const [detectedLocality, setDetectedLocality] = useState<string | null>(null);

  // Parcare-specific state. Only used (and only rendered) when
  // data.tip === "parcare". Living in the main form so the AI-classifier
  // flip from "trotuar" → "parcare" doesn't wipe anything the user
  // already typed if they then flip it back.
  const [parkingSlots, setParkingSlots] = useState<{
    plate: string | null; vehicle: string | null; context: string | null;
  }>({ plate: null, vehicle: null, context: null });
  const [parkingPlateText, setParkingPlateText] = useState("");
  const [parkingJurisdiction, setParkingJurisdiction] = useState<ParkingJurisdiction | "">("");
  // datetime-local value "YYYY-MM-DDTHH:MM" in the user's local timezone.
  // Defaults to "now" on mount (NU în useState initializer) — initializer
  // rulează și pe server SSR, iar new Date() server vs client diferă →
  // React hydration error #418. Mount-only setarea garantează SSR = "" și
  // client populated după hydration.
  const [parkingObservedAt, setParkingObservedAt] = useState("");
  const [parkingObservedMax, setParkingObservedMax] = useState("");
  const [hotspotShown, setHotspotShown] = useState(false);

  // Inițializează „acum" (rotunjit la minut) după mount — NU în render,
  // ca să eviți hydration mismatch cross-minute. La fel pentru max prop
  // pe datetime-local input.
  useEffect(() => {
    const d = new Date();
    d.setSeconds(0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    const nowLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setParkingObservedMax(nowLocal);
    if (!parkingObservedAt) setParkingObservedAt(nowLocal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
    setError(null);
  };

  // ── Web Share Target prefill ──────────────────────────────────────
  // When the user shares a photo / link / text from another app via
  // the OS share sheet → "Civia", they land here at /sesizari?from=share
  // with the shared content already in the URL (and the photo already
  // uploaded by /sesizari/share/route.ts). Pre-fill the form so the
  // user just has to confirm and submit.
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("from") !== "share") return;
    const sharedTitle = searchParams.get("title");
    const sharedDesc = searchParams.get("desc");
    const sharedLink = searchParams.get("link");
    const sharedPhoto = searchParams.get("photo");

    setData((d) => {
      const next = { ...d };
      if (sharedTitle && !d.titlu) next.titlu = sharedTitle;
      // Build the description from text + link if both came in. The
      // link by itself is rarely useful; combined with a description
      // it's context for the AI classifier.
      const descParts: string[] = [];
      if (sharedDesc) descParts.push(sharedDesc);
      if (sharedLink) descParts.push(`Sursă: ${sharedLink}`);
      if (descParts.length > 0 && !d.descriere) {
        next.descriere = descParts.join("\n\n");
      }
      return next;
    });
    if (sharedPhoto) {
      setImagini((prev) => (prev.length === 0 ? [sharedPhoto] : prev));
    }
    // Clean the query string so a refresh doesn't re-prefill on top
    // of the user's edits. replaceState avoids adding to history.
    if (typeof window !== "undefined") {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draft persistence — snapshot the form every ~4s so a refresh /
  // accidental tab close doesn't vaporize what the user typed.
  // Clears on successful submit. Kept separate from civic_user_data
  // (which is just name/address/email) so profile autofill stays
  // intact but the full draft restores on reload.
  const DRAFT_KEY = "civic_sesizare_draft";
  const [draftRestoredAt, setDraftRestoredAt] = useState<string | null>(null);
  const [draftDismissed, setDraftDismissed] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);

  // Restore draft on mount (once) — only offer if it's < 7 days old and
  // the current form is empty (user didn't start typing over it).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      // Shape extended to persist uploaded photo URLs + parking
      // state, not just form fields. Earlier drafts only kept `data`;
      // we detect them and restore the partial payload gracefully.
      const parsed = JSON.parse(raw) as {
        t: number;
        data: FormData;
        imagini?: string[];
        parkingSlots?: { plate: string | null; vehicle: string | null; context: string | null };
        parkingPlateText?: string;
        parkingJurisdiction?: ParkingJurisdiction | "";
        parkingObservedAt?: string;
      };
      if (!parsed?.data) return;
      const ageMs = Date.now() - (parsed.t || 0);
      if (ageMs > 7 * 24 * 3600 * 1000) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      // Offer restore only if the draft has real content
      const hasContent =
        (parsed.data.descriere?.length ?? 0) > 10 ||
        (parsed.data.locatie?.length ?? 0) > 3 ||
        (parsed.imagini?.length ?? 0) > 0;
      if (!hasContent) return;
      setData(parsed.data);
      // Photo URLs live on Supabase storage indefinitely — safe to
      // restore by reference. If a URL 404s because the user deleted
      // the project, the <img> inside PhotoUploader already handles
      // display: none onError, so it degrades gracefully.
      if (parsed.imagini?.length) setImagini(parsed.imagini);
      if (parsed.parkingSlots) setParkingSlots(parsed.parkingSlots);
      if (parsed.parkingPlateText) setParkingPlateText(parsed.parkingPlateText);
      if (parsed.parkingJurisdiction) setParkingJurisdiction(parsed.parkingJurisdiction);
      if (parsed.parkingObservedAt) setParkingObservedAt(parsed.parkingObservedAt);
      setDraftRestoredAt(new Date(parsed.t).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest" }));
    } catch { /* corrupt draft — ignore */ }

  }, []);

  // Debounced save — write the current form state every 4s, but only
  // if something substantive is there. Skips empty drafts.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (submitted) return;
    const hasContent =
      (data.descriere?.length ?? 0) > 10 ||
      (data.locatie?.length ?? 0) > 3 ||
      !!data.tip ||
      imagini.length > 0;
    if (!hasContent) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            t: Date.now(),
            data,
            imagini,
            parkingSlots,
            parkingPlateText,
            parkingJurisdiction,
            parkingObservedAt,
          }),
        );
        setDraftSavedAt(Date.now());
      } catch { /* quota exceeded — silent */ }
    }, 4000);
    return () => clearTimeout(timer);
  }, [data, imagini, parkingSlots, parkingPlateText, parkingJurisdiction, parkingObservedAt, submitted]);

  // Funnel entry — fires DOAR cand userul interactioneaza prima data (input
  // in descriere, click pe quick-pick tip, upload poza). Inainte fire-uia
  // pe mount, ceea ce inflate-uia „start" cu page views care nu reprezentau
  // nicio intentie reala → funnel arata 1.2% submit rate (catastrofal).
  // Update 2026-05-13: cu acest fix, „start" = engagement real, conversia
  // o sa fie reflectiva.
  const startFiredRef = useRef(false);
  useEffect(() => {
    if (startFiredRef.current) return;
    const hasEngagement =
      data.descriere.length > 0 ||
      !!data.tip ||
      imagini.length > 0 ||
      data.lat !== null;
    if (hasEngagement) {
      startFiredRef.current = true;
      trackFunnelStep("sesizare-create", "start");
    }
  }, [data.descriere, data.tip, imagini.length, data.lat]);

  // 2026-05-20 Funnel completion — track granular steps pentru a vedea
  // EXACT unde abandoneaza userii. Folosit in /admin/analytics funnels.
  const photoFiredRef = useRef(false);
  useEffect(() => {
    if (!photoFiredRef.current && imagini.length > 0) {
      photoFiredRef.current = true;
      trackFunnelStep("sesizare-create", "photo-uploaded", { count: imagini.length });
    }
  }, [imagini.length]);

  const locationFiredRef = useRef(false);
  useEffect(() => {
    if (!locationFiredRef.current && data.lat !== null && data.locatie.length > 5) {
      locationFiredRef.current = true;
      trackFunnelStep("sesizare-create", "location-set", { has_coords: 1 });
    }
  }, [data.lat, data.locatie]);

  const descriptionFiredRef = useRef(false);
  useEffect(() => {
    if (!descriptionFiredRef.current && data.descriere.length >= 30) {
      descriptionFiredRef.current = true;
      trackFunnelStep("sesizare-create", "description-complete", {
        chars: data.descriere.length,
      });
    }
  }, [data.descriere]);

  // beforeunload guard — dacă user încearcă să închidă tab-ul în timpul
  // submit-ului, prevenim pierderea silentă a datelor / imaginilor
  // unloaded. Listener-ul stă on doar cât durează submit-ul efectiv.
  useEffect(() => {
    if (!submitting) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Some browsers still need returnValue set even though the spec
      // says preventDefault is enough. The actual string is ignored —
      // browser shows generic "Leave site?" prompt.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [submitting]);

  // Abandon signal — if the user leaves without hitting submit, fire a
  // form-abandon event marking the furthest step reached. Lets the
  // dashboard compute "where do people drop off".
  // Update 2026-05-13: doar daca a fost ENGAGEMENT real (descriere > 5,
  // tip, poza, sau GPS). Inainte fire-uia si pe page views fara
  // interactiune → „before-tip" arata 112 abandons din care 90%+ erau
  // bounces, nu drop-offs reale. Aliniat cu funnel „start".
  // Update 2026-05-19: tracking granular „pe care field a parasit user-ul" —
  // captureaza numele field-ului din ultimul `focusin` global pe document.
  // Trimis ca prop `field` in trackFormAbandon — dashboard arata top
  // abandon-fields, vede direct unde se blocheaza userii (ex: „adresa" =
  // 60% din abandons → e prea cere).
  const lastFocusedFieldRef = useRef<string | null>(null);
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const name = target.getAttribute("name") || target.getAttribute("data-field");
      if (name) lastFocusedFieldRef.current = name;
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, []);
  useEffect(() => {
    const onUnload = () => {
      if (submitted) return;
      const hasEngagement =
        data.descriere.trim().length >= 5 ||
        !!data.tip ||
        imagini.length > 0 ||
        data.lat !== null;
      if (!hasEngagement) return;
      const step =
        data.tip && data.descriere.length > 10 && data.locatie ? "before-submit"
        : data.tip && data.descriere.length > 10 ? "before-locatie"
        : data.tip ? "before-descriere"
        : "before-tip";
      trackFormAbandon("sesizare", step, lastFocusedFieldRef.current ?? undefined);
    };
    window.addEventListener("pagehide", onUnload);
    return () => window.removeEventListener("pagehide", onUnload);

  }, [data.tip, data.descriere, data.locatie, data.lat, imagini.length, submitted]);

  // Fetch user's prior sesizari count — used to decide if „Prima sesizare"
  // sprite arata sau nu. Anonim → null → fallback la localStorage only.
  useEffect(() => {
    if (!user) {
      setPriorSesizariCount(null);
      return;
    }
    fetch("/api/profile/sesizari")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const data = j?.data;
        setPriorSesizariCount(Array.isArray(data) ? data.length : 0);
      })
      .catch(() => setPriorSesizariCount(null));
  }, [user]);

  // Auto-fill from profile (auth) or localStorage (anonymous)
  useEffect(() => {
    if (profileLoaded) return;
    if (user) {
      fetch("/api/profile")
        .then((r) => r.json())
        .then((j) => {
          if (j.data) {
            // Prefer full_name (real name for sesizari). Skip display_name if it's the
            // auto-generated email prefix (Supabase trigger default).
            const emailPrefix = (j.data.email as string | undefined)?.split("@")[0] ?? "";
            const displayNameIsEmailPrefix =
              j.data.display_name && j.data.display_name === emailPrefix;
            const preferredName =
              j.data.full_name ||
              (!displayNameIsEmailPrefix ? j.data.display_name : "") ||
              "";
            setData((d) => ({
              ...d,
              nume: d.nume || preferredName,
              adresa: d.adresa || j.data.address || "",
              email: d.email || j.data.email || "",
            }));
          }
          setProfileLoaded(true);
        })
        .catch(() => setProfileLoaded(true));
    } else if (typeof window !== "undefined") {
      const saved = localStorage.getItem("civic_user_data");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setData((d) => ({
            ...d,
            nume: d.nume || parsed.name || "",
            adresa: d.adresa || parsed.address || "",
            email: d.email || parsed.email || "",
          }));
        } catch {
          // ignore
        }
      }
      setProfileLoaded(true);
    }
  }, [user, profileLoaded]);

  // AI tip detection state
  const [tipDetecting, setTipDetecting] = useState(false);
  const [tipDetectedByAI, setTipDetectedByAI] = useState(false);
  // Bug fix #8 (5/22/2026) — Vision confidence vizibil userului ca badge,
  // ca să poată reviewa sugestia manual când AI nu e foarte sigur.
  const [visionConfidence, setVisionConfidence] = useState<number | null>(null);
  // Sector auto-detect flag — afisam un mic indicator „Sector detectat
  // automat" cand l-am gasit din text (keyword-based) ca user-ul sa
  // poata corecta daca am gresit. Reset cand user schimba manual.
  const [sectorDetectedByText, setSectorDetectedByText] = useState(false);

  // 2026-05-19: AI vision auto-routing — la prima poza uploadata, daca
  // userul nu a ales inca tipul, trimitem poza la /api/ai/vision-route
  // pentru sugestie de tip + autoritate. Foloseste Llama 4 Scout 17B.
  // Daca confidence >= 60, set automatic tip (cu badge „detectat din poza").
  const visionTriedRef = useRef(false);
  useEffect(() => {
    if (imagini.length === 0) return;
    if (visionTriedRef.current) return;
    if (data.tip && !tipDetectedByAI) return; // userul a ales manual
    visionTriedRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/ai/vision-route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: imagini[0] }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) return;
        const j = await res.json();
        if (j?.tip && typeof j.confidence === "number") {
          // Bug fix #8 — pastram confidence pentru badge (visible review).
          setVisionConfidence(j.confidence);
          if (j.confidence >= 60) {
            setData((d) => (d.tip ? d : { ...d, tip: j.tip }));
            setTipDetectedByAI(true);
            trackFunnelStep("sesizare-create", "tip-selected", { tip: j.tip, source: "vision", confidence: j.confidence });
          }
        }
      } catch {
        // silent — vision e best-effort
      }
    })();
  }, [imagini, data.tip, tipDetectedByAI]);

  // Debounced auto-classify tip from description (800ms after typing stops)
  useEffect(() => {
    // Skip if description too short OR user already picked a tip manually
    if (data.descriere.length < 15) return;
    if (data.tip && !tipDetectedByAI) return; // user chose manually
    if (classifyTimerRef.current) clearTimeout(classifyTimerRef.current);
    classifyTimerRef.current = setTimeout(async () => {
      setTipDetecting(true);
      try {
        const res = await fetch("/api/ai/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: data.descriere + " " + data.locatie }),
        });
        if (!res.ok) return;
        const json = await res.json();
        if (json.data?.tip) {
          setData((d) => ({ ...d, tip: json.data.tip }));
          setTipDetectedByAI(true);
          // Track la fel ca selecția manuală — analytics arăta înainte
          // un drop fals de 87% pe step-ul „tip-selected" pentru că
          // auto-detect-ul nu trigger-uia eventul. source=auto distinge.
          trackFunnelStep("sesizare-create", "tip-selected", { tip: json.data.tip, source: "auto" });
        }
      } catch {
        // silent fail
      } finally {
        setTipDetecting(false);
      }

      // Sector auto-detect din text — independent de AI classify, ruleaza
      // local cu sector-detect (keyword-based). Doar daca user n-a setat
      // deja sector explicit. Raport 2026-05-15: user tasta locatii
      // Sector 5 (Piata Constitutiei + ministere) fara sa apese sector,
      // emailul sarea peste Primaria S5.
      setData((d) => {
        if (d.sector) return d;
        const text = `${d.descriere} ${d.locatie}`;
        const guess = detectSectorFromText(text);
        if (!guess) return d;
        setSectorDetectedByText(true);
        return { ...d, sector: guess };
      });
    }, 800);
    return () => {
      if (classifyTimerRef.current) clearTimeout(classifyTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.descriere, data.locatie]);

  // Auto-detect county + locality + sector from GPS coords via reverse geocoding
  useEffect(() => {
    if (data.lat == null || data.lng == null) return;

    // Quick local sector detection (instant, for București)
    const s = detectSectorFromCoords(data.lat, data.lng);
    if (s && s !== data.sector) {
      setData((d) => ({ ...d, sector: s }));
    }

    // Full reverse geocode (async, for all of Romania). 5s hard timeout
    // so a hung Nominatim call doesn't freeze the "se detectează..."
    // UI — the form still has lat/lng, we just skip the address polish.
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 5_000);
    fetch(`/api/geocode?lat=${data.lat}&lng=${data.lng}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          if (j.data.countyCode) setDetectedCounty(j.data.countyCode);
          if (j.data.countyName) setDetectedCountyName(j.data.countyName);
          if (j.data.locality) setDetectedLocality(j.data.locality);
          if (j.data.sector && !data.sector) {
            setData((d) => ({ ...d, sector: j.data.sector }));
          }
          // Auto-fill location if empty
          if (j.data.address && !data.locatie) {
            setData((d) => ({ ...d, locatie: j.data.address.split(",").slice(0, 3).join(",").trim() }));
          }
        }
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeoutId));
    return () => {
      clearTimeout(timeoutId);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.lat, data.lng]);

  const handleAIImprove = async (opts?: { withPhotos?: boolean; silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (data.descriere.length < 10) {
      if (!silent) setError("Scrie mai întâi o descriere (min 10 caractere)");
      return;
    }
    if (!data.tip) {
      if (!silent) setError("Alege tipul problemei — folosim un template specific pe tip");
      return;
    }
    trackAiUsage(opts?.withPhotos ? "improve-vision" : "improve-text", { tip: data.tip });
    trackFunnelStep("sesizare-create", opts?.withPhotos ? "ai-improve-vision" : "ai-improve");
    setAiLoading(true);
    if (!silent) setError(null);
    try {
      const res = await fetch("/api/ai/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descriere: data.descriere,
          tip: data.tip,
          locatie: data.locatie,
          nume: data.nume,
          adresa: data.adresa,
          imagini: opts?.withPhotos ? imagini : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Generarea textului a eșuat");
      const formalText = json.data.formal_text as string;
      const descriereRafinata = (json.data.descriere_rafinata as string | undefined) || undefined;
      // Extract title: take the "Vă sesizez cu privire la..." part, or first sentence
      let aiTitle = "";
      const sesizezMatch = formalText.match(/Vă sesizez cu privire la ([^,.]+)/i);
      if (sesizezMatch && sesizezMatch[1]) {
        aiTitle = sesizezMatch[1].trim();
        aiTitle = aiTitle.charAt(0).toUpperCase() + aiTitle.slice(1);
        if (aiTitle.length > 80) aiTitle = aiTitle.slice(0, 77) + "...";
      }
      setData((d) => ({
        ...d,
        formal_text: formalText,
        titlu: aiTitle || d.titlu,
        // Keep user's original raw descriere but log what AI saw in photos
        // as a small hint field. We don't overwrite descriere to avoid
        // surprising the user; the refined version lives in formal_text.
        descriere: descriereRafinata && !d.descriere.toLowerCase().includes(descriereRafinata.slice(0, 20).toLowerCase())
          ? d.descriere
          : d.descriere,
      }));
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "Serviciul de generare a textului e temporar indisponibil");
    } finally {
      setAiLoading(false);
    }
  };

  // Auto re-improve when photos change AND we already have an AI-generated
  // formal text — the vision model sees the photos and tightens the wording
  // to match reality (no more "pietonii forțați pe carosabil" when the
  // trotoar is actually lat).
  const imaginiKey = imagini.join("|");
  useEffect(() => {
    if (imagini.length === 0) return;
    // Trigger vision analysis whenever a photo is uploaded AND the user
    // has enough context (descriere + tip). No need to wait for a prior
    // formal_text — the vision pass will generate it fresh.
    if (data.descriere.length < 10 || !data.tip) return;
    void handleAIImprove({ withPhotos: true, silent: true });
    // Intentionally omit handleAIImprove — it reads latest state via closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imaginiKey]);

  // Pre-warm AI rewrite while user is still typing identity fields. Fix
  // 2026-05-15: user a cerut sa elimine butonul mare „Rescrie cu AI" si
  // ca rescriere sa fie automata. Strategie: cand are descriere completa
  // (≥30 char) + tip + locatie set, fire AI silent dupa 1500ms debounce.
  // Pana cand user-ul apasa Trimite, formal_text e deja generat — zero
  // wait time perceput. Daca user e foarte rapid, fallback la AI in
  // handleSubmit prinde cazul.
  //
  // CRITICAL fix 2026-05-20: profileLoaded gating + nume/adresa in deps.
  // Bug raportat: textul formal se genera ÎNAINTE ca /api/profile sa
  // raspunda cu nume + adresa → AI primea string-uri goale → text final
  // „Mă numesc  și doresc..." fara identitate. Acum prewarm-ul asteapta
  // explicit ca profilul sa fi raspuns. Pentru useri anonimi (no auth),
  // profileLoaded devine true imediat dupa fallback-ul localStorage.
  const prewarmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (data.formal_text) return; // deja generat
    if (aiLoading) return; // deja ruleaza
    if (!profileLoaded) return; // așteptăm identity de pe profile/localStorage
    if (data.descriere.length < 30) return; // not enough context
    if (!data.tip) return;
    if (data.locatie.length < 3) return;
    if (prewarmTimerRef.current) clearTimeout(prewarmTimerRef.current);
    prewarmTimerRef.current = setTimeout(() => {
      void handleAIImprove({ withPhotos: imagini.length > 0, silent: true });
    }, 1500);
    return () => {
      if (prewarmTimerRef.current) clearTimeout(prewarmTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.descriere, data.tip, data.locatie, data.formal_text, data.nume, data.adresa, profileLoaded]);

  const getLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocația nu e disponibilă în browser");
      return;
    }
    setGeoLoading(true);
    setError(null);

    let lastAccuracy = Infinity;
    let hasAnyPosition = false;
    let geocodeCount = 0;
    let done = false;
    const target = 15; // 15m e suficient pentru sesizare urbană (era 10m — rareori atins în oraș)
    setGpsAccuracy(null);

    // Reverse geocode — rulează cât de devreme posibil la acuratețe grosieră
    // (500-2000m → doar city level) și se rafinează când vine fix mai precis.
    // Abort signal pe request curent când sosește un fix mai bun → nu rămâne
    // un geocode „în urmă" care să suprascrie adresa proaspătă.
    let currentGeocodeCtrl: AbortController | null = null;
    const doReverseGeocode = async (lat: number, lng: number) => {
      if (currentGeocodeCtrl) currentGeocodeCtrl.abort();
      geocodeCount++;
      const thisCall = geocodeCount;
      const ctrl = new AbortController();
      currentGeocodeCtrl = ctrl;
      const tid = setTimeout(() => ctrl.abort(), 5_000);
      try {
        const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`, { signal: ctrl.signal });
        const json = await res.json();
        if (json.data && thisCall === geocodeCount) {
          const addr = json.data.shortAddress || json.data.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setData((d) => ({
            ...d,
            locatie: addr,
            sector: json.data.sector || d.sector,
          }));
          if (json.data.countyCode) setDetectedCounty(json.data.countyCode);
          if (json.data.countyName) setDetectedCountyName(json.data.countyName);
          if (json.data.locality) setDetectedLocality(json.data.locality);
        }
      } catch {
        setData((d) => ({ ...d, locatie: d.locatie || `${lat.toFixed(5)}, ${lng.toFixed(5)}` }));
      } finally {
        clearTimeout(tid);
      }
    };

    const stop = () => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(watchId);
      setGeoLoading(false);
    };

    const handleFix = (pos: GeolocationPosition, fromCache = false) => {
      if (done) return;
      hasAnyPosition = true;
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const acc = pos.coords.accuracy;

      // Ignoră fix-uri identice / mai slabe decât ce avem deja
      if (acc >= lastAccuracy) return;
      lastAccuracy = acc;

      setData((d) => ({ ...d, lat, lng }));
      setGpsAccuracy(acc);

      // Afișează coordonatele imediat ca feedback vizual (user vede că s-a
      // prins ceva), geocodul le înlocuiește cu adresa reală când vine
      if (geocodeCount === 0) {
        setData((d) => ({
          ...d,
          locatie: `${lat.toFixed(5)}, ${lng.toFixed(5)} (se detectează adresa…)`,
        }));
      }

      // Trigger reverse geocode pe trei praguri de acuratețe
      // — ~2000m (city level, vine primul, sub 500ms)
      // — ~100m (stradă, dacă vine)
      // — ≤target (număr clar, dacă vine)
      // Fiecare apel îl anulează pe cel anterior ca să nu dăm înapoi.
      if (acc < 2000 && geocodeCount === 0) doReverseGeocode(lat, lng);
      else if (acc < 100 && geocodeCount === 1) doReverseGeocode(lat, lng);
      else if (acc <= target && geocodeCount <= 2) doReverseGeocode(lat, lng);

      // Fix-ul din cache (maximumAge>0) e instant dar aproximativ — lasă
      // watchPosition să continue să rafineze. Oprim doar la fix nativ
      // sub prag.
      if (!fromCache && acc <= target) stop();
    };

    // 1. INSTANT: getCurrentPosition cu maximumAge=60000 → întoarce fix-ul
    //    cached dacă browserul are unul recent (< 1min). În multe cazuri
    //    acesta vine sub 50ms și populăm harta instant.
    navigator.geolocation.getCurrentPosition(
      (pos) => handleFix(pos, true),
      () => { /* ignoră — watchPosition va încerca oricum */ },
      { enableHighAccuracy: false, timeout: 2000, maximumAge: 60000 },
    );

    // 2. ÎN PARALEL: watchPosition cu high accuracy → rafinare fresh
    const watchId = navigator.geolocation.watchPosition(
      (pos) => handleFix(pos, false),
      (err) => {
        if (done) return;
        stop();
        if (!hasAnyPosition) {
          if (err.code === 1) {
            setError("Permisiune refuzată — activează locația din setările browserului.");
          } else if (err.code === 2) {
            setError("Locație indisponibilă — verifică GPS-ul dispozitivului.");
          } else {
            setError("Timeout — reîncearcă sau introdu adresa manual.");
          }
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 0,
      },
    );

    // Safety net: după 8s lăsăm ce avem (majoritatea fix-urilor bune sosesc
    // în 2-5s; sub 8s user-ul devine nerăbdător).
    setTimeout(() => {
      if (done) return;
      if (hasAnyPosition) {
        // Avem un fix, îl acceptăm chiar dacă nu e sub 15m.
        stop();
      } else {
        stop();
        setError("Timeout — nu am putut obține locația. Introdu-o manual.");
      }
    }, 8_000);
  };

  // Prefetch permission status — când form-ul se montează, dacă user-ul
  // a acordat deja permisiunea în sesiuni anterioare (Permissions API
  // returnează "granted"), tragem un fix cached în background ca să fie
  // gata când apasă butonul GPS. Zero cost dacă permisiunea e „denied"
  // sau „prompt" (nu declanșează popup-ul de permisiuni).
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const nav = navigator as Navigator & {
      permissions?: { query: (q: { name: PermissionName }) => Promise<PermissionStatus> };
    };
    if (!nav.permissions?.query) return;
    let cancelled = false;
    nav.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (cancelled || status.state !== "granted") return;
        // Browser cache-uiește fix-ul → apelul de mai jos e gratuit și
        // populează cache-ul navigatorului pentru click-ul pe GPS.
        navigator.geolocation.getCurrentPosition(
          () => { /* warm */ },
          () => { /* ignore */ },
          { enableHighAccuracy: false, timeout: 3000, maximumAge: 300_000 },
        );
      })
      .catch(() => { /* ignore */ });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-generate titlu daca lipseste. Inainte fallback-ul era descriere.slice(80)
  // care era textul INFORMAL al user-ului ("sa elibereze masinile..."). Pe share
  // (Bluesky/Twitter) iesea oribil intre ghilimele. Acum fallback-ul e label-ul
  // formal al tipului ("Parcare ilegala", "Montare stalpisori anti-parcare") —
  // mereu curat, mereu in romana corecta cu diacritice.
  const tipLabel = SESIZARE_TIPURI.find((t) => t.value === data.tip)?.label;
  const effectiveTitlu = data.titlu || tipLabel || "Sesizare civică";

  // Parking flow has extra hard requirements: both mandatory photo
  // slots filled + a plate number + a jurisdiction. Relaxing any of
  // these lets the email go out with holes the police will use to
  // dismiss the complaint, which defeats the whole point.
  const parkingValid =
    data.tip !== "parcare" ||
    (!!parkingSlots.plate && !!parkingSlots.vehicle && parkingPlateText.trim().length >= 5 && !!parkingJurisdiction);

  // Email is optional — but if the user provided one, it has to
  // look like an email. The server validates too (zod .email()),
  // but catching it here prevents a round-trip on the submit.
  const emailLooksValid =
    !data.email.trim() || /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(data.email.trim());

  const canSubmit =
    data.nume.length >= 2 &&
    data.adresa.trim().length >= 3 &&
    data.tip &&
    effectiveTitlu.length >= 3 &&
    data.locatie.length >= 3 &&
    data.descriere.length >= 10 &&
    parkingValid &&
    emailLooksValid &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) {
      const missing: string[] = [];
      if (data.nume.length < 2) missing.push("Numele tău");
      if (data.adresa.trim().length < 3) missing.push("Adresa ta de domiciliu");
      if (!data.tip) missing.push("Tip problemă");
      if (data.descriere.length < 10) missing.push("Descrierea problemei (min 10 caractere)");
      if (data.locatie.length < 3) missing.push("Locația problemei");
      if (!emailLooksValid) missing.push("Email de contact (format corect, ex: nume@exemplu.ro)");
      if (data.tip === "parcare") {
        if (!parkingSlots.plate) missing.push("Poza numărului de înmatriculare");
        if (!parkingSlots.vehicle) missing.push("Poza mașinii fără șofer");
        if (parkingPlateText.trim().length < 5) missing.push("Numărul de înmatriculare");
        if (!parkingJurisdiction) missing.push("Ce blochează vehiculul");
      }
      setError(missing.length > 0 ? `Completează: ${missing.join(", ")}` : "Completează toate câmpurile obligatorii");
      return;
    }
    setSubmitting(true);
    setError(null);

    // Last-resort AI rescriere: daca user e foarte rapid si pre-warm nu a
    // ajuns să ruleze încă (formal_text gol), facem aici. Compromis: pe
    // mobile pierdem user-gesture-ul pentru intent:// (mailto poate sa nu
    // se deschida automat), dar EmailChoicePanel din succes screen ofera
    // butoanele explicite ca fallback. Cele mai multe submisii vor avea
    // formal_text de la prewarm până aici.
    if (!data.formal_text && data.descriere.length >= 10) {
      try {
        await handleAIImprove({ withPhotos: imagini.length > 0, silent: true });
      } catch {
        // silent — formal_text rămâne null, mailto template fallback prinde
      }
    }

    const lat = data.lat ?? 45.9432; // Romania center as fallback
    const lng = data.lng ?? 24.9668;
    // Auto-detect sector from coords — only for București, null elsewhere
    const isInBucharest = lat >= 44.33 && lat <= 44.55 && lng >= 25.97 && lng <= 26.25;
    // Bug fix user 5/22/2026 — daca utilizatorul NU specifica sectorul si
    // coords sunt imprecise, NU mai fortam fallback la „S3" (acela duce
    // mailul la primaria gresita). Strategia cascada:
    //   1. data.sector explicit ales de user
    //   2. detectSectorFromCoords (precise lat/lng)
    //   3. detectSectorFromText pe descriere + locatie (keyword-based,
    //      acoperă „Strada Berceni" → S4, „Drumul Taberei" → S6 etc.)
    //   4. null → emailul merge doar la primaria Bucuresti (oras-level),
    //      nu si la primaria sectorului. User-ul vede asta in UI si poate
    //      reveni sa specifice sectorul.
    const sector = isInBucharest
      ? (data.sector
        || detectSectorFromCoords(lat, lng)
        || detectSectorFromText(`${data.locatie} ${data.descriere}`)
        || null)
      : null;

    // OPEN MAIL APP IMMEDIATELY — must happen synchronously inside
    // the click handler, BEFORE the first await, so the user gesture
    // is still active. After the first `await fetch(...)` the gesture
    // is gone and protocol handlers (intent://, googlegmail://) are
    // blocked by the browser. Triggering here gives a true 1-tap UX:
    // user taps "Trimite" → Gmail app opens directly. The async POST
    // continues in background; the success screen renders when the
    // user navigates back from Gmail.
    try {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const isAndroid = /Android/.test(ua);
      const isIos = /iPad|iPhone|iPod/.test(ua);
      const emailDraft: MailtoInput = {
        tip: data.tip,
        titlu: effectiveTitlu,
        locatie: data.locatie,
        sector,
        lat,
        lng,
        descriere: data.descriere,
        formal_text: data.formal_text || null,
        author_name: data.nume,
        author_email: data.email || null,
        author_address: data.adresa || null,
        imagini,
        parking:
          data.tip === "parcare"
            ? {
                plate: parkingPlateText,
                jurisdiction: parkingJurisdiction || null,
                observedAt: parkingObservedAt || null,
              }
            : undefined,
      };
      let mailUrl: string | null = null;
      if (isAndroid) mailUrl = buildGmailAndroidIntent(emailDraft);
      else if (isIos) mailUrl = buildGmailIosLink(emailDraft);
      // Desktop is intentionally left out here — auto-open on submit
      // would steal focus while the user might still be reading the
      // form. Desktop gets the auto-open inside SuccessScreen instead.
      if (mailUrl) {
        // Use location.href (synchronous) inside the click context
        // so the OS protocol handler fires. window.open() with a
        // blank target is more likely to be blocked.
        window.location.href = mailUrl;
      }
    } catch {
      /* mail-open is best effort — fall through to the normal flow */
    }

    // For parking sesizări the legal template is the canonical body —
    // persist that as formal_text so co-signers + admin views render the
    // same text that actually went to the police, not whatever the
    // generic AI prompt produced. The template itself is deterministic
    // and lives in buildFormalText() when tip="parcare" + parking set.
    const formalTextForDb =
      data.tip === "parcare" && parkingPlateText && parkingJurisdiction
        ? buildFormalText({
            tip: data.tip,
            titlu: effectiveTitlu,
            locatie: data.locatie,
            sector,
            lat,
            lng,
            descriere: data.descriere,
            formal_text: null,
            author_name: data.nume,
            author_email: data.email || null,
            author_address: data.adresa || null,
            imagini,
            parking: {
              plate: parkingPlateText,
              jurisdiction: parkingJurisdiction,
              observedAt: parkingObservedAt || null,
            },
          })
        : data.formal_text || null;

    // Daca tip=altele, cerem AI-ului sa propuna o eticheta custom_category.
    // Fire-and-forget cu timeout 6s — daca AI cade, sesizarea pleaca fara
    // category (admin o poate clasifica manual ulterior).
    let customCategory: string | null = null;
    let customCategoryConfidence: number | null = null;
    if (data.tip === "altele") {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 6000);
        const catRes = await fetch("/api/ai/auto-categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            descriere: data.descriere.trim(),
            titlu: effectiveTitlu,
          }),
          signal: ctrl.signal,
        });
        clearTimeout(tid);
        if (catRes.ok) {
          const j = await catRes.json();
          if (j.category && typeof j.category === "string") {
            customCategory = j.category;
            customCategoryConfidence = typeof j.confidence === "number" ? j.confidence : null;
          }
        }
      } catch {
        // silent — sesizarea pleaca fara custom_category
      }
    }

    try {
      const res = await fetch("/api/sesizari", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_name: data.nume.trim(),
          author_email: data.email.trim() || null,
          tip: data.tip,
          titlu: effectiveTitlu,
          locatie: data.locatie.trim(),
          sector,
          lat,
          lng,
          descriere: data.descriere.trim(),
          formal_text: formalTextForDb,
          custom_category: customCategory,
          custom_category_confidence: customCategoryConfidence,
          imagini,
          publica: data.publica,
          _honey: honey,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        trackFunnelStep("sesizare-create", "error");
        throw new Error(json.error || "Eroare trimitere");
      }
      // Save user data for anonymous users (so next submission auto-fills)
      if (!user && typeof window !== "undefined") {
        localStorage.setItem(
          "civic_user_data",
          JSON.stringify({ name: data.nume, address: data.adresa, email: data.email })
        );
      }
      // Draft is safely committed to the server — drop the local backup
      // so a future visit starts with a clean form.
      if (typeof window !== "undefined") {
        localStorage.removeItem(DRAFT_KEY);
      }
      setSubmitted({ code: json.data.code });
      // A11y: announce success cu codul pentru screen readers
      announce(`Sesizare inregistrata cu succes. Codul tau este ${json.data.code.split("").join(" ")}`);
      trackFunnelStep("sesizare-create", "submitted", { hasPhotos: imagini.length > 0 ? 1 : 0 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Eroare trimitere";
      setError(msg);
      // A11y: anunta eroarea asertiv (intrerupe screen reader)
      announce(`Eroare la trimitere: ${msg}`, "assertive");
    } finally {
      setSubmitting(false);
    }
  };

  const tipInfo = SESIZARE_TIPURI.find((t) => t.value === data.tip);
  const parkingCtx =
    data.tip === "parcare" && parkingJurisdiction
      ? { jurisdiction: parkingJurisdiction }
      : undefined;
  // Bug fix user 5/22/2026 — recipients calculate doar daca avem semnal real
  // de locatie (text adresa SAU lat/lng SAU detectedCounty). Inainte, daca
  // user-ul alegea „stalpisori" fara sa fi pus inca adresa, recipients
  // afisa intregul stack de Bucuresti (PMB, ASPMB, BPR, PL Buc) ca default
  // — gresit pentru ceilalti cetateni din alte orase. Acum asteptam adresa.
  const hasLocationSignal =
    !!data.locatie?.trim() || (data.lat != null && data.lng != null) || !!detectedCounty;
  const recipients = data.tip && hasLocationSignal
    ? getAuthoritiesFor(data.tip, data.sector, detectedCounty, data.locatie, parkingCtx)
    : null;

  const LUNI_RO = ["ianuarie","februarie","martie","aprilie","mai","iunie","iulie","august","septembrie","octombrie","noiembrie","decembrie"];
  const now = new Date();
  const today = `${now.getDate()} ${LUNI_RO[now.getMonth()]} ${now.getFullYear()}`;

  // Data/ora constatării scoasă din flow — "Astăzi, {today}" e suficient.
  const constatareText = "";

  const evidenceText = imagini.length > 0
    ? `\nAnexez ${imagini.length} ${imagini.length === 1 ? "fotografie" : "fotografii"}.\n`
    : "";

  // Route through buildFormalText so the AI-generated text gets the same
  // identity/date/photo-URL rewriter as the final Gmail body. Otherwise
  // preview shows something different than what actually gets sent.
  const previewText = (data.tip === "parcare" && parkingPlateText && parkingJurisdiction) || data.formal_text
    ? buildFormalText({
        tip: data.tip,
        titlu: effectiveTitlu,
        locatie: data.locatie,
        sector: data.sector,
        lat: data.lat,
        lng: data.lng,
        descriere: data.descriere,
        formal_text: data.formal_text,
        author_name: data.nume,
        author_email: data.email || null,
        author_address: data.adresa || null,
        imagini,
        parking:
          data.tip === "parcare"
            ? {
                plate: parkingPlateText,
                jurisdiction: parkingJurisdiction || null,
                observedAt: parkingObservedAt || null,
              }
            : undefined,
      })
    : `Bună ziua,

Mă numesc ${data.nume || "[NUMELE]"}, locuiesc în ${data.adresa || "[ADRESA]"} și doresc să vă aduc la cunoștință o problemă care afectează calitatea vieții pe ${data.locatie || "[LOCAȚIA]"}.

Astăzi, ${today}, am observat ${tipInfo?.label.toLowerCase() || "[tipul problemei]"}${constatareText} în această zonă. ${data.descriere || "[DESCRIEREA DETALIATĂ A PROBLEMEI]"}
${evidenceText}
Pentru a rezolva această situație, vă solicit respectuos să luați următoarele măsuri:

1. Verificare la fața locului: constatarea situației și identificarea măsurilor necesare.
2. Intervenție corespunzătoare: remedierea problemei în termen rezonabil.
3. Comunicare răspuns: informare privind măsurile luate, conform OG 27/2002.

De asemenea, vă rog să îmi furnizați un număr de înregistrare pentru această sesizare, pentru a putea urmări progresul soluționării.

Vă mulțumesc anticipat pentru atenția acordată.

Cu stimă,
${data.nume || "[NUMELE]"}
${today}`;

  const mailtoLink = () => {
    if (!recipients) return "#";
    let subject = `Sesizare — ${tipInfo?.label ?? "problemă"} — ${data.locatie}`;
    if (data.tip === "parcare" && parkingPlateText) {
      subject = `Sesizare parcare neregulamentară — ${parkingPlateText} — ${data.locatie}`;
    }
    const to = recipients.primary.map((a) => a.email).join(",");
    const cc = recipients.cc.length > 0 ? `&cc=${recipients.cc.map((a) => a.email).join(",")}` : "";
    const body = previewText.replace(/\[\[BOLD]]([^[]+?)\[\[\/BOLD]]/g, "$1");
    return `mailto:${to}?subject=${encodeURIComponent(subject)}${cc}&body=${encodeURIComponent(body)}`;
  };

  const copyText = () => {
    navigator.clipboard.writeText(previewText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (submitted) {
    const emailInput = {
      tip: data.tip,
      titlu: effectiveTitlu,
      locatie: data.locatie,
      sector: data.sector,
      lat: data.lat,
      lng: data.lng,
      descriere: data.descriere,
      formal_text: data.formal_text || null,
      author_name: data.nume,
      author_email: data.email || null,
      author_address: data.adresa || null,
      imagini,
      code: submitted.code,
      parking:
        data.tip === "parcare"
          ? {
              plate: parkingPlateText,
              jurisdiction: parkingJurisdiction || null,
              observedAt: parkingObservedAt || null,
            }
          : undefined,
    };
    const showHotspot =
      data.tip === "parcare" && !hotspotShown && data.lat != null && data.lng != null;
    return (
      <>
        <SuccessScreen
          code={submitted.code}
          emailInput={emailInput}
          imaginiCount={imagini.length}
          // Sprite „Prima sesizare" arata DOAR daca:
          // - user logat cu 0 sesizari prior (count == 0), SAU
          // - user anonim/fara count fetched (null) — fallback la
          //   localStorage din CivicSprite.
          isFirstSesizare={priorSesizariCount === null || priorSesizariCount === 0}
          onAnother={() => {
            setSubmitted(null);
            setData((d) => ({ ...INITIAL, nume: d.nume, adresa: d.adresa, email: d.email }));
            setImagini([]);
            setParkingSlots({ plate: null, vehicle: null, context: null });
            setParkingPlateText("");
            setParkingJurisdiction("");
            const d = new Date();
            d.setSeconds(0, 0);
            const pad = (n: number) => String(n).padStart(2, "0");
            setParkingObservedAt(
              `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
            );
            setHotspotShown(false);
          }}
        />
        {showHotspot && data.lat != null && data.lng != null && (
          <ParkingHotspotModal
            lat={data.lat}
            lng={data.lng}
            excludeCode={submitted.code}
            authorName={data.nume}
            authorAddress={data.adresa}
            locatie={data.locatie}
            onClose={() => setHotspotShown(true)}
          />
        )}
      </>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_1.1fr] gap-8">
      {/* Form */}
      <div className="space-y-5">
        {/* Honeypot — hidden from humans, bots fill it.
            name="website" tricks autofill into ignoring it (no real "website" field).
            autocomplete="new-password" prevents mobile autofill. */}
        <div style={{ position: "absolute", left: "-9999px", height: 0, overflow: "hidden" }} aria-hidden="true">
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="new-password"
            value={honey}
            onChange={(e) => setHoney(e.target.value)}
          />
        </div>

        {draftRestoredAt && !draftDismissed && (
          <div className="mb-4 p-3 rounded-[var(--radius-xs)] border border-emerald-500/30 bg-emerald-500/5 flex items-start gap-3">
            <span className="text-lg" aria-hidden>📝</span>
            <div className="flex-1 text-xs">
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                Ciornă restaurată
              </p>
              <p className="text-[var(--color-text-muted)] mt-0.5">
                Am recuperat sesizarea la care lucrai — salvată pe {draftRestoredAt}. Verifică și trimite sau golește formularul.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  localStorage.removeItem(DRAFT_KEY);
                }
                // Full reset — mirror what onAnother() does on the
                // success screen so the form actually looks empty
                // (was leaving parking slots + plate text behind).
                setData(INITIAL);
                setImagini([]);
                setParkingSlots({ plate: null, vehicle: null, context: null });
                setParkingPlateText("");
                setParkingJurisdiction("");
                setDraftDismissed(true);
                setDraftRestoredAt(null);
              }}
              className="text-xs font-medium text-red-600 hover:text-red-700 shrink-0 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
            >
              Golește
            </button>
          </div>
        )}

        {/* Tip picker removed — the AI auto-classifies from descriere
            (see polishSesizare → tipDetectedByAI flow) and there's
            still a manual dropdown lower in the form for the rare
            case AI gets it wrong. The icon-grid was a holdover from
            an earlier funnel attempt and visually dominated the form
            for no real benefit once classification got reliable. */}

        {/* DESCRIERE FIRST — analytics showed 84% of users abandoned the
            form before selecting tip. Cause: form opened with three
            personal-info fields (name + address + email) before the
            user could even describe what they wanted to report. Now
            the friendly "describe the problem" field is the first
            thing the user sees; personal info is collected at the end
            once they're committed. */}
        <Field label="Descrie problema" required>
          <div className="relative">
            <textarea
              value={data.descriere}
              onChange={(e) => update("descriere", e.target.value.slice(0, 2000))}
              rows={mode === "complet" ? 7 : 5}
              placeholder="Ex: Groapă pe trotuar la blocul H12"
              autoCapitalize="sentences"
              spellCheck
              className={cn(inputClass, "resize-y min-h-[120px] py-3 pr-12")}
            />
            <div className="absolute top-2 right-2">
              <VoiceInput
                onTranscript={(delta) => {
                  // Append dictated text with a space separator,
                  // respecting the 2000-char cap so nothing gets
                  // silently truncated mid-word.
                  const current = data.descriere;
                  const joiner = current && !/\s$/.test(current) ? " " : "";
                  update("descriere", (current + joiner + delta).slice(0, 2000));
                }}
              />
            </div>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
            Scrie liber. Punem textul în formă oficială.{" "}
            <span
              className={cn(
                "whitespace-nowrap tabular-nums font-medium",
                data.descriere.length >= 1900
                  ? "text-red-500"
                  : data.descriere.length >= 1600
                    ? "text-amber-500"
                    : "text-[var(--color-text-muted)]"
              )}
            >{data.descriere.length}/2000 · minim 10</span>
          </p>
        </Field>

        <Field label="Tip problemă" required>
          {/* 2026-05-18: scoase quick-pick chips la cererea user-ului —
              redundant cu dropdown-ul + AI auto-detect din descriere. */}
          <div className="flex items-center gap-2">
            <select
              value={data.tip}
              onChange={(e) => {
                update("tip", e.target.value);
                setTipDetectedByAI(false);
                if (e.target.value) {
                  trackFunnelStep("sesizare-create", "tip-selected", { tip: e.target.value, source: "manual" });
                }
              }}
              className={cn(inputClass, "flex-1")}
              aria-label="Tip problemă"
            >
              <option value="">Alege tipul... (se completează automat din descriere)</option>
              {SESIZARE_TIPURI_ACTIVE.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>
            {tipDetecting && (
              <span className="text-xs text-[var(--color-text-muted)] inline-flex items-center gap-1" role="status">
                <Loader2 size={12} className="motion-safe:animate-spin" aria-hidden="true" /> Detectăm tipul…
              </span>
            )}
            {tipDetectedByAI && !tipDetecting && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium" title="Detectat automat din descriere">
                Auto
              </span>
            )}
            {/* Bug fix #8 — Vision confidence badge: verde 70%+, amber 40-70%,
                rosu <40%. User stie cat de incredere e suggestion-ul AI. */}
            {visionConfidence !== null && (
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                  visionConfidence >= 70
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : visionConfidence >= 40
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      : "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                }`}
                title={
                  visionConfidence >= 70
                    ? "AI foarte încrezător în acest tip"
                    : visionConfidence >= 40
                      ? "AI parțial sigur — verifică sugestia"
                      : "AI nu e sigur — alege manual tipul corect"
                }
              >
                {visionConfidence}%
              </span>
            )}
          </div>
          {tipDetectedByAI && !tipDetecting && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Tipul a fost detectat automat din poza/descriere. Poți să-l schimbi dacă vrei altul.
            </p>
          )}
        </Field>

        {!recipients && data.tip && !hasLocationSignal && (
          <div className="rounded-[var(--radius-xs)] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-xs">
            <p className="text-amber-900 dark:text-amber-300 flex items-center gap-1">
              <Mail size={12} aria-hidden="true" /> Destinatarii se determină după ce introduci locația — adresă, oraș sau coordonate GPS.
            </p>
          </div>
        )}

        {recipients && (
          <div className="rounded-[var(--radius-xs)] bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-3 text-xs">
            <p className="font-semibold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-1">
              <Mail size={12} aria-hidden="true" /> Emailul tău va ajunge la {recipients.primary.length + recipients.cc.length} destinatari oficiali:
            </p>
            <ul className="space-y-1">
              {recipients.primary.map((a) => (
                <li key={a.email} className="text-blue-800 dark:text-blue-300 flex items-start gap-2">
                  <span className="inline-block w-4 text-[10px] text-blue-500 mt-0.5">TO</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{a.name}</span>
                    <span className="block text-[10px] font-mono text-blue-700/70 dark:text-blue-500 break-all">
                      {a.email}
                    </span>
                  </div>
                </li>
              ))}
              {recipients.cc.map((a) => (
                <li key={a.email} className="text-blue-700/80 dark:text-blue-400 flex items-start gap-2">
                  <span className="inline-block w-4 text-[10px] text-blue-500 mt-0.5">CC</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{a.name}</span>
                    <span className="block text-[10px] font-mono text-blue-700/70 dark:text-blue-500 break-all">
                      {a.email}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Field label="Titlu scurt (opțional)">
          <input
            type="text"
            value={data.titlu}
            onChange={(e) => update("titlu", e.target.value.slice(0, 200))}
            placeholder="Automat din descriere"
            className={inputClass}
          />
        </Field>

        <Field label="Unde exact se află problema?" required>
          <div className="flex gap-2">
            <input
              type="text"
              value={data.locatie}
              onChange={(e) => update("locatie", e.target.value)}
              placeholder="Calea Victoriei 45, în fața clădirii BCR"
              className={cn(inputClass, "flex-1")}
            />
            <button
              type="button"
              onClick={getLocation}
              disabled={geoLoading}
              className="shrink-0 h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors flex items-center gap-2 text-sm disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              aria-label={geoLoading ? "Se detectează locația" : "Folosește GPS-ul pentru a prinde locația actuală"}
              title="Folosește GPS-ul pentru a prinde locația actuală"
            >
              {geoLoading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Locate size={16} aria-hidden="true" />}
              <span className="hidden sm:inline tabular-nums">
                {geoLoading
                  ? gpsAccuracy != null
                    ? `±${Math.round(gpsAccuracy)}m…`
                    : "Detectez…"
                  : "GPS"}
              </span>
            </button>
          </div>
          {data.lat && data.lng && (
            <div className="mt-1 space-y-0.5">
              <p className={cn(
                "text-xs flex items-center gap-1.5",
                gpsAccuracy != null && gpsAccuracy <= 15 ? "text-emerald-600" : "text-amber-600"
              )}>
                📍 {data.lat.toFixed(5)}, {data.lng.toFixed(5)}
                {gpsAccuracy != null && (
                  <span className="font-medium">
                    · precizie ±{Math.round(gpsAccuracy)}m
                    {geoLoading && <span className="ml-1 italic opacity-70">(se rafinează...)</span>}
                    {!geoLoading && gpsAccuracy <= 15 && " ✓"}
                  </span>
                )}
              </p>
              {(detectedCountyName || detectedLocality || data.sector) && (
                <p className="text-xs text-[var(--color-text-muted)]">
                  🏙️ {detectedLocality ?? ""}{detectedCountyName ? `, jud. ${detectedCountyName}` : ""}{data.sector && detectedCounty === "B" ? ` (${data.sector})` : ""} — detectat automat
                </p>
              )}
            </div>
          )}
        </Field>

        {data.tip === "parcare" ? (
          <>
            <Field label="Dovadă fotografică (3 sloturi)" required>
              <ParkingProofUploader
                value={parkingSlots}
                onChange={(v) => {
                  setParkingSlots(v);
                  // Sync into the generic `imagini` array so the rest of
                  // the form (preview, DB insert, email body) keeps
                  // working without branches.
                  const urls = [v.plate, v.vehicle, v.context].filter(
                    (u): u is string => !!u,
                  );
                  setImagini(urls);
                }}
                plateText={parkingPlateText}
                onPlateTextChange={setParkingPlateText}
              />
            </Field>

            <Field label="Ce blochează vehiculul?" required>
              <div className="grid gap-2">
                {PARKING_JURISDICTION_OPTIONS.map((o) => (
                  <label
                    key={o.value}
                    className={cn(
                      "flex gap-3 p-3 rounded-[var(--radius-xs)] border cursor-pointer transition-colors",
                      parkingJurisdiction === o.value
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                        : "border-[var(--color-border)] hover:border-[var(--color-primary)]/50 bg-[var(--color-surface)]",
                    )}
                  >
                    <input
                      type="radio"
                      name="parking-jurisdiction"
                      checked={parkingJurisdiction === o.value}
                      onChange={() => setParkingJurisdiction(o.value)}
                      className="mt-0.5 accent-[var(--color-primary)]"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{o.label}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{o.hint}</p>
                    </div>
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Data și ora constatării" required>
              <input
                type="datetime-local"
                value={parkingObservedAt}
                onChange={(e) => setParkingObservedAt(e.target.value)}
                max={parkingObservedMax || undefined}
                className="w-full h-11 px-3 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Poliția are nevoie de momentul EXACT al constatării — intră direct în procesul-verbal. Completat automat cu acum, poți corecta dacă ai văzut mașina mai devreme.
              </p>
            </Field>
          </>
        ) : (
          <Field label="Fotografii (max 5)">
            <PhotoUploader urls={imagini} onChange={setImagini} max={5} />
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              O poză apropiată + una de context.
            </p>
            {imagini.length > 0 && (
              <div className="mt-2 flex items-start gap-2 p-3 rounded-[var(--radius-xs)] bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-300">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <p>
                  <strong>Atașează pozele manual în email</strong> — apar pe Civia, dar e mai bine să le pui și ca atașamente.
                </p>
              </div>
            )}
          </Field>
        )}

        {/* F2 Duplicate Detection — caut sesizari similare nearby (50m) cu
            acelasi tip in ultimele 7 zile. Daca match → user vede sugestii
            cu cosign in loc de duplicate. */}
        <DuplicateDetector
          tip={data.tip || null}
          lat={data.lat}
          lng={data.lng}
          sector={data.sector || null}
          enabled={!!data.tip && data.lat != null && data.lng != null}
        />

        {/* IDENTITATE — collected at the END after the user has invested
            time describing the problem, attaching photos, picking a
            location. Asking for name + address up-front made 84% of
            users abandon. Now they're committed; legal info feels
            justified. */}
        <div className="pt-2 mt-4 border-t border-[var(--color-border)]">
          <h3 className="font-[family-name:var(--font-sora)] font-bold text-base mb-1">
            Cine ești
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mb-4 leading-relaxed">
            Apar în email, nu pe site. <strong>Rămân private.</strong>
          </p>
        </div>

        <Field label="Numele tău complet" required>
          <input
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            value={data.nume}
            onChange={(e) => update("nume", e.target.value)}
            onBlur={() => { if (data.nume) update("nume", capitalizeName(data.nume)); }}
            placeholder="Maria Popescu"
            className={inputClass}
          />
        </Field>

        <Field label="Adresa ta de domiciliu" required>
          <input
            type="text"
            autoComplete="street-address"
            autoCapitalize="words"
            value={data.adresa}
            onChange={(e) => update("adresa", e.target.value)}
            onBlur={() => { if (data.adresa) update("adresa", formatAddress(data.adresa)); }}
            placeholder="Str. Matei Voievod 12"
            className={inputClass}
          />
        </Field>

        {/* 2026-05-18: scos field „Email de contact (opțional)" la cererea
            user-ului. Email-ul cetateanului se ia din contul logat (cand exista)
            sau ramane null. Useri anonimi care vor follow-up trebuie sa-si faca
            cont. Reduce friction la form + zero PII colectat fara nevoie. */}

        {/* AI rewrite e acum automat (vezi prewarmTimerRef useEffect).
            User request 2026-05-15: scoatem butonul mare „Rescrie textul".
            Indicator subtle pe stare:
             • aiLoading → spinner cu „AI rescrie…"
             • formal_text gata → confirmare cu link discret „Regenerează"
             • nimic înca → ghid simplu cum funcționează. */}
        {aiLoading ? (
          <p className="inline-flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400" role="status">
            <Loader2 size={13} className="motion-safe:animate-spin" aria-hidden="true" />
            <Sparkles size={11} aria-hidden="true" /> AI rescrie textul în limbaj oficial…
          </p>
        ) : data.formal_text ? (
          <div className="flex items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles size={11} className="text-purple-500" aria-hidden="true" />
              Textul a fost rescris — apare în email și pe pagina publică.
            </span>
            <button
              type="button"
              onClick={() => handleAIImprove({ withPhotos: imagini.length > 0 })}
              className="text-[var(--color-primary)] hover:underline font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
              title="Regenerează textul oficial cu AI"
            >
              Regenerează
            </button>
          </div>
        ) : null}

        <label className="flex items-center gap-3 p-4 bg-[var(--color-surface-2)] rounded-[var(--radius-md)] cursor-pointer">
          <input
            type="checkbox"
            checked={data.publica}
            onChange={(e) => update("publica", e.target.checked)}
            className="w-5 h-5 rounded accent-[var(--color-primary)]"
          />
          <div className="flex-1">
            <p className="text-sm font-medium">Publică pe Civia (recomandat)</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Alții o pot <strong>vota</strong> și <strong>co-semna</strong>. Mai multe voci = răspuns mai rapid.
            </p>
          </div>
        </label>

        {error && (
          <div ref={errorRef} role="alert" className="p-3 rounded-[var(--radius-xs)] bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          aria-busy={submitting}
          className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
          {submitting ? "Se generează textul și se salvează..." : "Trimite sesizarea la autorități"}
        </button>

        {!data.formal_text && !aiLoading && !submitting && (
          <p className="text-[11px] text-center text-[var(--color-text-muted)] mt-2 inline-flex items-center justify-center gap-1.5 w-full">
            <Sparkles size={11} className="text-purple-500" aria-hidden="true" />
            AI rescrie automat textul în limbaj oficial — apeși doar Trimite.
          </p>
        )}

        {draftSavedAt && !submitting && !submitted && (
          <p className="text-[10px] text-center text-[var(--color-text-muted)] mt-2 flex items-center justify-center gap-1">
            <span
              className="w-1.5 h-1.5 rounded-full bg-emerald-500"
              aria-hidden="true"
            />
            Formularul se salvează automat — dacă închizi pagina, îl găsești la
            revenire
          </p>
        )}
      </div>

      {/* Preview */}
      <div>
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-6 sticky top-24">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-[family-name:var(--font-sora)] font-semibold text-lg">Previzualizare</h3>
            {data.formal_text && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs font-medium">
                <Sparkles size={10} aria-hidden="true" /> Formal
              </span>
            )}
          </div>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-xs)] p-5 mb-4 text-sm leading-relaxed text-[var(--color-text)] max-h-[60vh] sm:max-h-[420px] overflow-y-auto shadow-inner">
            {previewText.split(/\n\n+/).map((paragraph, i) => (
              <p key={i} className="mb-3 last:mb-0 whitespace-pre-line">
                {paragraph}
              </p>
            ))}
          </div>
          {/* 2026-05-18: scoase butoanele Email + Copiază — flow oficial
              e Trimite Sesizarea la Autorități (de jos), nu copy-paste.
              EmailChoicePanel apare in SuccessScreen dupa submit, cu UX
              mult mai clar (Gmail / Outlook / Yahoo / mailto / etc). */}
          {recipients && (
            <p className="text-xs text-[var(--color-text-muted)] mt-4">
              <strong>Se trimite la:</strong> {recipients.primary.map((a) => a.name).join(", ")}
              {recipients.cc.length > 0 && <><br /><strong>CC:</strong> {recipients.cc.map((a) => a.name).join(", ")}</>}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Field + inputClass extras în ./FormField.tsx (sprint 10). Importate ca
// aliases la topul fisierului (Field = FormField, inputClass = FORM_INPUT_CLASS).


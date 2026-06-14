"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Locate,
  Mail,
  Send,
  Sparkles,
  Loader2,
  Pencil,
  AlertCircle,
  Map as MapIcon,
} from "lucide-react";
import { SESIZARE_TIPURI, SESIZARE_TIPURI_ACTIVE, BUCHAREST_CENTER } from "@/lib/constants";
import { getAuthoritiesFor } from "@/lib/sesizari/authorities";
import { detectCountyFromLocatie } from "@/lib/sesizari/county-from-locatie";
import { ALL_COUNTIES } from "@/data/counties";
import { capitalizeName, formatAddress } from "@/lib/sesizari/format-helpers";
import { detectSectorFromCoords } from "@/lib/geo/sector-from-coords";
import type { AddressSuggestion } from "@/lib/geo/reverse-geocode";
import { detectSectorFromText } from "@/lib/sesizari/sector-detect";
import { deriveTitluFromDescriere, isPlaceholderTitlu } from "@/lib/sesizari/titlu";
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
// 2026-06-13 — Picker de locație pe hartă (feedback tester): alternativă la GPS
// pentru cei care nu dau permisiune browserului. Lazy (leaflet ~heavy).
const MapLocationPicker = nextDynamic(() => import("./MapLocationPicker"), { ssr: false });
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
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  // 2026-06-14 — Autocomplete adresă (forward-geocode). Pe GPS imprecis,
  // userul scrie strada lui și alege locul EXACT din sugestii (nu o stradă
  // apropiată ghicită). Sursa de adevăr pt. locație când GPS-ul nu poate.
  const [addrSugg, setAddrSugg] = useState<AddressSuggestion[]>([]);
  const [addrLoading, setAddrLoading] = useState(false);
  const [showSugg, setShowSugg] = useState(false);
  const addrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addrCtrlRef = useRef<AbortController | null>(null);
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
  // 2026-06-14 — erori la nivel de CÂMP (sub fiecare câmp), setate doar când
  // userul apasă „Trimite". Butonul nu mai e disabled pe câmpuri goale: la
  // click, validăm și ducem userul (scroll + focus) la primul câmp incomplet.
  const [fieldErrors, setFieldErrors] = useState<{
    descriere?: string; locatie?: string; nume?: string; adresa?: string;
  }>({});
  const clearFieldError = (k: "descriere" | "locatie" | "nume" | "adresa") =>
    setFieldErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));

  // National geocoding state — pre-fill from county context if available
  const [detectedCounty, setDetectedCounty] = useState<string | null>(county?.id ?? null);
  const [detectedCountyName, setDetectedCountyName] = useState<string | null>(county?.name ?? null);

  // 2026-05-26 — Auto-detect county din locatie text dacă reverse-geocode
  // n-a setat încă valoarea. Critical pentru flow /sesizari (national) unde
  // userul scrie „Cluj-Napoca" în locatie dar nu a făcut click pe GPS.
  // Fără asta, routing-ul cade pe București default → email gresit.
  // valoarea nu mai e afișată (am scos blocul „detectat automat"); setter-ul
  // rămâne folosit de geocode/pick ca să nu rescriem fluxul.
  const [, setDetectedLocality] = useState<string | null>(null);

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
      if (sharedTitle && !isPlaceholderTitlu(sharedTitle) && !d.titlu) next.titlu = sharedTitle;
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

      // 2026-05-24 — sync și pe server (drafts table) ca să trimitem email
      // nudge la 24h dacă userul nu finalizează. Funcționează și pentru anonimi
      // cu email completat. Non-blocking, errors silently swallowed.
      if (data.email?.trim() || data.descriere.length >= 30) {
        void fetch("/api/sesizari/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: data.email?.trim() || null,
            tip: data.tip || null,
            titlu: data.titlu || null,
            locatie: data.locatie || null,
            descriere: data.descriere || null,
            county: detectedCounty || null,
            sector: data.sector || null,
          }),
        }).catch(() => { /* silent — local draft e backup */ });
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [data, imagini, parkingSlots, parkingPlateText, parkingJurisdiction, parkingObservedAt, submitted, detectedCounty]);

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

  // 2026-05-26 — Auto-detect county din `locatie` text când userul tastează.
  // Recalculează la fiecare schimbare ca să NU rămână sticky:
  //   - User tastează „Iași" → detected = IS
  //   - User șterge și tastează „București" → detected = B (corect, nu IS)
  //   - User șterge tot → revine la county-context (fallback la county prop)
  // GPS coords nu mai override aici — geocode-ul cheamă explicit setDetectedCounty
  // în alt useEffect (reverse geocode). Aici doar text-based.
  useEffect(() => {
    // 2026-06-13 FIX: când avem coords din GPS/hartă, reverse-geocode-ul e
    // SURSA DE ADEVĂR pentru județ (setează detectedCounty în effect-ul de
    // geocode). Detecția din TEXT nu trebuie să-l suprascrie — altfel, pe un
    // text de coordonate (geocode în curs/eșuat), detectCountyFromLocatie dă
    // null și cădeam pe county-context din COOKIE (ex: TM dacă userul a navigat
    // pe Timișoara înainte), rutând o sesizare din București GREȘIT la Timișoara.
    if (data.lat != null && data.lng != null) return;
    const text = data.locatie?.trim() ?? "";
    if (text.length < 4) {
      // Locatia goală/scurtă → fallback la county-context (county prop)
      setDetectedCounty(county?.id ?? null);
      return;
    }
    const detected = detectCountyFromLocatie(text);
    // 2026-06-14 FIX: când userul a TASTAT o adresă, NU mai cădem pe
    // county-context din COOKIE. Cookie-ul reflectă județul pe care l-a
    // RĂSFOIT (ex: Cluj), nu unde e problema. Pe „Strada Novaci 12" (stradă
    // bucureșteană pe care regex-ul nu o știe) cădeam pe Cluj și rutam la
    // Primăria Cluj-Napoca — inadmisibil. Acum: oraș clar din text → îl
    // folosim; altfel null → fallback-ul AI (detect-city) rulează sau userul
    // alege o sugestie de adresă (care setează județul definitiv).
    setDetectedCounty(detected);
  }, [data.locatie, county?.id, data.lat, data.lng]);

  // 2026-06-14 FIX (raport user „Șoseaua Viilor, Sector 5" detectat S4): sectorul
  // scris EXPLICIT în textul locației e AUTORITAR — userul își știe sectorul, iar
  // geocode-ul/AI-ul greșesc pe străzile de la limita dintre sectoare (Nominatim
  // tag-uia Șoseaua Viilor ca S4). Re-asertăm la fiecare schimbare a LOCAȚIEI;
  // NU depinde de data.sector, deci override-ul manual din dropdown (care schimbă
  // doar sectorul, nu locația) rămâne neatins.
  useEffect(() => {
    const m = data.locatie?.match(/sector(?:ul)?\s*([1-6])\b/i);
    if (!m) return;
    const sn = `S${m[1]}`;
    setData((d) => (d.sector === sn ? d : { ...d, sector: sn }));
    setDetectedCounty("B"); // un sector explicit ⇒ București
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.locatie]);

  // 2026-05-26 — AI city detection FALLBACK via Groq pentru adrese pe care
  // regex-ul detectCountyFromLocatie nu le poate identifica (ex: „lângă
  // Universitate", „Drumul Taberei" fără București menționat, „Piața
  // Centrală" cu nume comun). Debounce 3s după ultima tastare ca să nu
  // spammăm Groq. Server cache 60s. Trigger DOAR dacă regex-ul a eșuat
  // (detected null) și textul e suficient lung (>=8 chars). Pe dispozitive
  // mobile cu connection slabă, abort previous fetch ca să nu blocăm UI.
  useEffect(() => {
    const text = data.locatie?.trim() ?? "";
    if (text.length < 8) return;
    // Skip dacă regex-ul deja a returnat un county valid din text
    if (detectCountyFromLocatie(text)) return;

    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/ai/detect-city", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locatie: text }),
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const json = await res.json();
        const d = json.data as { county: string | null; sector: string | null } | undefined;
        if (!d) return;
        if (d.county) {
          setDetectedCounty(d.county);
        }
        if (d.county === "B" && d.sector && !data.sector) {
          // Pre-fill sector dacă lipsește și AI a detectat unul
          setData((prev) => ({ ...prev, sector: d.sector! }));
        }
      } catch {
        // silent — fail open (regex fallback rămâne valoarea curentă)
      }
    }, 3000);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.locatie]);

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
  // Sector auto-detect flag — afisam un mic indicator „Sector detectat
  // automat" cand l-am gasit din text (keyword-based) ca user-ul sa
  // poata corecta daca am gresit. Reset cand user schimba manual.
  const [sectorDetectedByText, setSectorDetectedByText] = useState(false);
  // (audit) state-ul nearbyDuplicates + tipul aferent au fost eliminate —
  // detectarea duplicatelor se face acum doar prin <DuplicateDetector>.

  // 2026-06-06 — ELIMINAT auto-detectarea tipului din IMAGINE (vision-route).
  // User: tipul de problemă se setează STRICT din DESCRIERE (vezi mai jos
  // /api/ai/classify pe text). Poza rămâne pentru dovezi + textul formal, dar
  // NU mai dictează tipul.

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

  // 2026-06-08 (audit): detectarea duplicatelor în form se face acum DOAR prin
  // <DuplicateDetector> (50m). Effect-ul vechi nearbyDuplicates (80m) a fost
  // eliminat — request dublu + UI dublu + ref care nu se reseta (rula o dată).

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
          sector: data.sector || undefined,
          imagini: opts?.withPhotos ? imagini : undefined,
        }),
      });
      // Defensive parse: la timeout/500, Vercel întoarce non-JSON („An error
      // occurred") → res.json() arunca „Unexpected token A". Verificăm tipul.
      const ct = res.headers.get("content-type") || "";
      const json: { data?: { formal_text?: string }; error?: string } = ct.includes("application/json")
        ? await res.json().catch(() => ({}))
        : { error: (await res.text().catch(() => "")).slice(0, 160) || `Serverul a răspuns ${res.status}` };
      if (!res.ok) throw new Error(json.error || "Generarea textului a eșuat");
      const formalText = json.data?.formal_text;
      if (!formalText) throw new Error("Serviciul de generare e temporar indisponibil. Reîncearcă în câteva secunde.");
      // 2026-06-04 — Înainte extrageam titlul cu regex pe „Vă sesizez cu
      // privire la..." — frază INTERZISĂ de prompt, deci regex-ul nu prindea
      // niciodată și titlul rămânea gol → cădea pe placeholder. Acum, dacă
      // userul n-a tastat un titlu, derivăm unul curat din descriere. Serverul
      // regenerează oricum un titlu AI mai bun la submit (sursă de adevăr).
      setData((d) => ({
        ...d,
        formal_text: formalText,
        titlu: d.titlu || deriveTitluFromDescriere(d.descriere),
      }));
      // 2026-05-25 #7 — explicit funnel step după AI improve success
      // (separat de „ai-improve" care fires la click; asta fires la
      // text efectiv generat ⇒ measures success rate).
      trackFunnelStep("sesizare-create", "formal-text-generated", {
        textLength: formalText.length,
        hasTitle: (data.titlu || data.descriere) ? 1 : 0,
      });
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
    if (aiLoading) return; // audit fix: nu porni generări AI concurente (race pe formal_text)
    if (formalEditedRef.current) return; // userul a editat manual — nu suprascriem
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
  const lastGenSigRef = useRef<string>("");
  // 2026-06-13 (feedback licarazvan90): userul a cerut să poată EDITA textul
  // oficial înainte de trimitere. Odată editat manual, NU mai auto-regenerăm
  // (altfel AI-ul i-ar șterge modificările). Butonul „Regenerează" resetează.
  const formalEditedRef = useRef(false);
  // 2026-06-14 — textul oficial EDITAT de user (full email, exact ce se trimite).
  // null = needitat → folosim textul auto-generat (preview). Non-null = userul a
  // ajustat → îl trimitem VERBATIM cu flag-ul `formal_text_edited` (serverul
  // sare regenerarea). Astfel editarea chiar are efect (înainte serverul regenera
  // mereu din template și pierdea modificările).
  const [editedText, setEditedText] = useState<string | null>(null);
  // Previzualizarea de dinainte de „Trimite" e read-only by default; butonul
  // „Modifică textul" o deschide într-un textarea editabil (editOpen).
  const [editOpen, setEditOpen] = useState(false);
  useEffect(() => {
    if (aiLoading) return; // deja ruleaza
    if (formalEditedRef.current) return; // userul a editat manual textul — nu regenerăm
    if (!profileLoaded) return; // așteptăm identity de pe profile/localStorage
    if (data.descriere.length < 30) return; // not enough context
    if (!data.tip) return;
    if (data.locatie.length < 3) return;
    // 2026-06-06 — REGENERARE la SCHIMBAREA inputurilor (nu doar prima dată).
    // User: „când termin de scris descriere + locație + nume + adresă, să se
    // REFACĂ". Semnătura inputurilor evită re-rularea pentru aceleași date
    // (fără buclă: formal_text NU mai e în deps).
    const sig = [
      data.descriere.trim(),
      data.tip,
      data.locatie.trim(),
      (data.nume || "").trim(),
      (data.adresa || "").trim(),
      data.sector || "",
    ].join("¦");
    if (sig === lastGenSigRef.current) return; // deja generat pentru aceste date
    if (prewarmTimerRef.current) clearTimeout(prewarmTimerRef.current);
    prewarmTimerRef.current = setTimeout(() => {
      lastGenSigRef.current = sig;
      void handleAIImprove({ withPhotos: imagini.length > 0, silent: true });
    }, 1500);
    return () => {
      if (prewarmTimerRef.current) clearTimeout(prewarmTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.descriere, data.tip, data.locatie, data.nume, data.adresa, data.sector, profileLoaded]);

  // 2026-06-14 — Autocomplete adresă (forward-geocode). Debounce 350ms + abort
  // cererea anterioară. Apare doar când userul TASTEAZĂ (nu când GPS-ul setează).
  const runAddressSearch = (query: string) => {
    if (addrTimerRef.current) clearTimeout(addrTimerRef.current);
    if (addrCtrlRef.current) addrCtrlRef.current.abort();
    const q = query.trim();
    if (q.length < 4) { setAddrSugg([]); setAddrLoading(false); setShowSugg(false); return; }
    setAddrLoading(true);
    addrTimerRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      addrCtrlRef.current = ctrl;
      try {
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const json = await res.json();
        setAddrSugg(Array.isArray(json.data) ? json.data : []);
        setShowSugg(true);
      } catch { /* abort/silent */ } finally { setAddrLoading(false); }
    }, 350);
  };

  // Userul alege o sugestie → locație + coords EXACTE + județ/sector.
  const pickSuggestion = (sg: AddressSuggestion) => {
    formalEditedRef.current = false; // adresă nouă → permite regenerarea textului
    setData((d) => ({ ...d, locatie: sg.label, lat: sg.lat, lng: sg.lng, sector: sg.sector || d.sector }));
    if (sg.countyCode) {
      setDetectedCounty(sg.countyCode);
      setDetectedCountyName(ALL_COUNTIES.find((c) => c.id === sg.countyCode)?.name ?? null);
    }
    setDetectedLocality(sg.countyCode === "B" ? "București" : null);
    setGpsAccuracy(null);
    setShowSugg(false);
    setAddrSugg([]);
  };

  // Cleanup la unmount: timer + abort.
  useEffect(() => () => {
    if (addrTimerRef.current) clearTimeout(addrTimerRef.current);
    if (addrCtrlRef.current) addrCtrlRef.current.abort();
  }, []);

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
          const g = json.data;
          // 2026-06-14 — GPS imprecis (>100m): NU afișa strada+numărul ghicite
          // din coordonate grosiere (pot fi la km distanță — „Strada Ileana
          // Cosânzeana 2" în loc de „Novaci 12"). Afișăm doar ZONA (sector/
          // localitate) ca punct de plecare; userul completează strada exactă
          // (scris cu autocomplete sau pe hartă). Sub 100m → adresa completă.
          let addr: string;
          if (lastAccuracy > 100) {
            const area =
              g.countyCode === "B"
                ? g.sector ? `Sector ${String(g.sector).replace("S", "")}, București` : "București"
                : g.locality || g.countyName || "";
            addr = area || g.shortAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          } else {
            addr = g.shortAddress || g.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          }
          setData((d) => ({ ...d, locatie: addr, sector: g.sector || d.sector }));
          if (g.countyCode) setDetectedCounty(g.countyCode);
          if (g.countyName) setDetectedCountyName(g.countyName);
          if (g.locality) setDetectedLocality(g.locality);
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

      // Trigger reverse geocode pe praguri de acuratețe.
      // 2026-06-13 FIX: primul geocode rulează la ORICE acuratețe rezonabilă
      // (era `acc < 2000` → pe fix-uri grosiere de desktop/wifi ±3-4km NU rula
      // niciodată, deci adresa nu se rezolva și rămânea „lat,lng (se detectează
      // adresa…)" pe veci). Chiar și un fix de 4km dă o adresă utilă la nivel de
      // zonă/sector; refinarea sub 100m/target o îmbunătățește când vine.
      // — primul: nivel zonă (vine primul, sub 500ms)
      // — ~100m (stradă, dacă vine)
      // — ≤target (număr clar, dacă vine)
      // Fiecare apel îl anulează pe cel anterior ca să nu dăm înapoi.
      if (acc < 20000 && geocodeCount === 0) doReverseGeocode(lat, lng);
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

  // Auto-generate titlu daca lipseste. Istoric: fallback la descriere.slice(80)
  // (text informal urat pe share), apoi la label-ul tipului — DAR pentru
  // „altele" label-ul e placeholderul „Altele (categoria se creează automat
  // din descriere)" care se scurgea ca titlu + in subiectul emailului
  // (bug 2026-06-04). Acum derivam un titlu curat DIN DESCRIERE (prima clauza).
  // Serverul regenereaza oricum un titlu AI mai bun la submit — asta e doar
  // pentru preview/share inainte de submit.
  const effectiveTitlu =
    data.titlu || deriveTitluFromDescriere(data.descriere);

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

  // 5/22/2026 — tip NU mai blocheaza submit. Daca lipseste, fallback la
  // "altele" + AI clasifica pe backend (custom_category). Funnel fix:
  // 83% abandon era la tip select.
  //
  // P1.12 (2026-05-24) — sector OBLIGATORIU pentru București. 33/48 sesizări
  // aveau sector=null → filtrele admin + heatmap pe sector deveneau inutile.
  // Pentru București (county=B), sectorul e necesar pentru routing email
  // (primărie sector vs PMB centrală).
  const countyIsBucuresti = (detectedCounty ?? "").toUpperCase() === "B";
  const sectorRequired = countyIsBucuresti;
  const sectorValid = !sectorRequired || (data.sector != null && data.sector.length > 0);

  const canSubmit =
    data.nume.length >= 2 &&
    data.adresa.trim().length >= 3 &&
    effectiveTitlu.length >= 3 &&
    data.locatie.length >= 3 &&
    data.descriere.length >= 10 &&
    parkingValid &&
    emailLooksValid &&
    sectorValid &&
    !submitting;

  // 2026-05-24 (P1.401) Cmd/Ctrl+Enter shortcut pentru submit rapid de
  // pe orice input. Common pattern în SaaS-uri civic-tech (FixMyStreet,
  // GitHub). Funcționează pe textarea (descriere) și inputs.
  useEffect(() => {
    if (submitted) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) {
        e.preventDefault();
        void handleSubmit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSubmit, submitted]);

  const handleSubmit = async () => {
    // 2026-05-25 #7 — funnel step „submit-clicked" capturat ÎNAINTE de
    // validare. Diferit de „submitted" (după success POST) — măsoară
    // câți users se opresc la validation errors vs câți chiar trimit.
    trackFunnelStep("sesizare-create", "submit-clicked", {
      hasPhotos: imagini.length > 0 ? 1 : 0,
      hasFormalText: data.formal_text ? 1 : 0,
      hasEmail: data.email ? 1 : 0,
      tipPresent: data.tip ? 1 : 0,
    });
    // 5/22/2026 — tip NU mai e obligatoriu. Daca user submite fara tip,
    // AI clasifica backend pe baza descrierii (custom_category). Analytics
    // arata 83% abandon la tip select — barrier removed.
    if (!data.tip && data.descriere.length >= 10) {
      setData((d) => ({ ...d, tip: "altele" }));
    }
    // 2026-06-14 — validare pe submit cu erori la nivel de CÂMP (scroll + focus
    // la primul câmp invalid). Câmpurile speciale (sector/email/parcare) rămân
    // în banner-ul general de eroare. Butonul nu mai e disabled pe câmpuri goale.
    if (submitting) return;
    const fe: typeof fieldErrors = {};
    if (data.descriere.trim().length < 10) fe.descriere = "Scrie problema — minim 10 caractere.";
    if (data.locatie.trim().length < 3) fe.locatie = "Adaugă unde se află problema (adresă sau oraș).";
    if (data.nume.trim().length < 2) fe.nume = "Scrie numele tău complet.";
    if (data.adresa.trim().length < 3) fe.adresa = "Adaugă adresa ta de domiciliu.";
    const bannerMissing: string[] = [];
    if (sectorRequired && !sectorValid) bannerMissing.push("Sectorul (S1–S6) pentru București");
    if (!emailLooksValid) bannerMissing.push("Email de contact valid");
    if (data.tip === "parcare") {
      if (!parkingSlots.plate) bannerMissing.push("Poza numărului de înmatriculare");
      if (!parkingSlots.vehicle) bannerMissing.push("Poza mașinii fără șofer");
      if (parkingPlateText.trim().length < 5) bannerMissing.push("Numărul de înmatriculare");
      if (!parkingJurisdiction) bannerMissing.push("Ce blochează vehiculul");
    }
    if (Object.keys(fe).length > 0 || bannerMissing.length > 0) {
      trackFunnelStep("sesizare-create", "validation-failed");
      setFieldErrors(fe);
      setError(bannerMissing.length > 0 ? `Completează: ${bannerMissing.join(", ")}` : null);
      const firstId = fe.descriere ? "descriere-input" : fe.locatie ? "locatie-input" : fe.nume ? "nume-input" : fe.adresa ? "adresa-input" : null;
      if (firstId && typeof document !== "undefined") {
        const el = document.getElementById(firstId);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => (el as HTMLElement | null)?.focus?.(), 300);
      } else if (bannerMissing.length > 0 && errorRef.current) {
        errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    setFieldErrors({});
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
          // Userul a editat manual textul → trimitem VERBATIM ce a scris +
          // flag (serverul sare regenerarea din template). Altfel, textul auto.
          formal_text: editedText != null ? editedText : formalTextForDb,
          formal_text_edited: editedText != null,
          custom_category: customCategory,
          custom_category_confidence: customCategoryConfidence,
          imagini,
          publica: data.publica,
          _honey: honey,
        }),
      });
      // 2026-05-29 — Defensive JSON parse. Daca serverul returneaza 500 cu
      // text/html (Vercel fallback page) sau 502/504 cu plain text, .json()
      // arunca „Unexpected token 'A'..." care era propagat in UI ca eroare
      // criptica. Acum verificam Content-Type si parsam safely.
      const ct = res.headers.get("content-type") || "";
      let json: { data?: { code: string }; error?: string } = {};
      if (ct.includes("application/json")) {
        json = await res.json().catch(() => ({}));
      } else {
        // Server-side error fara JSON. Citim textul ca sa il logam la Sentry
        // (via tracker) si afisam un mesaj user-friendly.
        const text = await res.text().catch(() => "");
        json = { error: text.slice(0, 200) || `Serverul a răspuns cu eroarea ${res.status}` };
      }
      if (!res.ok) {
        trackFunnelStep("sesizare-create", "error");
        throw new Error(
          json.error ||
            (res.status >= 500
              ? "Serverul întâmpină o problemă temporară. Te rugăm să reîncerci în câteva secunde."
              : "Trimiterea a eșuat. Reîncearcă te rog."),
        );
      }
      if (!json.data?.code) {
        throw new Error("Răspuns neașteptat de la server. Reîncearcă te rog.");
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
      announce(`Sesizare înregistrată cu succes. Codul tău este ${json.data.code.split("").join(" ")}`);
      trackFunnelStep("sesizare-create", "submitted", { hasPhotos: imagini.length > 0 ? 1 : 0 });
      // 2026-05-28 — Auto-trigger send-via-civia IMEDIAT pentru TOATĂ
      // lumea (logați + anonimi). User request: 1-click submit, nu doi.
      // Backend accept anonimi dacă sesizarea e < 24h vechime + rate
      // limit 5/h/IP. SuccessScreen are propriul auto-trigger care va
      // primi 409 already_sent + skip. Fire-and-forget.
      // 2026-06-14 FIX (raport 00071/00074 rămase „nou", netrimise): `keepalive`
      // — fără el, dacă userul închide pagina IMEDIAT după submit, browserul
      // ANULEAZĂ requestul în zbor → emailul nu mai pleacă → sesizare publică
      // blocată la „nou". keepalive face requestul să supraviețuiască unload-ului.
      void fetch(`/api/sesizari/${json.data.code}/send-via-civia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        keepalive: true,
      }).catch(() => { /* SuccessScreen retry-uiește */ });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Trimiterea a eșuat";
      setError(msg);
      // A11y: anunta eroarea asertiv (intrerupe screen reader)
      announce(`Eroare la trimitere: ${msg}`, "assertive");
    } finally {
      setSubmitting(false);
    }
  };

  const tipInfo = SESIZARE_TIPURI.find((t) => t.value === data.tip);
  const parkingCtx = useMemo(
    () =>
      data.tip === "parcare" && parkingJurisdiction
        ? { jurisdiction: parkingJurisdiction }
        : undefined,
    [data.tip, parkingJurisdiction],
  );
  // Bug fix user 5/22/2026 — recipients calculate doar daca avem semnal real
  // de locatie (text adresa SAU lat/lng SAU detectedCounty). Inainte, daca
  // user-ul alegea „stalpisori" fara sa fi pus inca adresa, recipients
  // afisa intregul stack de Bucuresti (PMB, ASPMB, BPR, PL Buc) ca default
  // — gresit pentru ceilalti cetateni din alte orase. Acum asteptam adresa.
  const hasLocationSignal =
    !!data.locatie?.trim() || (data.lat != null && data.lng != null) || !!detectedCounty;
  // 2026-05-26 — Fallback county DIN locatie text dacă reverse-geocode
  // nu a setat detectedCounty (user e pe /sesizari national, scrie
  // „Cluj-Napoca" în locatie). Mirror cu fix-ul server-side.
  // audit fix: memoizat — înainte effectiveCounty/recipients/previewText se
  // recalculau la FIECARE keystroke (getAuthoritiesFor string-matching + buildFormalText
  // construia tot emailul) pe componentul de 2184 linii → O(build email) per caracter.
  const effectiveCounty = useMemo(
    () => detectedCounty ?? (data.locatie ? detectCountyFromLocatie(data.locatie) : null),
    [detectedCounty, data.locatie],
  );
  const recipients = useMemo(
    () =>
      data.tip && hasLocationSignal
        ? getAuthoritiesFor(data.tip, data.sector, effectiveCounty, data.locatie, parkingCtx, data.descriere)
        : null,
    [data.tip, hasLocationSignal, data.sector, effectiveCounty, data.locatie, parkingCtx, data.descriere],
  );

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
  // 2026-06-08 — Mereu prin buildFormalText (tratează intern: parcare cu plăcuțe,
  // formal_text AI, sau fallback determinist generateFormalText). Înainte aveam un
  // template crud inline când AI n-a rulat încă → scria prost în preview
  // („am observat {tip} în această zonă. {text brut}").
  const previewText = useMemo(
    () =>
      buildFormalText({
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
      }),
    [data.tip, effectiveTitlu, data.locatie, data.sector, data.lat, data.lng, data.descriere,
     data.formal_text, data.nume, data.email, data.adresa, imagini, parkingPlateText,
     parkingJurisdiction, parkingObservedAt],
  );

  // Textul auto-generat, curățat de markerii [[BOLD]] (apar doar la parcare).
  const autoFormalText = previewText.replace(/\[\[\/?BOLD]]/g, "");
  // Ce se AFIȘEAZĂ în preview + în caseta editabilă + ce se TRIMITE: editarea
  // userului dacă a ajustat, altfel textul auto. O singură sursă de adevăr.
  const finalFormalText = editedText ?? autoFormalText;

  const mailtoLink = () => {
    if (!recipients) return "#";
    let subject = `Sesizare — ${tipInfo?.label ?? "problemă"} — ${data.locatie}`;
    if (data.tip === "parcare" && parkingPlateText) {
      subject = `Sesizare parcare neregulamentară — ${parkingPlateText} — ${data.locatie}`;
    }
    const to = recipients.primary.map((a) => a.email).join(",");
    const cc = recipients.cc.length > 0 ? `&cc=${recipients.cc.map((a) => a.email).join(",")}` : "";
    const body = finalFormalText;
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
            // 2026-06-14 (verify) — reset COMPLET al stării de editare text, altfel
            // a doua sesizare moștenea textul EDITAT manual al celei anterioare
            // (editedText + flag formal_text_edited → pleca textul greșit).
            setEditedText(null);
            setEditOpen(false);
            formalEditedRef.current = false;
            lastGenSigRef.current = "";
            setFieldErrors({});
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

  // 2026-06-14 — o singură coloană centrată (stil iOS/One UI). Previzualizarea
  // s-a mutat inline, chiar înainte de „Trimite" → nu mai e nevoie de panoul
  // lateral. Butonul nu mai e sticky.
  return (
    <div className="max-w-2xl mx-auto">
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
          <div className="px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-center gap-2.5 text-xs">
            <span aria-hidden className="shrink-0">📝</span>
            {/* Text SCURT — încape mereu pe un rând cu „Golește", nimic nu se
                taie (nici label, nici data). */}
            <p className="flex-1 min-w-0 text-[var(--color-text-muted)]">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">Ciornă</span> din {draftRestoredAt}
            </p>
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
                // reset complet al editării textului (vezi onAnother).
                setEditedText(null);
                setEditOpen(false);
                formalEditedRef.current = false;
                lastGenSigRef.current = "";
                setFieldErrors({});
              }}
              className="text-xs font-medium text-red-600 hover:text-red-700 shrink-0 h-8 px-2 inline-flex items-center underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-lg"
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
        <Field label="Descrie problema" error={fieldErrors.descriere}>
          <div className="relative">
            <textarea
              id="descriere-input"
              value={data.descriere}
              onChange={(e) => { update("descriere", e.target.value.slice(0, 2000)); clearFieldError("descriere"); }}
              rows={mode === "complet" ? 7 : 5}
              placeholder="Ex: Groapă pe trotuar la blocul H12"
              autoCapitalize="sentences"
              spellCheck
              // h-auto anulează h-11/sm:h-10 din inputClass (gândit pt. <input>
              // de o linie) — altfel pe mobil textarea se colapsa la ~44px.
              className={cn(inputClass, "h-auto sm:h-auto resize-y min-h-[120px] py-3 pr-12")}
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
          {/* 2026-06-14 — fără helper mereu-vizibil. Contorul apare DOAR aproape
              de limită. „minim 10" devine eroare pe câmp, doar la submit. */}
          {data.descriere.length >= 1600 && (
            <p className="text-xs mt-1 text-right tabular-nums font-medium text-amber-500">
              {data.descriere.length}/2000
            </p>
          )}
        </Field>

        {/* Textul oficial editabil s-a MUTAT jos, chiar înainte de „Trimite":
            previzualizare read-only + buton „Modifică textul". Vezi mai jos. */}

        <Field label="Tip problemă">
          {/* 5/22/2026 — tip nu mai e required. 2026-06-06: AI detectează tipul
              STRICT din DESCRIERE (text classifier), NU din poză. Dacă rămâne
              gol, backend setează „altele" + categoria se generează din
              text. Analytics arata 83% abandon era la step tip selection. */}
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
          </div>
          {tipDetectedByAI && !tipDetecting && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Tipul a fost detectat automat din descriere. Poți să-l schimbi dacă vrei altul.
            </p>
          )}
        </Field>

        {!recipients && data.tip && !hasLocationSignal && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 text-xs">
            <p className="text-amber-900 dark:text-amber-300 flex items-center gap-1">
              <Mail size={12} aria-hidden="true" /> Destinatarii se determină după ce introduci locația — adresă, oraș sau coordonate GPS.
            </p>
          </div>
        )}

        {recipients && (
          <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/70 p-3.5 text-xs">
            <p className="font-semibold text-blue-900 dark:text-blue-300 mb-2.5 flex items-center gap-1.5">
              <Mail size={13} aria-hidden="true" /> Ajunge la {recipients.primary.length + recipients.cc.length} {recipients.primary.length + recipients.cc.length === 1 ? "autoritate" : "autorități"}
            </p>
            <ul className="space-y-1.5">
              {[
                ...recipients.primary.map((a) => ({ a, cc: false })),
                ...recipients.cc.map((a) => ({ a, cc: true })),
              ].map(({ a, cc }) => (
                <li key={a.email} className="flex items-center justify-between gap-3 min-w-0">
                  <span className="font-medium text-blue-900 dark:text-blue-200 truncate">
                    {a.name}
                    {cc && <span className="ml-1.5 font-normal text-blue-500 dark:text-blue-400">· copie</span>}
                  </span>
                  <span className="shrink-0 max-w-[42%] truncate text-[10px] font-mono text-blue-600/60 dark:text-blue-400/60">
                    {a.email}
                  </span>
                </li>
              ))}
            </ul>
            {/* 2026-05-26 — Picker manual județ pentru destinatari greșiți.
                Dacă AI/regex a detectat greșit orașul, userul poate alege
                manual județul corect. Dropdown compact, doar listă scurtă. */}
            <details className="mt-3 pt-3 border-t border-blue-200/60 dark:border-blue-900/60">
              <summary className="cursor-pointer text-[11px] text-blue-700 dark:text-blue-400 hover:underline font-medium select-none">
                Destinatari greșiți? Schimbă județul manual ↓
              </summary>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <label
                  htmlFor="county-override"
                  className="text-[10px] text-blue-800 dark:text-blue-300 font-medium"
                >
                  Județ / Sector:
                </label>
                <select
                  id="county-override"
                  value={
                    // Dacă e București cu sector ales, afișăm "B-S1" etc.
                    detectedCounty === "B" && data.sector
                      ? `B-${data.sector}`
                      : (detectedCounty ?? "")
                  }
                  onChange={(e) => {
                    const val = e.target.value || null;
                    if (!val) {
                      setDetectedCounty(null);
                      setDetectedCountyName(null);
                      return;
                    }
                    // Format special pentru sectoare: "B-S1" .. "B-S6"
                    if (val.startsWith("B-S")) {
                      const sector = val.slice(2); // "S1".."S6"
                      const sectorNum = sector.slice(1); // "1".."6"
                      setDetectedCounty("B");
                      setDetectedCountyName(`Sector ${sectorNum}, București`);
                      setData((d) => ({ ...d, sector }));
                    } else {
                      const co = ALL_COUNTIES.find((c) => c.id === val);
                      setDetectedCounty(val);
                      setDetectedCountyName(co?.name ?? val);
                      // Resetăm sectorul dacă userul a ales alt județ
                      if (val !== "B") setData((d) => ({ ...d, sector: "" }));
                    }
                  }}
                  className="h-8 px-2 rounded-[var(--radius-xs)] bg-white dark:bg-blue-950 border border-blue-300 dark:border-blue-800 text-[11px] text-blue-900 dark:text-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <option value="">— Selectează —</option>
                  <optgroup label="București — Sectoare">
                    {[1,2,3,4,5,6].map((n) => (
                      <option key={`B-S${n}`} value={`B-S${n}`}>
                        Sector {n}, București
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Județe">
                    {ALL_COUNTIES.filter((c) => c.id !== "B").map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.id})
                      </option>
                    ))}
                  </optgroup>
                </select>
                {detectedCounty && (
                  <span className="text-[10px] text-blue-700 dark:text-blue-400">
                    Detectat: <strong>{detectedCountyName ?? detectedCounty}</strong>
                  </span>
                )}
              </div>
            </details>
          </div>
        )}

        {/* 2026-06-06 (audit #41) — prompt VIZIBIL de sector pentru București.
            Înainte picker-ul era îngropat într-un <details> colapsat → userul cu
            adresă în București nu era promptat și pica abia la validare. Acum:
            quick-pick S1-S6 amber, vizibil cât timp sectorul lipsește. */}
        {sectorRequired && !sectorValid && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 p-3">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
              <Locate size={13} aria-hidden="true" />
              Adresă în București — alege sectorul
            </p>
            <p className="text-[11px] text-amber-800/90 dark:text-amber-400/90 mt-1 mb-2">
              Fiecare sector are propria primărie. Alege-l ca sesizarea să ajungă la autoritatea corectă.
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  type="button"
                  key={`sect-${n}`}
                  onClick={() => {
                    setData((d) => ({ ...d, sector: `S${n}` }));
                    setDetectedCountyName(`Sector ${n}, București`);
                  }}
                  className="h-9 min-w-9 px-3 rounded-[var(--radius-button)] text-sm font-semibold bg-white dark:bg-amber-950 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900 hover:border-amber-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  aria-label={`Sector ${n}`}
                >
                  S{n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 5/23/2026 — Field „Titlu scurt (opțional)" scos. Se derivă oricum
            automat din tipLabel sau AI (vezi `effectiveTitlu` mai sus). User
            nu mai trebuie să-l completeze manual — era redundant. */}

        <Field label="Unde exact se află problema?" error={fieldErrors.locatie}>
          {/* Pe mobil: input adresă pe rândul lui (lățime completă pt. o adresă
              lungă), butoanele GPS/Pe hartă pe rândul de sub, cu etichete. */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                id="locatie-input"
                value={data.locatie}
                onChange={(e) => {
                  const val = e.target.value;
                  // User tastează → e sursa de adevăr: golim coords-urile vechi
                  // din GPS (locația lor reală vine din ce scriu/aleg) și căutăm.
                  setData((d) => ({ ...d, locatie: val, lat: null, lng: null }));
                  clearFieldError("locatie");
                  runAddressSearch(val);
                }}
                onFocus={() => { if (addrSugg.length) setShowSugg(true); }}
                onBlur={() => { setTimeout(() => setShowSugg(false), 150); }}
                placeholder="Scrie adresa: ex. Strada Novaci 12, București"
                autoComplete="off"
                role="combobox"
                aria-expanded={showSugg && addrSugg.length > 0}
                aria-autocomplete="list"
                className={cn(inputClass, "w-full")}
              />
              {addrLoading && (
                <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--color-text-muted)]" aria-hidden="true" />
              )}
              {showSugg && addrSugg.length > 0 && (
                <ul
                  role="listbox"
                  className="absolute z-40 left-0 right-0 top-[calc(100%+4px)] max-h-64 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-3)] py-1"
                >
                  {addrSugg.map((sg, i) => (
                    <li key={`${sg.lat}-${sg.lng}-${i}`} role="option" aria-selected={false}>
                      <button
                        type="button"
                        // onMouseDown (nu onClick) ca să ruleze ÎNAINTE de onBlur.
                        onMouseDown={(e) => { e.preventDefault(); pickSuggestion(sg); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-surface-2)] focus:bg-[var(--color-surface-2)] focus:outline-none flex items-start gap-2"
                      >
                        <MapIcon size={13} className="mt-0.5 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                        <span className="min-w-0">{sg.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={getLocation}
                disabled={geoLoading}
                className="flex-1 sm:flex-none shrink-0 h-11 px-3 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                aria-label={geoLoading ? "Se detectează locația" : "Folosește GPS-ul pentru a prinde locația actuală"}
                title="Folosește GPS-ul pentru a prinde locația actuală"
              >
                {geoLoading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Locate size={16} aria-hidden="true" />}
                <span className="tabular-nums">
                  {geoLoading
                    ? gpsAccuracy != null
                      ? `±${Math.round(gpsAccuracy)}m…`
                      : "Detectez…"
                    : "GPS"}
                </span>
              </button>
              {/* 2026-06-13 — Alternativă la GPS pentru cei care nu dau permisiune
                  browserului: alegi locația apăsând direct pe hartă. */}
              <button
                type="button"
                onClick={() => setMapPickerOpen(true)}
                className="flex-1 sm:flex-none shrink-0 h-11 px-3 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors flex items-center justify-center gap-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                aria-label="Alege locația pe hartă"
                title="Alege locația apăsând pe hartă (fără permisiune GPS)"
              >
                <MapIcon size={16} aria-hidden="true" />
                <span>Pe hartă</span>
              </button>
            </div>
          </div>
          {/* 2026-06-14 — fără helper lung, fără lat/long, fără „detectat
              automat" (cerere user: minimalism). Păstrăm DOAR confirmarea scurtă
              a județului dedus din text, ca userul să știe că ajunge unde trebuie. */}
          {!(data.lat && data.lng) && (() => {
            const txt = data.locatie?.trim() ?? "";
            const fromText = txt.length >= 4 ? detectCountyFromLocatie(txt) : null;
            if (!fromText) return null;
            const nm = ALL_COUNTIES.find((c) => c.id === fromText)?.name;
            return (
              <p className="mt-1.5 text-xs text-emerald-600 flex items-center gap-1">
                ✓ Trimitem către <span className="font-semibold">{fromText === "B" ? "București" : `județul ${nm}`}</span>
              </p>
            );
          })()}
        </Field>

        {mapPickerOpen && (
          <MapLocationPicker
            open
            onClose={() => setMapPickerOpen(false)}
            initialCenter={
              data.lat != null && data.lng != null
                ? [data.lat, data.lng]
                : (() => {
                    const c = ALL_COUNTIES.find((x) => x.id === detectedCounty)?.center;
                    return c ? [c[0], c[1]] : [BUCHAREST_CENTER[0], BUCHAREST_CENTER[1]];
                  })()
            }
            initialZoom={data.lat != null ? 16 : 13}
            onConfirm={(loc) => {
              setData((d) => ({
                ...d,
                locatie: loc.locatie,
                lat: loc.lat,
                lng: loc.lng,
                sector: loc.sector || d.sector,
              }));
              if (loc.countyCode) setDetectedCounty(loc.countyCode);
              if (loc.countyName) setDetectedCountyName(loc.countyName);
              if (loc.locality) setDetectedLocality(loc.locality);
              setGpsAccuracy(null);
            }}
          />
        )}

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
          <Field label="Fotografii">
            <PhotoUploader urls={imagini} onChange={setImagini} max={5} />
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              O poză apropiată + una de context.
            </p>
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
            Date de identificare
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mb-4 leading-relaxed">
            Apar în email, nu pe site. <strong>Rămân private.</strong>
          </p>
        </div>

        <Field label="Numele tău complet" error={fieldErrors.nume}>
          <input
            type="text"
            id="nume-input"
            autoComplete="name"
            autoCapitalize="words"
            value={data.nume}
            onChange={(e) => { update("nume", e.target.value); clearFieldError("nume"); }}
            onBlur={() => { if (data.nume) update("nume", capitalizeName(data.nume)); }}
            placeholder="Maria Popescu"
            className={inputClass}
          />
        </Field>

        <Field label="Adresa ta de domiciliu" error={fieldErrors.adresa}>
          <input
            type="text"
            id="adresa-input"
            autoComplete="street-address"
            autoCapitalize="words"
            value={data.adresa}
            onChange={(e) => { update("adresa", e.target.value); clearFieldError("adresa"); }}
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
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              <Sparkles size={11} className="text-purple-500" aria-hidden="true" />
              <span>Textul a fost rescris — apare în email și pe pagina publică.</span>
            </div>
            {/* Batch 2 UX (5/22/2026) — 3 quick-actions in loc de un singur
                buton „Regenerează". User poate refine fara sa goleasca tot. */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleAIImprove({ withPhotos: imagini.length > 0 })}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] text-[11px] font-medium text-[var(--color-text)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                title="Refac textul cu AI"
              >
                <Sparkles size={10} aria-hidden="true" />
                Refac
              </button>
              <button
                type="button"
                onClick={() => {
                  // Append hint to descriere ca AI sa scrie mai scurt
                  const shortHint = "\n\n[Cerere: scrie mai scurt, max 150 cuvinte]";
                  setData((d) => ({ ...d, descriere: d.descriere + shortHint }));
                  setTimeout(() => {
                    setData((d) => ({ ...d, descriere: d.descriere.replace(shortHint, "") }));
                    void handleAIImprove({ withPhotos: imagini.length > 0 });
                  }, 50);
                }}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] text-[11px] font-medium text-[var(--color-text)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                title="Genereaza varianta mai scurta"
              >
                Mai scurt
              </button>
              <button
                type="button"
                onClick={() => {
                  const urgencyHint = "\n\n[Cerere: adauga sense de urgenta, evidentiaza riscul pentru cetateni]";
                  setData((d) => ({ ...d, descriere: d.descriere + urgencyHint }));
                  setTimeout(() => {
                    setData((d) => ({ ...d, descriere: d.descriere.replace(urgencyHint, "") }));
                    void handleAIImprove({ withPhotos: imagini.length > 0 });
                  }, 50);
                }}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] text-[11px] font-medium text-[var(--color-text)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                title="Adauga ton de urgenta"
              >
                + Urgenta
              </button>
            </div>
          </div>
        ) : null}

        {/* 2026-06-14 — checkbox-ul „Publică pe Civia" scos: sesizarea apare
            oricum public (alții o pot vota / trimite). Notă scurtă de
            transparență (datele de identificare rămân private). */}

        {/* (blocul de eroare e randat o singură dată, lângă CTA mai jos.) */}

        {/* PREVIZUALIZARE + MODIFICĂ — exact ce se trimite, chiar înainte de
            „Trimite" (mutat aici din mijlocul formularului: review-before-send).
            Read-only by default; „Modifică textul" deschide editorul; editarea
            se trimite verbatim (flag formal_text_edited). */}
        {data.descriere.trim().length >= 10 && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/40 p-4">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-sm font-semibold inline-flex items-center gap-1.5">
                <Sparkles size={14} className="text-purple-500" aria-hidden="true" />
                Previzualizare
                {editedText != null && (
                  <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400">· modificat</span>
                )}
              </span>
              {editOpen ? (
                <div className="flex items-center gap-1.5">
                  {editedText != null && (
                    <button
                      type="button"
                      onClick={() => { setEditedText(null); formalEditedRef.current = false; lastGenSigRef.current = ""; void handleAIImprove({ withPhotos: imagini.length > 0 }); }}
                      disabled={aiLoading}
                      className="inline-flex items-center gap-1 h-11 sm:h-9 px-3.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-surface-2)] disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                      title="Aruncă modificările și regenerează cu AI"
                    >
                      {aiLoading ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Sparkles size={13} aria-hidden="true" />}
                      Resetează
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditOpen(false)}
                    className="inline-flex items-center gap-1 h-11 sm:h-9 px-5 rounded-full bg-[var(--color-primary)] text-white text-xs font-semibold hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-2)]"
                  >
                    Gata
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="inline-flex items-center gap-1.5 h-11 sm:h-9 px-4 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-semibold hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                >
                  <Pencil size={13} aria-hidden="true" /> Modifică textul
                </button>
              )}
            </div>
            {editOpen ? (
              <textarea
                id="formal-text-edit"
                value={finalFormalText}
                onChange={(e) => { setEditedText(e.target.value); formalEditedRef.current = true; }}
                rows={9}
                className={cn(inputClass, "h-auto sm:h-auto resize-y min-h-[220px] py-3 text-[13px] leading-relaxed rounded-xl")}
                aria-label="Textul oficial — editabil"
              />
            ) : (
              <div className="text-[13px] leading-relaxed text-[var(--color-text)] max-h-72 overflow-y-auto rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-3.5">
                {finalFormalText.split(/\n\n+/).map((paragraph, i) => (
                  <p key={i} className="mb-2.5 last:mb-0 whitespace-pre-line">{paragraph}</p>
                ))}
              </div>
            )}
            <p className="text-[11px] text-[var(--color-text-muted)] mt-2 leading-relaxed">
              Exact acest text ajunge la autorități (temei OG 27/2002). Apasă <strong>Modifică textul</strong> ca să scoți ce nu vrei sau să corectezi.
            </p>
          </div>
        )}

        {error && (
          <div ref={errorRef} role="alert" className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* CTA — buton rotund liquid-glass. NU mai e sticky (urmărea scroll-ul):
            stă în flow normal, unde e formularul. Gradient brand emerald→cyan +
            highlight inset + sheen la hover. */}
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          aria-busy={submitting}
          className="group relative w-full inline-flex items-center justify-center gap-2 h-[54px] rounded-full text-white font-semibold text-[15px] overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-cyan-700 transition-transform active:scale-[0.985] disabled:opacity-60 disabled:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
          style={{
            boxShadow:
              "0 12px 30px -10px color-mix(in srgb, var(--color-primary) 65%, transparent), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.18)",
          }}
        >
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-white/10" />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full motion-reduce:hidden transition-transform duration-700 ease-out"
            style={{ background: "linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.22) 50%, transparent 65%)" }}
          />
          {/* text-shadow garantează lizibilitatea albului pe toată lățimea gradientului (WCAG). */}
          <span className="relative inline-flex items-center gap-2" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}>
            {submitting ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
            {submitting ? "Se trimite…" : "Trimite sesizarea la autorități"}
          </span>
        </button>

        {/* Reasigurări — compacte, un singur rând discret. */}
        {!submitting && !submitted && (
          <div className="flex flex-col items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
            <p className="inline-flex items-center gap-x-1.5 flex-wrap justify-center text-center">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ Fără cont</span>
              <span aria-hidden="true" className="opacity-40">·</span>
              <span>100% gratuit</span>
              <span aria-hidden="true" className="opacity-40">·</span>
              <span>~90 sec</span>
              {!data.formal_text && !aiLoading && (
                <>
                  <span aria-hidden="true" className="opacity-40">·</span>
                  <span className="inline-flex items-center gap-1"><Sparkles size={10} className="text-purple-500" aria-hidden="true" /> AI scrie textul oficial</span>
                </>
              )}
            </p>
            {draftSavedAt && (
              <p className="inline-flex items-center gap-1 opacity-70">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                Salvat automat
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Field + inputClass extras în ./FormField.tsx (sprint 10). Importate ca
// aliases la topul fisierului (Field = FormField, inputClass = FORM_INPUT_CLASS).


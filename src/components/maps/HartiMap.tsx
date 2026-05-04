"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Bike, Footprints, Bus, Car, Wind, Layers, ChevronLeft, Locate, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { METRO_COLORS } from "@/lib/constants";
import { MapTopSwitcher, type SwitcherTab } from "./MapTopSwitcher";

// Metrorex București — 5 magistrale, 63 stații total (confirmat 2025)
const METRO_INFO = [
  { id: "M1", name: "Magistrala 1 (Galben)", stations: 22 },
  { id: "M2", name: "Magistrala 2 (Roșu)", stations: 14 },
  { id: "M3", name: "Magistrala 3 (Albastru)", stations: 4 },
  { id: "M4", name: "Magistrala 4 (Verde)", stations: 8 },
  { id: "M5", name: "Magistrala 5 (Maro)", stations: 12 },
];

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => (
    // Skeleton mai explicit — rage clicks pe `body` apăreau când user-ul
    // clickea pe zona goală a hărții, așteptând să se încarce. Acum vede
    // clar o hartă stilizată (grid SVG) + spinner + mesaj cu tip de
    // progres. Blocks clicks on body via absolute cover.
    <div className="relative w-full h-full bg-[var(--color-surface-2)] overflow-hidden rounded-[var(--radius-md)]">
      <svg
        className="absolute inset-0 w-full h-full opacity-30"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <pattern id="gridMap" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gridMap)" className="text-slate-400" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
        <div className="w-10 h-10 rounded-full border-4 border-[var(--color-primary)] border-t-transparent animate-spin" />
        <p className="text-sm font-medium text-[var(--color-text)]">
          Se încarcă harta...
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Primul request durează mai mult (tiles OpenStreetMap)
        </p>
      </div>
    </div>
  ),
});

const HartiLayers = dynamic(() => import("./HartiLayers"), { ssr: false });

type Tab = "bicicleta" | "pejos" | "auto" | "transport" | "aer";

// Top-center switcher tabs — tuned for tight horizontal pill.
const SWITCHER_TABS: ReadonlyArray<SwitcherTab<Tab>> = [
  { id: "bicicleta", label: "Bicicletă", icon: Bike },
  { id: "pejos", label: "Pietonale", icon: Footprints },
  { id: "auto", label: "Drumuri", icon: Car },
  { id: "transport", label: "Transport public", icon: Bus },
  { id: "aer", label: "Aer", icon: Wind },
];

// Per-tab canonical URLs — used for pushState when the user switches
// tabs so refreshes / shares preserve the selected layer.
const TAB_HREF: Record<Tab, string> = {
  bicicleta: "/harti/bicicleta",
  pejos: "/harti/pejos",
  auto: "/harti/cumasina",
  transport: "/harti/transport",
  aer: "/harti",
};

// Half-side (in degrees) of the county's bounding box used to clip the
// AQI heatmap. Bucharest is tight (~20km), other counties default to
// ~60km which covers Romania's largest counties. Tuned by eye on a few
// county centers; not GIS-precise.
const COUNTY_HALF_EXTENT: Record<string, number> = {
  B: 0.18,
  IF: 0.35,
  CT: 0.65,
  TM: 0.65,
  SV: 0.75,
  CJ: 0.6,
};
const DEFAULT_COUNTY_HALF_EXTENT = 0.55;

function boundsForCounty(
  center: [number, number],
  countySlug?: string,
): [[number, number], [number, number]] | undefined {
  if (!countySlug) return undefined;
  // ALL_COUNTIES uses uppercase id; the slug is lowercase — best-effort
  // map by uppercasing the slug. Falls back to the default extent.
  const key = countySlug.toUpperCase();
  const half = COUNTY_HALF_EXTENT[key] ?? DEFAULT_COUNTY_HALF_EXTENT;
  const [lat, lng] = center;
  return [
    [lat - half, lng - half * 1.5],
    [lat + half, lng + half * 1.5],
  ];
}

export function HartiMap({
  defaultTab = "bicicleta",
  center = [45.9432, 24.9668],
  zoom = 7,
  scopeName,
  countySlug,
}: {
  defaultTab?: Tab;
  /** Initial map center. Defaults to geographic center of România. */
  center?: [number, number];
  /** Initial zoom. 7 = whole country, 10-11 = county, 13 = city. */
  zoom?: number;
  /** Label shown in the sidebar header — e.g. "Cluj" renders
   *  "Piste biciclete · Cluj". The underlying GeoJSON is still
   *  Romania-wide; the viewport narrows what's displayed. */
  scopeName?: string;
  /** When set, nav tabs (Bicicletă / Pe jos / Cu mașina / Transport /
   *  Aer) prepend /{countySlug} so they stay within the county scope
   *  instead of kicking the user back to the Romania-wide view. The
   *  AQI heatmap is also clipped to the county's bounding box. */
  countySlug?: string;
} = {}) {
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  // Sidebar collapsed by default — the top-center switcher handles tab
  // selection, so the sidebar is now an *optional* details panel instead
  // of the primary nav. User opens it when they want filters or legend.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [mapStyle, setMapStyle] = useState<"standard" | "satelit">("standard");

  // Bicycle layer toggles — currently always-on (UI controls planned in v2)
  const showDedicate = true;
  const showMarcate = true;
  const showRecomandate = true;

  // Pe jos filters
  const [showParcuri, setShowParcuri] = useState(true);
  const [showPietonal, setShowPietonal] = useState(true);
  const showTraversari = true;

  // Transport
  const [visibleLines, setVisibleLines] = useState<string[]>(["M1", "M2", "M3", "M4", "M5"]);

  // Switcher → also push the canonical URL so refresh / share keeps the
  // active layer. Uses pushState (no SPA navigation) since HartiMap renders
  // the same component for every tab.
  const handleTabChange = (id: Tab) => {
    setActiveTab(id);
    const href = countySlug ? `/${countySlug}${TAB_HREF[id]}` : TAB_HREF[id];
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", href);
    }
  };

  // Locate
  const [flyTarget, setFlyTarget] = useState<{ coords: [number, number]; zoom?: number } | null>(null);
  const [locateLoading, setLocateLoading] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setLocateError("Geolocația nu e disponibilă");
      setTimeout(() => setLocateError(null), 3000);
      return;
    }
    setLocateLoading(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFlyTarget({ coords: [pos.coords.latitude, pos.coords.longitude], zoom: 16 });
        setLocateLoading(false);
      },
      (err) => {
        setLocateLoading(false);
        if (err.code === 1) setLocateError("Permisiune refuzată");
        else if (err.code === 2) setLocateError("Locație indisponibilă");
        else setLocateError("Timeout");
        setTimeout(() => setLocateError(null), 3000);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const toggleLine = (id: string) => {
    setVisibleLines((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex h-[calc(100vh-64px)] relative">
      {/* Sidebar */}
      <aside
        className={cn(
          "bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col transition-all duration-300 z-20",
          "absolute md:relative top-0 bottom-0 left-0",
          sidebarOpen ? "w-80" : "w-0 -ml-px overflow-hidden md:w-0"
        )}
      >
        {/* Sidebar header — just title + close. Tab nav lives in the
            top-center switcher overlay on the map (MapTopSwitcher). */}
        <div className="relative flex items-center justify-between border-b border-[var(--color-border)] shrink-0 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            Detalii hartă
          </p>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Ascunde panoul de detalii"
            className="h-8 w-8 rounded-full bg-[var(--color-surface-2)]/80 backdrop-blur-sm hover:bg-[var(--color-surface-2)] flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "bicicleta" && (
            <div>
              <SectionHeader
                icon={Bike}
                title="Cu bicicleta"
                scopeName={scopeName}
                source="OpenStreetMap · live"
              />
              <p className="text-sm text-[var(--color-text-muted)] mb-4 leading-relaxed">
                {scopeName
                  ? `Piste dedicate și benzi marcate pentru biciclete din ${scopeName}. Sursa: OpenStreetMap, contribuții colaborative.`
                  : "Piste dedicate și benzi marcate pentru biciclete din toată România. Date colaborative OpenStreetMap, actualizate de voluntari."}
              </p>
              <div className="space-y-2 mb-4">
                <Legend color="#059669" label="Pistă dedicată sau bandă marcată" />
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)] p-2.5 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] leading-relaxed">
                💡 Mărește (zoom 14+) la nivel de oraș ca să vezi rețeaua locală în detaliu.
              </p>
            </div>
          )}

          {activeTab === "pejos" && (
            <div>
              <SectionHeader
                icon={Footprints}
                title="Unde mergi pe jos"
                scopeName={scopeName}
                source="OpenStreetMap · live"
              />
              <p className="text-sm text-[var(--color-text-muted)] mb-4">
                {scopeName
                  ? `Parcuri, trotuare și zone pietonale din ${scopeName}. Trotuarele se încarcă în timp ce navighezi pe hartă.`
                  : "Parcuri din toată România plus trotuare și zone pietonale — trotuarele se încarcă live din OpenStreetMap pe zona vizibilă, ca să nu aștepți 20MB degeaba."}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mb-4 p-2 rounded-[6px] bg-[var(--color-surface-2)]">
                🔍 Mărește (zoom) la nivel de oraș ca să vezi trotuarele — se încarcă automat.
              </p>
              <div className="space-y-3 mb-5">
                <Toggle
                  label="Parcuri"
                  color="#10b981"
                  checked={showParcuri}
                  onChange={setShowParcuri}
                />
                <Toggle
                  label="Trotuare și zone pietonale"
                  color="#059669"
                  checked={showPietonal}
                  onChange={setShowPietonal}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <span className="w-4 h-1 rounded-full mt-2 shrink-0" style={{ background: "#059669" }} />
                  <p className="text-xs text-[var(--color-text-muted)]">Verde — accesibil public</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-4 h-1 rounded-full mt-2 shrink-0 border border-dashed border-red-500" style={{ background: "repeating-linear-gradient(90deg, #DC2626 0, #DC2626 2px, transparent 2px, transparent 4px)" }} />
                  <p className="text-xs text-[var(--color-text-muted)]">Roșu punctat — privat / restricționat</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "auto" && (
            <div>
              <SectionHeader
                icon={Car}
                title="Drumurile României"
                scopeName={scopeName}
                source="OpenStreetMap · 131.834 segmente"
              />
              <p className="text-sm text-[var(--color-text-muted)] mb-4">
                Toate autostrăzile, drumurile naționale, județene și comunale din țară, codificate cu culori după clasă.
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-1 rounded-full mt-2 shrink-0" style={{ background: "#DC2626" }} />
                  <div>
                    <p className="text-xs font-medium">Autostrăzi</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">A1, A2, A3, A10 — 3.328 segmente</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-1 rounded-full mt-2 shrink-0" style={{ background: "#F97316" }} />
                  <div>
                    <p className="text-xs font-medium">Drumuri naționale (trunk)</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">Drumuri expres, DN principale</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-1 rounded-full mt-2 shrink-0" style={{ background: "#EAB308" }} />
                  <div>
                    <p className="text-xs font-medium">Drumuri naționale (primary)</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">48.038 segmente DN</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-1 rounded-full mt-2 shrink-0" style={{ background: "#FBBF24" }} />
                  <div>
                    <p className="text-xs font-medium">Drumuri județene</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">43.509 segmente DJ</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-1 rounded-full mt-2 shrink-0" style={{ background: "#94A3B8" }} />
                  <div>
                    <p className="text-xs font-medium">Drumuri comunale</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">36.959 segmente DC</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-4">
                Click pe orice drum pentru a vedea numărul și numele.
              </p>
            </div>
          )}

          {activeTab === "transport" && (
            <div>
              <SectionHeader
                icon={Bus}
                title="Transport public"
                scopeName={scopeName}
                source="Metrorex + OpenStreetMap · live"
              />
              <p className="text-sm text-[var(--color-text-muted)] mb-4 leading-relaxed">
                Metroul bucureștean (5 magistrale, <strong>63 de stații</strong>),
                rețeaua de tramvai națională, liniile de troleibuz din toată
                țara și stații de autobuz — stațiile se încarcă pe măsură ce
                navighezi.
              </p>
              <div className="space-y-2 mb-5">
                {METRO_INFO.map((line) => {
                  const active = visibleLines.includes(line.id);
                  return (
                    <button
                      key={line.id}
                      onClick={() => toggleLine(line.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-[var(--radius-xs)] transition-all",
                        active
                          ? "bg-[var(--color-surface-2)]"
                          : "opacity-40 bg-[var(--color-surface-2)]"
                      )}
                    >
                      <span
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                        style={{ background: METRO_COLORS[line.id] }}
                      >
                        {line.id}
                      </span>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium">{line.name}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          ~{line.stations} stații
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "aer" && (
            <div>
              <SectionHeader
                icon={Wind}
                title="Calitatea aerului"
                scopeName={scopeName}
                source="OpenAQ + Sensor.Community · live"
              />
              <p className="text-sm text-[var(--color-text-muted)] mb-4 leading-relaxed">
                Senzori europeni de calitate a aerului în timp real — PM2.5, PM10, NO₂, O₃.
              </p>
              <div className="space-y-1.5 mb-4">
                <Legend color="#10B981" label="Bun (1–3) — fără riscuri" />
                <Legend color="#F59E0B" label="Moderat (4–6) — sensibilizați atenți" />
                <Legend color="#EF4444" label="Nesănătos (7–8) — limitează efortul" />
                <Legend color="#7F1D1D" label="Periculos (9–10) — evită exteriorul" />
              </div>
              <Link
                href={countySlug ? `/${countySlug}/aer` : "/aer"}
                className="block w-full text-center text-xs font-medium text-[var(--color-primary)] hover:underline mt-3"
              >
                Vezi pagina completă cu trenduri →
              </Link>
            </div>
          )}

        </div>

        {/* Footer — Întreruperi rămâne ca link extern; Aer e acum tab principal */}
        <div className="border-t border-[var(--color-border)] px-4 py-3 shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-2">
            Vezi și
          </p>
          <Link
            href={countySlug ? `/${countySlug}/intreruperi` : "/intreruperi"}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-xs)] text-xs font-medium text-[var(--color-text)] bg-[var(--color-surface-2)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          >
            <AlertTriangle size={13} aria-hidden="true" />
            Întreruperi gaze, apă, curent
          </Link>
        </div>
      </aside>

      {/* Open-sidebar button — vizibil doar când sidebar e închis.
          Când e deschis, close-ul este în header-ul sidebar-ului
          (top-right corner) ca să nu mai concureze cu tab-urile. */}
      {!sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="absolute top-4 left-0 z-30 h-10 w-10 rounded-r-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] border-l-0 flex items-center justify-center shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
          aria-label="Afișează meniul"
        >
          <ChevronLeft size={18} className="rotate-180" aria-hidden="true" />
        </button>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        <LeafletMap center={center} zoom={zoom} scrollWheelZoom flyToTarget={flyTarget} tileStyle={mapStyle}>
          <HartiLayers
            activeTab={activeTab}
            showDedicate={showDedicate}
            showMarcate={showMarcate}
            showRecomandate={showRecomandate}
            showParcuri={showParcuri}
            showPietonal={showPietonal}
            showTraversari={showTraversari}
            visibleLines={visibleLines}
            clipBounds={boundsForCounty(center, countySlug)}
            countyName={scopeName}
          />
        </LeafletMap>

        {/* Top-center floating switcher with sliding liquid-glass indicator */}
        <MapTopSwitcher tabs={SWITCHER_TABS} active={activeTab} onChange={handleTabChange} />

        {/* Map style switcher — pe mobile (sub md) afișează doar icon
            ca să nu se suprapună cu MapTopSwitcher centered top.
            Desktop păstrează „Straturi" label. */}
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={() => setLayersOpen(!layersOpen)}
            className="h-11 w-11 md:w-auto md:px-4 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center md:justify-start gap-2 text-sm font-medium shadow-md hover:bg-[var(--color-surface-2)] transition-colors"
            aria-label="Straturi"
            title="Straturi"
          >
            <Layers size={16} />
            <span className="hidden md:inline">Straturi</span>
          </button>
          {layersOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] shadow-xl p-2">
              <button
                onClick={() => { setMapStyle("standard"); setLayersOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-xs)] text-sm transition-colors",
                  mapStyle === "standard" ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-medium" : "hover:bg-[var(--color-surface-2)]"
                )}
              >
                🗺️ Standard
              </button>
              <button
                onClick={() => { setMapStyle("satelit"); setLayersOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-xs)] text-sm transition-colors",
                  mapStyle === "satelit" ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)] font-medium" : "hover:bg-[var(--color-surface-2)]"
                )}
              >
                🛰️ Satelit
              </button>
            </div>
          )}
        </div>

        {/* Locate button */}
        <button
          onClick={handleLocate}
          disabled={locateLoading}
          className="absolute bottom-24 right-4 z-20 h-11 w-11 rounded-[var(--radius-xs)] bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center shadow-md hover:bg-[var(--color-surface-2)] transition-colors disabled:opacity-60"
          title="Localizează-mă"
        >
          {locateLoading ? <Loader2 size={18} className="animate-spin" /> : <Locate size={18} />}
        </button>

        {locateError && (
          <div className="absolute bottom-40 right-4 z-20 px-3 py-2 rounded-[var(--radius-xs)] bg-red-500 text-white text-xs font-medium shadow-lg">
            {locateError}
          </div>
        )}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className="w-3 h-3 rounded-full mt-1 shrink-0 ring-2 ring-[var(--color-surface-2)]"
        style={{ background: color }}
        aria-hidden="true"
      />
      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{label}</p>
    </div>
  );
}

/**
 * Consistent header for each map-tab section in the Detalii sidebar.
 * Icon chip + title + (optional) county scope chip + (optional) data
 * source line. Replaced the per-section `<h3>` patchwork that was
 * inconsistent across tabs (some used dot separator, some bolded the
 * county, some nothing). One component = one look.
 */
function SectionHeader({
  icon: Icon,
  title,
  scopeName,
  source,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  scopeName?: string;
  source?: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-start gap-3">
        <span
          className="w-9 h-9 rounded-[var(--radius-xs)] bg-[var(--color-primary-soft)] text-[var(--color-primary)] grid place-items-center shrink-0 ring-1 ring-[var(--color-primary)]/15"
          aria-hidden="true"
        >
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-[family-name:var(--font-sora)] font-semibold text-[17px] leading-tight">
            {title}
          </h3>
          {scopeName && (
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              {scopeName}
            </span>
          )}
        </div>
      </div>
      {source && (
        <p className="text-[10px] uppercase tracking-wider font-medium text-[var(--color-text-muted)] mt-2 ml-12">
          {source}
        </p>
      )}
    </div>
  );
}

function Toggle({
  label,
  color,
  checked,
  onChange,
  count,
  dashed,
}: {
  label: string;
  color: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  count?: number;
  dashed?: boolean;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={cn(
          "w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0",
          checked ? "border-[var(--color-primary)] bg-[var(--color-primary)]" : "border-[var(--color-border)]"
        )}
      >
        {checked && (
          <svg viewBox="0 0 20 20" fill="white" className="w-3.5 h-3.5">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span
            className="w-6 h-0.5"
            style={{
              background: dashed ? undefined : color,
              borderTop: dashed ? `2px dashed ${color}` : undefined,
            }}
          />
          <span className="text-sm font-medium">{label}</span>
        </div>
      </div>
      {count !== undefined && (
        <span className="text-xs text-[var(--color-text-muted)]">{count}</span>
      )}
    </label>
  );
}

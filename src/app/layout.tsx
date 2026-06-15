import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import Script from "next/script";
import dynamic from "next/dynamic";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AuthModal } from "@/components/auth/AuthModal";
import { Navbar } from "@/components/layout/Navbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Footer } from "@/components/layout/Footer";
import { OrganizationJsonLd, WebsiteJsonLd } from "@/components/JsonLd";
import { CookieBanner } from "@/components/CookieBanner";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { AlertBanner } from "@/components/AlertBanner";
import { ConsentedAnalytics } from "@/components/ConsentedAnalytics";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ReferralSelfBridge } from "@/components/referral/ReferralSelfBridge";
import { NavProgress } from "@/components/NavProgress";
import { ScrollRestoration } from "@/components/ScrollRestoration";
import { DeferredClientMount } from "@/components/DeferredClientMount";
import { ToastProvider } from "@/components/Toast";
import { InstallPrompt } from "@/components/InstallPrompt";
import { NewsletterNudge } from "@/components/NewsletterNudge";
// AuroraBackground removed 5/22/2026 v5 — vezi globals.css `html` block.
import { CiviaAssistant } from "@/components/liquid-civic/CiviaAssistant";
// Code-split cold-path visuals — desktop-only hover effect + easter egg + splash.
// Saves ~5-7 KB gzip off the root bundle; mounts after hydration.
// 2026-05-24 Faza 2: FirstLoadSplash mutat din eager în dynamic (era ~3 KB
// în root bundle deși apare doar la prima vizită din lifetime).
const CursorGlow = dynamic(
  () => import("@/components/liquid-civic/CursorGlow").then((m) => m.CursorGlow),
);
const KonamiEasterEgg = dynamic(
  () => import("@/components/liquid-civic/KonamiEasterEgg").then((m) => m.KonamiEasterEgg),
);
const FirstLoadSplash = dynamic(
  () => import("@/components/liquid-civic/FirstLoadSplash").then((m) => m.FirstLoadSplash),
);
import { GlobalLiveAnnouncer } from "@/components/ui/LiveAnnouncer";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/constants";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  // 5/22/2026 — display: "optional" în loc de "swap" → elimină FOIT/FOUT.
  // Browser-ul folosește system font dacă custom-ul nu se încarcă în 100ms.
  // Zero layout shift după (vs `swap` care reflua text-ul când vine font-ul).
  display: "optional",
  weight: ["400", "500", "600", "700"],
  adjustFontFallback: true,
  preload: true,
});

const sora = Sora({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sora",
  display: "optional",
  weight: ["600", "700", "800"],
  adjustFontFallback: true,
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — Platforma civică a României`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  authors: [{ name: "Civia" }],
  creator: "Civia",
  publisher: "Civia",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "ro_RO",
    url: SITE_URL,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
  keywords: [
    "sesizări România",
    "petiții civice",
    "primăria București",
    "date publice",
    "calitate aer România",
    "întreruperi utilități",
    "Poliția Locală",
    "parcare ilegală",
    "civia.ro",
    "platformă civică",
  ],
  alternates: {
    canonical: SITE_URL,
    // Site is RO-only; declaring ro-RO + x-default helps Google pick the
    // right index for international searchers and prevents duplicate-URL
    // indexing when a user visits via www / non-www.
    languages: {
      "ro-RO": SITE_URL,
      "x-default": SITE_URL,
    },
  },
  // 5/22/2026 — verification meta pentru Search Console (Google) + Bing
  // Webmaster Tools + Yandex. Codes vin din env. DuckDuckGo nu cere
  // verification — folosește indexul Bing automat. Plausible deja config.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    yandex: process.env.YANDEX_VERIFICATION,
    other: {
      // Bing Webmaster Tools verification meta
      "msvalidate.01": process.env.BING_SITE_VERIFICATION ?? "",
      // Yahoo (uses Bing index, but separate verification supported)
      "y_key": process.env.YAHOO_SITE_VERIFICATION ?? "",
    },
  },
};

export const viewport = {
  // 2026-05-26 — light mode revine. themeColor răspunde la media query
  // (browser-ul alege automat funcție de OS preference). Boot-scriptul
  // din <head> rescrie meta-tagul dinamic când user-ul comută manual.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAFA" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  // viewport-fit=cover extends content into iOS safe areas (notch,
  // home indicator). Combined with env(safe-area-inset-*) in layout
  // CSS, the fixed bottom-right MobileFab stays clear of the home
  // indicator rather than being hidden behind it.
  viewportFit: "cover" as const,
  width: "device-width",
  initialScale: 1,
};

/**
 * Anti-flash boot script — rulează SYNCHRONOUS în <head> înainte ca
 * body-ul să paint-uiască. Citește localStorage["civia-theme"] și aplică
 * clasa `.dark` pe <html> dacă theme-ul rezultat e "dark". Asta previne
 * "flash of wrong mode" pe primul paint (cazul: user pe light mode →
 * vede 80ms de dark UI înainte ca React să hidrateze și să corecteze).
 *
 * IIFE compact pe o singură linie — minified e ~340 chars, nu impactează
 * TTFB. Try/catch întreg corpul în caz că localStorage e blocat
 * (Safari Private, embedded webview cu policy strict).
 */
const themeBootScript = `(function(){try{var s=localStorage.getItem('civia-theme');var d=s==='dark'||((s==='system'||!s)&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d)r.classList.add('dark');r.style.colorScheme=d?'dark':'light';}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ro"
      // 2026-05-26 — `dark` class scoasă din SSR. Boot script-ul din <head>
      // setează classul corect (light/dark) ÎNAINTE de prima paint, pe baza
      // localStorage["civia-theme"] sau preferinței OS. suppressHydration
      // necesar fiindcă boot-ul mutează className-ul înainte ca React să
      // se atașeze.
      className={`${inter.variable} ${sora.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Anti-flash theme boot — TREBUIE să fie primul element din <head>,
            blocking, SYNCHRONOUS. Dacă rulează cu întârziere (chunk deferred,
            async), user-ul pe light mode vede flash de dark pe primul paint. */}
        <script
          dangerouslySetInnerHTML={{ __html: themeBootScript }}
          suppressHydrationWarning
        />
        {/* 2026-05-25 OPTIMIZATION: resource hints TIGHT — păstrăm doar
            cele 3 critice (Supabase, Groq, Plausible). Scoase dns-prefetch
            pentru open-meteo/openaq/nominatim/tiles — folosite pe paginile
            specifice (weather, map) și browserul face DNS lookup oricum la
            fetch. -3 TCP connections init per page load. */}
        <link rel="preconnect" href="https://api.groq.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://plausible.io" />
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />
        <link rel="alternate" type="application/rss+xml" title="Sesizări Civia" href="/feed.xml" />
        <link rel="alternate" type="application/rss+xml" title="Întreruperi Civia" href="/intreruperi/rss" />
        <link rel="alternate" type="application/rss+xml" title="Știri Civia" href="/stiri-feed.xml" />
        <link rel="alternate" type="application/rss+xml" title="Proteste Civia" href="/proteste/feed.xml" />

        {/* ── iOS PWA meta tags ────────────────────────────────────────
            Safari doesn't read most of the W3C manifest; it relies on
            its own apple-mobile-web-app-* + apple-touch-* family.
            Without these, "Add to Home Screen" launches in a regular
            browser tab with the URL bar — defeats the whole PWA point.
        */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Civia" />
        {/* Disable iOS's auto-linkification of phone numbers — we
            already render proper tel: links where appropriate, and
            the auto-link mangles styling on numeric IDs (sesizare
            codes, statistics). */}
        <meta name="format-detection" content="telephone=no" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />
        <link rel="icon" href="/favicon-16.png" sizes="16x16" type="image/png" />
        {/* PWA manifest: NU declarat manual — Next 16 îl auto-injectează din
            app/manifest.ts (un singur <link rel="manifest">). Înainte exista și
            unul manual aici → 2× link de manifest în <head> (duplicat). */}
        {/* Mask icon for Safari pinned tabs — falls back to favicon
            if absent. We don't ship one yet; favicon-32 is fine. */}
        {/* Preload the #1 font weight used above the fold (hero) for faster
            LCP on the homepage + county pages. Next font already fingerprints
            it so cache hits are immediate. */}

        {/* audit fix (GDPR): analytics extern mutat în <ConsentedAnalytics> (body),
            gate pe consimțământul cookie. Nu se mai încarcă necontrolat. */}
      </head>
      <body
        // 2026-06-14 — padding-top e gestionat în globals.css (regulă plain,
        // responsivă: mobil = doar notch, desktop = 4rem navbar + notch). Aici
        // doar clearance JOS pt. bara flotantă BottomNav pe mobil (lg:pb-0).
        className="min-h-full flex flex-col pb-[calc(env(safe-area-inset-bottom,0px)+5rem)] lg:pb-0"
        // Mobile in-app browsers (Reddit App, Facebook, Instagram, X)
        // injectează clase/atribute la body în timpul hydratation. Plus
        // extensii (Grammarly, LastPass, MetaMask wallet, Dark Reader)
        // fac același lucru. Reezultat: 259 erori React #418 pe săptămână
        // (vezi /admin/analytics). suppressHydrationWarning pe body e
        // acceptat ca soluție pe site-uri publice cu trafic mobile.
        suppressHydrationWarning
      >
        <OrganizationJsonLd />
        <WebsiteJsonLd />
        <ConsentedAnalytics />
        {/* SW înregistrat devreme (nu deferred) — PWA detectabil de crawlere/Chrome */}
        <ServiceWorkerRegister />
        <NavProgress />
        <ScrollRestoration />
        {/* 5/22/2026 v5 — AuroraBackground scoasă complet. Userul a raportat
            persistent „cacat negru" peste bg din cauza spatiilor dintre blob-uri
            unde se vedea bg-ul solid. Acum: flat var(--color-bg) uniform. */}
        <CursorGlow />
        <FirstLoadSplash />
        <KonamiEasterEgg />
        {/* A11y: global screen reader announcer (always mounted, sr-only) */}
        <GlobalLiveAnnouncer />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[var(--z-toast)] focus:px-4 focus:py-2 focus:bg-[var(--color-primary)] focus:text-white focus:rounded-[var(--radius-xs)] focus:shadow-lg"
        >
          Sări la conținut
        </a>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              {/* Referral (Faza 1) — asigură cookie-ul propriu civia_rc pentru
                  share-uri cu ?ref=. Zero UI, doar pentru userii logați. */}
              <ReferralSelfBridge />
              <AlertBanner />
              <Navbar />
              <BottomNav />
              <main id="main-content" className="flex-1 flex flex-col">{children}</main>
              <Footer />
              {/* 2026-05-24 (P1.321) — banner ofline non-deferred, trebuie
                  vizibil instant când conexiunea pică, nu după idle. */}
              <OfflineIndicator />
              {/* Heavy interactive widgets — mount only after first paint + idle.
                  Shaves ~300ms off LCP on slow devices. */}
              <DeferredClientMount>
                <AuthModal />
                <CookieBanner />
                <InstallPrompt />
                <NewsletterNudge />
                {/* F1 Civia Assistant — AI civic chat (desktop floating button) */}
                <CiviaAssistant />
              </DeferredClientMount>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

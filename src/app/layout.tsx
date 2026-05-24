import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import Script from "next/script";
import dynamic from "next/dynamic";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AuthModal } from "@/components/auth/AuthModal";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { OrganizationJsonLd, WebsiteJsonLd } from "@/components/JsonLd";
import { CookieBanner } from "@/components/CookieBanner";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { AlertBanner } from "@/components/AlertBanner";
import { Analytics } from "@/components/Analytics";
import { NavProgress } from "@/components/NavProgress";
import { ScrollRestoration } from "@/components/ScrollRestoration";
import { DeferredClientMount } from "@/components/DeferredClientMount";
import { ToastProvider } from "@/components/Toast";
import { InstallPrompt } from "@/components/InstallPrompt";
import { MobileFab } from "@/components/layout/MobileFab";
import { BottomNav } from "@/components/layout/BottomNav";
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
  // 2026-05-19: defaultTheme=dark in ThemeProvider → fortam si themeColor
  // dark pentru ca chrome-ul browserului sa nu apara light pe useri OS-light
  // care intra prima oara pe site. Userii care comuta la light din /cont
  // primesc tot #0a0a0a pe chrome — minor (nu pot personaliza per user).
  themeColor: "#0a0a0a",
  // viewport-fit=cover extends content into iOS safe areas (notch,
  // home indicator). Combined with env(safe-area-inset-*) in layout
  // CSS, the fixed bottom-right MobileFab stays clear of the home
  // indicator rather than being hidden behind it.
  viewportFit: "cover" as const,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ro"
      // 5/22/2026 — dark forever. `dark` class direct pe SSR ca sa nu mai
      // existe „flash of light mode" pe primul paint inainte sa hidrateze
      // ThemeProvider. CSS-ul `.dark { --color-bg: ... }` se aplica imediat.
      className={`${inter.variable} ${sora.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://api.groq.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.open-meteo.com" />
        <link rel="dns-prefetch" href="https://api.openaq.org" />
        <link rel="dns-prefetch" href="https://plausible.io" />
        {/* Nominatim + OSM tiles are hit by every map page. Warming
            the DNS + TCP pool up-front shaves ~200ms off the first
            tile load on cold visits. */}
        <link rel="dns-prefetch" href="https://nominatim.openstreetmap.org" />
        <link rel="dns-prefetch" href="https://tile.openstreetmap.org" />
        {/* Overpass preconnect scos (5/12/2026) — folosea doar /harti, sters complet. */}
        {/* Supabase — every page that reads data hits this origin. */}
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
        {/* PWA manifest — declarat aici (in loc de metadata.manifest) ca sa
            controlam exact ordinea cu icon-urile + sw.js precache. */}
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* Mask icon for Safari pinned tabs — falls back to favicon
            if absent. We don't ship one yet; favicon-32 is fine. */}
        {/* Preload the #1 font weight used above the fold (hero) for faster
            LCP on the homepage + county pages. Next font already fingerprints
            it so cache hits are immediate. */}

        {/* External analytics — encarcat post-interactive ca sa nu intarzie LCP.
            CSP-ul din next.config.ts permite explicit acest origin in script-src
            si data-ingest in connect-src. */}
        <Script
          src="https://analytics-seven-steel.vercel.app/t.js#uWJsj_JcWfedSWt0uoVOIWetojpIX9xMbQ1foaQaorM"
          data-site="a1247f123f848a3d7d14783ed83806da889e89bcfc45582bbf2358e37a73c916"
          data-ingest="https://rhjfutxgmnkonichxpro.supabase.co/functions/v1"
          strategy="afterInteractive"
        />
      </head>
      <body
        className="min-h-full flex flex-col pt-16 pb-16 lg:pb-0"
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
        <Analytics />
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
              <AlertBanner />
              <Navbar />
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
                <MobileFab />
                <BottomNav />
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

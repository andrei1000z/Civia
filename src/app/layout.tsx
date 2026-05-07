import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import dynamic from "next/dynamic";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AuthModal } from "@/components/auth/AuthModal";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { OrganizationJsonLd, WebsiteJsonLd } from "@/components/JsonLd";
import { CookieBanner } from "@/components/CookieBanner";
import { AlertBanner } from "@/components/AlertBanner";
import { Analytics } from "@/components/Analytics";
import { NavProgress } from "@/components/NavProgress";
import { ScrollRestoration } from "@/components/ScrollRestoration";
import { DeferredClientMount } from "@/components/DeferredClientMount";
import { ToastProvider } from "@/components/Toast";
import { BackToTop } from "@/components/BackToTop";
import { InstallPrompt } from "@/components/InstallPrompt";
import { MobileFab } from "@/components/layout/MobileFab";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/constants";

// CivicAssistant FAB removed (3 messages in 1500 visits = 0.2% engagement
// per analytics). Search palette stays (genuine utility for power users).
const CommandPalette = dynamic(
  () => import("@/components/CommandPalette").then((m) => ({ default: m.CommandPalette }))
);

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700"],
  // adjustFontFallback reduce layout shift când font-ul custom se încarcă —
  // Next ajustează metricile font-ului fallback să fie aproape identice.
  adjustFontFallback: true,
  preload: true,
});

const sora = Sora({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sora",
  display: "swap",
  // 500 weight era inclus dar nefolosit nicăieri (verificat 2026-04-28).
  // Sora e font de display — folosit doar pentru titluri (font-bold +
  // font-extrabold). Drop 500 → ~10 KB savings la încărcare.
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
    "hărți civice",
    "primăria București",
    "date publice",
    "buget național",
    "transport public București",
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
};

export const viewport = {
  themeColor: [
    // Trebuie să se potrivească cu --color-bg din globals.css ca să nu apară
    // o linie de discontinuitate între chrome-ul browser-ului și body.
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ro"
      className={`${inter.variable} ${sora.variable} h-full antialiased`}
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
        {/* Overpass is the bottleneck for /harti at zoom >= 13 — preconnect
            so the first viewport fetch doesn't pay TLS handshake latency. */}
        <link rel="preconnect" href="https://overpass-api.de" crossOrigin="anonymous" />
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
        {/* Mask icon for Safari pinned tabs — falls back to favicon
            if absent. We don't ship one yet; favicon-32 is fine. */}
        {/* Preload the #1 font weight used above the fold (hero) for faster
            LCP on the homepage + county pages. Next font already fingerprints
            it so cache hits are immediate. */}

        {/* External analytics — encarcat post-interactive ca sa nu intarzie LCP.
            CSP-ul din next.config.ts permite explicit acest origin in script-src
            si data-ingest in connect-src. */}
        <Script
          src="https://analytics-seven-steel.vercel.app/t.js#UeLhse7h7fSdotsy8I_qB2yAv2aJIpr4Ubq6MpWbZTo"
          data-site="49cf0e6302707cc96eb99cef10e271b825c1874dc18e1a9e90dea27e6851f795"
          data-ingest="https://rhjfutxgmnkonichxpro.supabase.co"
          strategy="afterInteractive"
        />
      </head>
      <body
        className="min-h-full flex flex-col bg-[var(--color-bg)] pt-16"
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
              {/* Heavy interactive widgets — mount only after first paint + idle.
                  Shaves ~300ms off LCP on slow devices. */}
              <DeferredClientMount>
                <CommandPalette />
                <AuthModal />
                <CookieBanner />
                <BackToTop />
                <InstallPrompt />
                <MobileFab />
                <KeyboardShortcuts />
              </DeferredClientMount>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

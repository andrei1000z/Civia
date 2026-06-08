"use client";

import { useState, useEffect } from "react";
import Script from "next/script";
import { Analytics } from "@/components/Analytics";

const STORAGE_KEY = "civic_cookie_consent";

function readAnalyticsConsent(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    return (JSON.parse(raw) as { analytics?: boolean })?.analytics === true;
  } catch {
    return false;
  }
}

/**
 * 2026-06-08 (audit, GDPR/ePrivacy) — tracking-ul (analytics extern + Vercel
 * Analytics) rulează DOAR după consimțământul „analytics" din CookieBanner.
 * Înainte scripturile se încărcau necontrolat la fiecare pageview = consent-bypass.
 *
 * Ascultă `civic:cookie-consent:changed` ca să pornească trackingul imediat după
 * opt-in (fără reload). Returnează null până la consimțământ.
 */
export function ConsentedAnalytics() {
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    setConsent(readAnalyticsConsent());
    const onChange = () => setConsent(readAnalyticsConsent());
    window.addEventListener("civic:cookie-consent:changed", onChange);
    return () => window.removeEventListener("civic:cookie-consent:changed", onChange);
  }, []);

  if (!consent) return null;

  return (
    <>
      <Script
        src="https://analytics-seven-steel.vercel.app/t.js#uWJsj_JcWfedSWt0uoVOIWetojpIX9xMbQ1foaQaorM"
        data-site="a1247f123f848a3d7d14783ed83806da889e89bcfc45582bbf2358e37a73c916"
        data-ingest="https://rhjfutxgmnkonichxpro.supabase.co/functions/v1"
        strategy="afterInteractive"
      />
      <Analytics />
    </>
  );
}

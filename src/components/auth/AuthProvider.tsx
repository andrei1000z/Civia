"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
// 2026-05-27 — import prin wrapper (AGENTS.md). Type-only re-export OK.
import type { User, Session } from "@/lib/supabase/types";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type OAuthProvider = "google" | "apple";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string) => Promise<{ error: string | null }>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  openAuthModal: () => void;
  isAuthModalOpen: boolean;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowser();

    supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      setUser(data.user);
      setLoading(false);
      // Page-load cu sesiune existenta: onAuthStateChange NU mai aprinde
      // SIGNED_IN, deci hydratePreferences nu se executa de acolo. Trigger
      // manual aici daca avem user — singura cale ca tema/cookie/dismissed
      // sa sincronizeze cross-device pe revisit.
      if (data.user && typeof window !== "undefined") {
        import("@/lib/preferences/sync").then(({ hydratePreferences }) => {
          hydratePreferences().then((merged) => {
            window.dispatchEvent(new CustomEvent("civia:prefs-hydrated", { detail: merged }));
          });
        }).catch(() => { /* silent */ });
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
      setUser(session?.user ?? null);
      // Mirror Supabase auth events into analytics so the admin dashboard
      // can track signup / signin / signout counts. Fire-and-forget;
      // dynamic import avoids pulling the tracker onto the server bundle.
      if (typeof window !== "undefined") {
        import("@/components/analytics/CiviaTracker").then(({ trackAuthEvent }) => {
          if (event === "SIGNED_IN") trackAuthEvent("signin");
          else if (event === "SIGNED_OUT") trackAuthEvent("signout");
          else if (event === "PASSWORD_RECOVERY") trackAuthEvent("password-reset");
        }).catch(() => { /* silent */ });

        // Cross-device prefs sync: la SIGNED_IN, hydrateaza din DB + merge
        // cu localStorage + dispatch event ca toate consumatorii (ThemeProvider,
        // CookieBanner, NewsletterNudge) sa se re-citeasca.
        if (event === "SIGNED_IN") {
          import("@/lib/preferences/sync").then(({ hydratePreferences }) => {
            hydratePreferences().then((merged) => {
              window.dispatchEvent(new CustomEvent("civia:prefs-hydrated", { detail: merged }));
            });
          }).catch(() => { /* silent */ });
        }
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email: string) => {
    const supabase = createSupabaseBrowser();
    const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
    // Persist intended return URL so auth/callback redirects back here.
    const returnTo = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(returnTo)}`,
      },
    });
    // 2026-05-25 #11 — track magic-link initiation (auth funnel step
    // distinct de signin success — measures email sent vs verified).
    if (!error && typeof window !== "undefined") {
      import("@/components/analytics/CiviaTracker").then(({ trackCustomEvent }) => {
        trackCustomEvent("auth-magic-link-sent");
      }).catch(() => { /* silent */ });
    }
    return { error: error?.message ?? null };
  };

  const signInWithOAuth = async (provider: OAuthProvider) => {
    const supabase = createSupabaseBrowser();
    const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
    const returnTo = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(returnTo)}`,
      },
    });
    if (!error && typeof window !== "undefined") {
      import("@/components/analytics/CiviaTracker").then(({ trackCustomEvent }) => {
        trackCustomEvent("auth-oauth-initiated", { provider });
      }).catch(() => { /* silent */ });
    }
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    // Track înainte de actual signout — onAuthStateChange tracks
    // succesul, dar acest event capturează intent (clicked sign out).
    if (typeof window !== "undefined") {
      import("@/components/analytics/CiviaTracker").then(({ trackCustomEvent }) => {
        trackCustomEvent("auth-signout-clicked");
      }).catch(() => { /* silent */ });
    }
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithEmail,
        signInWithOAuth,
        signOut,
        openAuthModal: () => setAuthModalOpen(true),
        isAuthModalOpen,
        closeAuthModal: () => setAuthModalOpen(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

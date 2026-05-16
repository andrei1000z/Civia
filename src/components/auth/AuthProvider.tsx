"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
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
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
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

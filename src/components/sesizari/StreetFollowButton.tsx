"use client";

import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/Toast";

interface Props {
  /** Numele complet al locației (vom extrage primul segment ca „street"). */
  locatie: string;
  county: string;
}

/**
 * Buton „Urmărește această stradă" pe pagina sesizării. Folosește
 * `street_follows` RLS-aware API. Pentru useri ne-logați, redirect la login.
 *
 * Extragere stradă: prima virgulă a locației ne dă tipic „Strada X" / „Bd Y".
 * Lower-case la insert pentru ILIKE match consistent.
 */
export function StreetFollowButton({ locatie, county }: Props) {
  const { user, openAuthModal } = useAuth();
  const { toast } = useToast();
  const [following, setFollowing] = useState<string | null>(null); // ID dacă urmărit
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  const street = extractStreet(locatie);
  const streetNorm = street.toLowerCase();

  useEffect(() => {
    if (!user || !street) return;
    let cancelled = false;
    fetch("/api/streets/follow")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const match = (j.data as Array<{ id: string; street: string; county: string }> | undefined)?.find(
          (f) => f.street === streetNorm && f.county === county.toLowerCase(),
        );
        setFollowing(match?.id ?? null);
        setChecked(true);
      })
      .catch(() => !cancelled && setChecked(true));
    return () => {
      cancelled = true;
    };
  }, [user, street, streetNorm, county]);

  if (!street) return null; // locație fără stradă identificabilă

  const onClick = async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    setLoading(true);
    try {
      if (following) {
        // unfollow
        const res = await fetch(`/api/streets/unfollow/${following}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Eroare la unfollow");
        setFollowing(null);
        toast("Nu mai urmărești această stradă", "success");
      } else {
        const res = await fetch("/api/streets/follow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ street: streetNorm, county: county.toLowerCase() }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "Eroare");
        setFollowing(j.data?.id ?? "new");
        toast(`Urmărești „${street}". Primești notificări pentru sesizări noi pe această stradă.`, "success");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || !checked}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-pill)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-surface)] hover:border-[var(--color-primary)]/40 disabled:opacity-60 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      title={following ? `Renunță la urmărirea „${street}"` : `Primește notificări pentru sesizări noi pe „${street}"`}
    >
      {loading ? (
        <Loader2 size={11} className="animate-spin" aria-hidden="true" />
      ) : following ? (
        <BookmarkCheck size={11} className="text-[var(--color-primary)]" aria-hidden="true" />
      ) : (
        <Bookmark size={11} aria-hidden="true" />
      )}
      <span>{following ? `Urmărești ${street}` : `Urmărește ${street}`}</span>
    </button>
  );
}

/** Extrage „Strada X" sau primul segment relevant din locație. */
function extractStreet(locatie: string): string {
  if (!locatie) return "";
  // Locația tipică: „Strada Lizeanu, Sector 2" sau „Bd. Magheru 12, Sector 1"
  // Luăm primul segment până la prima virgulă, eliminăm numerele.
  const firstSegment = locatie.split(",")[0]?.trim() ?? locatie;
  // Curățăm numărul la final dacă există: „Strada Lizeanu 12" → „Strada Lizeanu"
  return firstSegment.replace(/\s+\d+[a-z]?$/i, "").trim();
}

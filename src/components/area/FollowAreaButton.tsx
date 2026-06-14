"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Check, Loader2, Bell } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/Toast";

/**
 * „Urmărește zona" (Faza 2) — toggle abonare la o arie (DB, NU push device).
 *
 * GDPR: consimțământul e EXPLICIT — la prima abonare arătăm o linie de consimțământ
 * și trimitem consent:true. Userul anonim e redirecționat la login. Starea inițială
 * se determină printr-un GET la /api/area/follow (abonările proprii).
 */
export function FollowAreaButton({
  county,
  countyName,
  locality,
  source = "county_page",
  size = "md",
}: {
  county: string;
  countyName: string;
  locality?: string | null;
  source?: "county_page" | "sesizari_publice" | "cont" | "web";
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [following, setFollowing] = useState(false);
  const [subId, setSubId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const areaName = locality ? (county === "B" ? locality : `${locality}, ${countyName}`) : countyName;

  // Determină starea curentă (abonat?) pentru userul logat.
  useEffect(() => {
    if (!user) {
      setReady(true);
      return;
    }
    let cancelled = false;
    fetch("/api/area/follow")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { subscriptions?: Array<{ id: string; county: string; locality: string | null }> } | null) => {
        if (cancelled || !json?.subscriptions) {
          setReady(true);
          return;
        }
        const match = json.subscriptions.find(
          (s) => s.county === county && (s.locality ?? null) === (locality ?? null),
        );
        if (match) {
          setFollowing(true);
          setSubId(match.id);
        }
        setReady(true);
      })
      .catch(() => setReady(true));
    return () => {
      cancelled = true;
    };
  }, [user, county, locality]);

  async function toggle() {
    if (!user) {
      router.push(`/cont?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setBusy(true);
    try {
      if (following && subId) {
        const res = await fetch(`/api/area/follow?id=${subId}`, { method: "DELETE" });
        if (res.ok) {
          setFollowing(false);
          setSubId(null);
          toast(`Nu mai urmărești ${areaName}`, "success", 2500);
        } else {
          toast("Nu am putut dezabona", "error");
        }
      } else {
        const res = await fetch("/api/area/follow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ county, locality: locality ?? null, consent: true, source }),
        });
        const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
        if (res.ok && json.id) {
          setFollowing(true);
          setSubId(json.id);
          toast(`Urmărești ${areaName} — primești digestul săptămânal`, "success", 3500);
        } else {
          toast(json.error ?? "Nu am putut abona", "error");
        }
      }
    } catch {
      toast("Eroare de rețea", "error");
    } finally {
      setBusy(false);
    }
  }

  const h = size === "sm" ? "h-9 text-xs px-3" : "h-10 text-sm px-4";
  const icon = size === "sm" ? 13 : 15;

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy || !ready}
        aria-pressed={following}
        className={`inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-full)] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 disabled:opacity-60 ${h} ${
          following
            ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-on-soft)] hover:bg-[var(--color-border)]"
            : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"
        }`}
      >
        {busy ? (
          <Loader2 size={icon} className="animate-spin" aria-hidden="true" />
        ) : following ? (
          <Check size={icon} aria-hidden="true" />
        ) : (
          <MapPin size={icon} aria-hidden="true" />
        )}
        {following ? `Urmărești ${areaName}` : `Urmărește ${areaName}`}
      </button>
      {!following && ready && (
        <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] px-1">
          <Bell size={9} aria-hidden="true" />
          Digest săptămânal: sesizări noi, rezolvate, întreruperi. Te poți dezabona oricând.
        </span>
      )}
    </div>
  );
}

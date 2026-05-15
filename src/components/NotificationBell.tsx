"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, MessageCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: "comment" | "status" | "verify";
  sesizareCode: string;
  sesizareTitle: string;
  message: string;
  createdAt: string;
  read: boolean;
}

const STORAGE_KEY = "civia:notifications";
const LAST_SEEN_KEY = "civia:notifications:lastSeen";
const MAX_STORED = 30;

function loadStored(): Notification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Notification[];
  } catch {
    return [];
  }
}

function saveStored(notifs: Notification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs.slice(0, MAX_STORED)));
  } catch {
    /* quota ignored */
  }
}

export function NotificationBell() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const addNotification = useCallback((n: Notification) => {
    setNotifs((prev) => {
      const next = [n, ...prev].slice(0, MAX_STORED);
      saveStored(next);
      return next;
    });
    setUnread((u) => u + 1);
  }, []);

  // Hydrate from localStorage on mount — setState aici e singura cale,
  // localStorage nu există pe server.
  useEffect(() => {
    const stored = loadStored();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotifs(stored);
    const lastSeen = Number(localStorage.getItem(LAST_SEEN_KEY) ?? "0");
    setUnread(stored.filter((n) => new Date(n.createdAt).getTime() > lastSeen).length);
  }, []);

  // Subscribe to realtime events once user is loaded.
  //
  // Two groups of watched IDs:
  //  1. "followed"  — sesizari the user clicked Follow on → comments + timeline changes
  //  2. "owned"     — sesizari the user authored → votes, verifications, moderation status
  //
  // Both groups merge into a single realtime channel with distinct filters.
  useEffect(() => {
    if (!user) return;
    const supabase = createSupabaseBrowser();

    async function init() {
      const [followsRes, ownedRes] = await Promise.all([
        supabase.from("sesizare_follows").select("sesizare_id").eq("user_id", user!.id),
        supabase.from("sesizari").select("id").eq("user_id", user!.id).limit(200),
      ]);
      const followedIds = (followsRes.data ?? []).map((f: { sesizare_id: string }) => f.sesizare_id);
      const ownedIds = (ownedRes.data ?? []).map((s: { id: string }) => s.id);

      // Union for timeline (both owners and followers want status updates)
      const timelineIds = Array.from(new Set([...followedIds, ...ownedIds]));
      if (timelineIds.length === 0 && ownedIds.length === 0) return () => {};

      async function lookupSesizare(id: string) {
        const { data } = await supabase
          .from("sesizari")
          .select("code, titlu")
          .eq("id", id)
          .maybeSingle();
        return data as { code: string; titlu: string } | null;
      }

      // Channel name unique per mount — altfel Strict Mode + remount
      // re-folosesc același channel name, second init găsește channel-ul
      // deja subscribed și .on() aruncă „cannot add postgres_changes after
      // subscribe()". Crypto.randomUUID() e safe pe browser modern.
      const channelName = `notifications-${user!.id}-${typeof crypto !== "undefined" ? crypto.randomUUID().slice(0, 8) : Date.now()}`;
      const channel = supabase.channel(channelName);

      // Comments — on followed sesizari
      if (followedIds.length > 0) {
        channel.on(
          "postgres_changes" as never,
          {
            event: "INSERT",
            schema: "public",
            table: "sesizare_comments",
            filter: `sesizare_id=in.(${followedIds.join(",")})`,
          },
          async (payload: { new: { sesizare_id: string; body: string; author_name: string } }) => {
            const sez = await lookupSesizare(payload.new.sesizare_id);
            if (!sez) return;
            addNotification({
              id: `c-${Date.now()}-${Math.random()}`,
              type: "comment",
              sesizareCode: sez.code,
              sesizareTitle: sez.titlu,
              message: `${payload.new.author_name}: ${payload.new.body.slice(0, 60)}`,
              createdAt: new Date().toISOString(),
              read: false,
            });
          }
        );
      }

      // Timeline (status change) — on any followed OR owned sesizare
      if (timelineIds.length > 0) {
        channel.on(
          "postgres_changes" as never,
          {
            event: "INSERT",
            schema: "public",
            table: "sesizare_timeline",
            filter: `sesizare_id=in.(${timelineIds.join(",")})`,
          },
          async (payload: { new: { sesizare_id: string; event_type: string; description: string } }) => {
            const sez = await lookupSesizare(payload.new.sesizare_id);
            if (!sez) return;
            addNotification({
              id: `t-${Date.now()}-${Math.random()}`,
              type: "status",
              sesizareCode: sez.code,
              sesizareTitle: sez.titlu,
              message: payload.new.description,
              createdAt: new Date().toISOString(),
              read: false,
            });
          }
        );
      }

      // Votes — on sesizari owned by the user (someone voted on my sesizare)
      if (ownedIds.length > 0) {
        channel.on(
          "postgres_changes" as never,
          {
            event: "INSERT",
            schema: "public",
            table: "sesizare_votes",
            filter: `sesizare_id=in.(${ownedIds.join(",")})`,
          },
          async (payload: { new: { sesizare_id: string; value: number; user_id: string | null } }) => {
            // Nu notificăm pe user-ul însuși când dă like la propria sesizare —
            // raportat 2026-05-13: „dacă imi dau like singur îmi apare notificare".
            if (payload.new.user_id && payload.new.user_id === user!.id) return;
            const sez = await lookupSesizare(payload.new.sesizare_id);
            if (!sez) return;
            const isUp = payload.new.value > 0;
            addNotification({
              id: `v-${Date.now()}-${Math.random()}`,
              type: "comment", // reuse icon category
              sesizareCode: sez.code,
              sesizareTitle: sez.titlu,
              message: isUp ? "Cineva a votat ▲ sesizarea ta" : "Cineva a votat ▼ sesizarea ta",
              createdAt: new Date().toISOString(),
              read: false,
            });
          }
        );

        // Verifications — on owned sesizari
        channel.on(
          "postgres_changes" as never,
          {
            event: "INSERT",
            schema: "public",
            table: "sesizare_verifications",
            filter: `sesizare_id=in.(${ownedIds.join(",")})`,
          },
          async (payload: { new: { sesizare_id: string; agrees: boolean; user_id: string | null } }) => {
            if (payload.new.user_id && payload.new.user_id === user!.id) return;
            const sez = await lookupSesizare(payload.new.sesizare_id);
            if (!sez) return;
            addNotification({
              id: `vf-${Date.now()}-${Math.random()}`,
              type: "verify",
              sesizareCode: sez.code,
              sesizareTitle: sez.titlu,
              message: payload.new.agrees
                ? "Un cetățean a confirmat rezolvarea sesizării tale"
                : "Un cetățean a contestat rezolvarea sesizării tale",
              createdAt: new Date().toISOString(),
              read: false,
            });
          }
        );

        // Moderation status change — on owned sesizari
        channel.on(
          "postgres_changes" as never,
          {
            event: "UPDATE",
            schema: "public",
            table: "sesizari",
            filter: `id=in.(${ownedIds.join(",")})`,
          },
          async (payload: { new: { id: string; code: string; titlu: string; moderation_status: string; status: string } }) => {
            const newMod = payload.new.moderation_status;
            if (newMod !== "approved" && newMod !== "rejected") return;
            addNotification({
              id: `m-${Date.now()}-${Math.random()}`,
              type: "status",
              sesizareCode: payload.new.code,
              sesizareTitle: payload.new.titlu,
              message:
                newMod === "approved"
                  ? "Sesizarea ta a fost aprobată și e acum publică"
                  : "Sesizarea ta a fost respinsă la moderare",
              createdAt: new Date().toISOString(),
              read: false,
            });
          }
        );
      }

      channel.subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const cleanup = init();
    return () => {
      cleanup.then((fn) => fn?.());
    };
  }, [user, addNotification]);

  // Close dropdown on outside click + Escape (a11y)
  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleOpen() {
    setOpen((v) => !v);
    if (!open) {
      // Mark all as seen when opening
      localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
      setUnread(0);
    }
  }

  function clearAll() {
    setNotifs([]);
    saveStored([]);
    setUnread(0);
    setOpen(false);
  }

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleOpen}
        className="relative w-11 h-11 sm:w-9 sm:h-9 inline-flex items-center justify-center rounded-full hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        aria-label={unread > 0 ? `Notificări (${unread} necitite)` : "Notificări"}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
            aria-hidden="true"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          // max-w-[calc(100vw-1rem)] previne clip-ul pe viewport mic
          // (~640-768px) cand bell-ul e langa edge-ul drept. ShareMenu
          // are deja fix-ul echivalent prin direction smart.
          className="fixed sm:absolute top-16 sm:top-auto left-2 right-2 sm:left-auto sm:right-0 sm:mt-2 sm:w-80 sm:max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-5rem)] sm:max-h-[480px] overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-xl z-50 flex flex-col"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <div className="text-sm font-semibold">Ce s-a mișcat</div>
            {notifs.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded px-1"
              >
                Marchează toate ca citite
              </button>
            )}
          </div>

          {notifs.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
              <Bell size={28} className="mx-auto mb-2 opacity-40" />
              <p className="font-medium">Totul e liniștit aici</p>
              <div className="text-xs mt-2">
                Urmărește sesizările care te interesează și îți dăm semn când primăria răspunde sau când ceva se mișcă.
              </div>
            </div>
          ) : (
            <div className="overflow-y-auto">
              {notifs.map((n) => (
                <Link
                  key={n.id}
                  href={`/sesizari/${n.sesizareCode}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex gap-3 px-4 py-3 hover:bg-[var(--color-surface-2)] border-b border-[var(--color-border)] last:border-b-0 transition-colors",
                    !n.read && "bg-[var(--color-primary-soft)]/30"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 shrink-0 rounded-full flex items-center justify-center",
                      n.type === "comment" && "bg-blue-100 text-blue-700",
                      n.type === "status" && "bg-emerald-100 text-emerald-700",
                      n.type === "verify" && "bg-amber-100 text-amber-700"
                    )}
                  >
                    {n.type === "comment" ? <MessageCircle size={16} /> : <CheckCircle2 size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold line-clamp-1">{n.sesizareTitle}</div>
                    <div className="text-xs text-[var(--color-text-muted)] line-clamp-2 mt-0.5">
                      {n.message}
                    </div>
                    <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
                      {relativeTime(n.createdAt)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "chiar acum";
  if (mins < 60) return `acum ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `acum ${hrs} h`;
  const days = Math.round(hrs / 24);
  return `acum ${days} z`;
}

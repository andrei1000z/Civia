"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: "status";
  sesizareCode: string;
  sesizareTitle: string;
  message: string;
  createdAt: string;
  read: boolean;
}

// 2026-05-25 — STORAGE_KEY bump la v2 ca să șteargă notificările vechi
// (clean slate per cerere user — „ștergere tot legat de notificări"). Versiunea
// nouă persistă DOAR status changes scurte cu emoji, nu mai are noise.
const STORAGE_KEY = "civia:notifications:v2";
const LAST_SEEN_KEY = "civia:notifications:v2:lastSeen";
const MAX_STORED = 30;

// Mapare status sesizare → emoji + mesaj scurt (max 35 chars).
// Folosit la status change events din timeline.
const STATUS_NOTIFICATION: Record<string, { emoji: string; label: string }> = {
  inregistrata: { emoji: "📨", label: "Înregistrată" },
  trimis: { emoji: "📤", label: "Trimisă către autorități" },
  "in-lucru": { emoji: "🛠️", label: "În lucru la autoritate" },
  "actiune-autoritate": { emoji: "🛠️", label: "În lucru la autoritate" },
  interventie: { emoji: "🚧", label: "Intervenție pe teren" },
  rezolvat: { emoji: "✅", label: "Rezolvată" },
  redirectionata: { emoji: "↪️", label: "Redirecționată" },
  amanata: { emoji: "⏸️", label: "Amânată" },
  respins: { emoji: "⚠️", label: "Respinsă de autoritate" },
};

/**
 * Extrage status-ul dintr-o descriere timeline. Formatul standard generat de
 * trigger DB e „Status actualizat la: <status>" — match pe ultimul cuvânt.
 * Returnează null dacă nu e un status change recognizable.
 */
function parseStatusFromDescription(description: string): string | null {
  const m = description.match(/Status actualizat la:?\s*(\S+)/i);
  if (m?.[1]) {
    const key = m[1].toLowerCase().replace(/[^\w-]/g, "");
    if (key in STATUS_NOTIFICATION) return key;
  }
  return null;
}

/**
 * Extrage hint scurt de locație din titlu („Mașini parcate pe trotuar..." →
 * „stâlpișori..."). Folosit ca să user știe care sesizare e — primele 3 cuvinte
 * relevante, max 40 chars.
 */
function titleHint(title: string): string {
  return title.slice(0, 45) + (title.length > 45 ? "…" : "");
}

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
      // Dedupe (5/21/2026): daca acelasi tip+code+message a venit in
      // ultimele 60s, NU mai adaugam. Cauzeaza spam la rollback-uri
      // de status sau retry-uri server-side (raportat user).
      const dedupeWindow = 60_000;
      const isDuplicate = prev.some((p) =>
        p.sesizareCode === n.sesizareCode &&
        p.type === n.type &&
        p.message === n.message &&
        new Date(n.createdAt).getTime() - new Date(p.createdAt).getTime() < dedupeWindow,
      );
      if (isDuplicate) return prev;
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
      // 2026-05-25 — cosigners (cei care au „trimis și ei" sesizarea) primesc
      // și ei notificările de status change. Triplu fetch în paralel.
      const [followsRes, ownedRes, cosignsRes] = await Promise.all([
        supabase.from("sesizare_follows").select("sesizare_id").eq("user_id", user!.id),
        supabase.from("sesizari").select("id").eq("user_id", user!.id).limit(200),
        supabase.from("sesizare_cosigners").select("sesizare_id").eq("user_id", user!.id).limit(200),
      ]);
      const followedIds = (followsRes.data ?? []).map((f: { sesizare_id: string }) => f.sesizare_id);
      const ownedIds = (ownedRes.data ?? []).map((s: { id: string }) => s.id);
      const cosignedIds = (cosignsRes.data ?? []).map((c: { sesizare_id: string }) => c.sesizare_id);

      // Union: status updates pe toate trei (owner + followed + cosigner).
      const timelineIds = Array.from(new Set([...followedIds, ...ownedIds, ...cosignedIds]));
      if (timelineIds.length === 0) return () => {};

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

      // 2026-05-25 — RADICAL SIMPLIFICATION (user cerere):
      //
      // Notificările afișau prea multă noise (comments, votes, moderation,
      // verifications) și mesaje greșite („aprobată și publică" la status
      // change real). Scoase TOATE channels în afară de status change
      // pe timeline, cu copy scurt + emoji per status real.
      //
      // Activează pe AMBELE seturi (followed + owned) — și autorul și
      // cosignerii (care urmăresc) primesc notificarea.
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
            // Doar status change events (event_type matches keys din map sau
            // descrierea conține „Status actualizat la"). Restul (depusa,
            // cosemnat, delivery_problem, raspuns_oficial) SKIP.
            const statusKey =
              payload.new.event_type in STATUS_NOTIFICATION
                ? payload.new.event_type
                : parseStatusFromDescription(payload.new.description);
            if (!statusKey) return;

            const sez = await lookupSesizare(payload.new.sesizare_id);
            if (!sez) return;
            const tone = STATUS_NOTIFICATION[statusKey];
            if (!tone) return;
            addNotification({
              id: `s-${Date.now()}-${Math.random()}`,
              type: "status",
              sesizareCode: sez.code,
              sesizareTitle: sez.titlu,
              message: `${tone.emoji} ${tone.label} · ${titleHint(sez.titlu)}`,
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
                  <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <CheckCircle2 size={16} />
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

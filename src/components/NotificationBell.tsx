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
  /** status key (rezolvat/in-lucru/respins/...) → icon + culoare type-aware. */
  status?: string;
  sesizareCode: string;
  sesizareTitle: string;
  message: string;
  createdAt: string;
  read: boolean;
}

// 2026-06-17 — v3: bell server-backed. Sursa de adevăr e tabela durabilă
// `sesizare_timeline` (citită pe mount → istoric cross-device, persistă chiar
// dacă userul era offline când s-a schimbat statusul). localStorage devine DOAR
// un cache pentru load instant. Bump v2→v3 ca să șteargă itemele vechi cu id
// random (acum id-urile sunt stabile: `t-<timeline_id>` → dedup curat).
const STORAGE_KEY = "civia:notifications:v3";
const LAST_SEEN_KEY = "civia:notifications:v3:lastSeen";
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

// Culoare type-aware per status (soft bg + on-soft text, tokeni dark-safe) —
// notificările devin scanabile dintr-o privire: verde=rezolvat, ambră=în lucru,
// roșu=respins, albastru=înregistrată/trimisă.
const STATUS_TONE: Record<string, { bg: string; text: string }> = {
  rezolvat: { bg: "bg-[var(--color-success-soft)]", text: "text-[var(--color-success-on-soft)]" },
  "in-lucru": { bg: "bg-[var(--color-warning-soft)]", text: "text-[var(--color-warning-on-soft)]" },
  "actiune-autoritate": { bg: "bg-[var(--color-warning-soft)]", text: "text-[var(--color-warning-on-soft)]" },
  interventie: { bg: "bg-[var(--color-warning-soft)]", text: "text-[var(--color-warning-on-soft)]" },
  respins: { bg: "bg-[var(--color-error-soft)]", text: "text-[var(--color-error-on-soft)]" },
  inregistrata: { bg: "bg-[var(--color-news-soft)]", text: "text-[var(--color-news-on-soft)]" },
  trimis: { bg: "bg-[var(--color-secondary-soft)]", text: "text-[var(--color-secondary-on-soft)]" },
  redirectionata: { bg: "bg-[var(--color-secondary-soft)]", text: "text-[var(--color-secondary-on-soft)]" },
  amanata: { bg: "bg-[var(--color-surface-2)]", text: "text-[var(--color-text-muted)]" },
};
const DEFAULT_TONE = { bg: "bg-[var(--color-primary-soft)]", text: "text-[var(--color-primary-on-soft)]" };

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

/**
 * Mapează un rând din `sesizare_timeline` (durabil sau realtime) într-o
 * Notification de status — sau null dacă nu e un status-change recognizable.
 * id-ul e STABIL (`t-<timeline_id>`) → același event citit din durabil + venit
 * prin realtime se dedup pe id, fără duplicate la remount.
 */
function buildStatusNotif(
  row: { id: string; event_type: string; description: string; created_at: string },
  meta: { code: string; titlu: string } | undefined,
): Notification | null {
  if (!meta) return null;
  const statusKey =
    row.event_type in STATUS_NOTIFICATION
      ? row.event_type
      : parseStatusFromDescription(row.description);
  if (!statusKey) return null;
  const tone = STATUS_NOTIFICATION[statusKey];
  if (!tone) return null;
  return {
    id: `t-${row.id}`,
    type: "status",
    status: statusKey,
    sesizareCode: meta.code,
    sesizareTitle: meta.titlu,
    message: `${tone.emoji} ${tone.label} · ${titleHint(meta.titlu)}`,
    createdAt: row.created_at,
    read: false,
  };
}

export function NotificationBell() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const addNotification = useCallback((n: Notification) => {
    let added = false;
    setNotifs((prev) => {
      // Dedup stabil pe id (`t-<timeline_id>`) — același event venit prin realtime
      // ȘI prezent deja din fetch-ul durabil nu se dublează.
      if (prev.some((p) => p.id === n.id)) return prev;
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
      added = true;
      const next = [n, ...prev].slice(0, MAX_STORED);
      saveStored(next);
      return next;
    });
    if (added) setUnread((u) => u + 1);
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
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      // 2026-06-04 — „Urmărește" eliminat. Status changes pe sesizările proprii
      // (owner) + co-semnate (cosigner).
      const [ownedRes, cosignsRes] = await Promise.all([
        supabase.from("sesizari").select("id").eq("user_id", user!.id).limit(200),
        supabase.from("sesizare_cosigners").select("sesizare_id").eq("user_id", user!.id).limit(200),
      ]);
      if (cancelled) return;
      const ownedIds = (ownedRes.data ?? []).map((s: { id: string }) => s.id);
      const cosignedIds = (cosignsRes.data ?? []).map((c: { sesizare_id: string }) => c.sesizare_id);
      const timelineIds = Array.from(new Set([...ownedIds, ...cosignedIds]));
      if (timelineIds.length === 0) return;

      // Metadata sesizări (id → code, titlu) o singură dată, reutilizat de durabil
      // + realtime (evită un lookup per-event).
      const metaById = new Map<string, { code: string; titlu: string }>();
      const metaRes = await supabase.from("sesizari").select("id, code, titlu").in("id", timelineIds);
      for (const r of (metaRes.data ?? []) as { id: string; code: string; titlu: string }[]) {
        metaById.set(r.id, { code: r.code, titlu: r.titlu });
      }

      // DURABIL — ultimele status-change events din `sesizare_timeline`. Cross-device,
      // persistă chiar dacă userul era offline când s-a schimbat statusul. Sursa de
      // adevăr; localStorage e doar cache pentru load instant.
      const { data: tlRows } = await supabase
        .from("sesizare_timeline")
        .select("id, sesizare_id, event_type, description, created_at")
        .in("sesizare_id", timelineIds)
        .order("created_at", { ascending: false })
        .limit(40);
      if (cancelled) return;
      const durable: Notification[] = [];
      for (const row of (tlRows ?? []) as {
        id: string; sesizare_id: string; event_type: string; description: string; created_at: string;
      }[]) {
        const n = buildStatusNotif(row, metaById.get(row.sesizare_id));
        if (n) durable.push(n);
      }
      if (durable.length > 0) {
        const lastSeen = Number(localStorage.getItem(LAST_SEEN_KEY) ?? "0");
        const top = durable.slice(0, MAX_STORED);
        setNotifs(top);
        saveStored(top);
        setUnread(top.filter((n) => new Date(n.createdAt).getTime() > lastSeen).length);
      }

      // LIVE — realtime pe timeline. Channel name unic per mount (StrictMode safe).
      const channelName = `notifications-${user!.id}-${typeof crypto !== "undefined" ? crypto.randomUUID().slice(0, 8) : Date.now()}`;
      channel = supabase.channel(channelName);
      channel.on(
        "postgres_changes" as never,
        {
          event: "INSERT",
          schema: "public",
          table: "sesizare_timeline",
          filter: `sesizare_id=in.(${timelineIds.join(",")})`,
        },
        async (payload: {
          new: { id: string; sesizare_id: string; event_type: string; description: string; created_at?: string };
        }) => {
          let meta = metaById.get(payload.new.sesizare_id);
          if (!meta) {
            const { data } = await supabase
              .from("sesizari")
              .select("code, titlu")
              .eq("id", payload.new.sesizare_id)
              .maybeSingle();
            if (data) meta = data as { code: string; titlu: string };
          }
          const n = buildStatusNotif(
            {
              id: payload.new.id,
              event_type: payload.new.event_type,
              description: payload.new.description,
              created_at: payload.new.created_at ?? new Date().toISOString(),
            },
            meta,
          );
          if (n) addNotification(n);
        },
      );
      channel.subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
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

  function markSeen() {
    localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
    setUnread(0);
    setNotifs((prev) => {
      const next = prev.map((n) => (n.read ? n : { ...n, read: true }));
      saveStored(next);
      return next;
    });
  }

  function handleOpen() {
    setOpen((v) => !v);
    // La deschidere → marcat ca văzut. Lista NU se mai șterge: e istoric durabil
    // din `sesizare_timeline`, ar reapărea oricum la următorul load (cross-device).
    if (!open) markSeen();
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
            className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[var(--color-error)] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[var(--color-surface)] animate-scale-in"
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
          className="fixed sm:absolute top-16 sm:top-auto left-2 right-2 sm:left-auto sm:right-0 sm:mt-2 sm:w-80 sm:max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-5rem)] sm:max-h-[480px] overflow-hidden lc-glass-2 rounded-[var(--radius-lg)] z-50 flex flex-col animate-fade-in"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <div className="text-sm font-semibold">Ce s-a mișcat</div>
            {notifs.length > 0 && (
              <button
                type="button"
                onClick={markSeen}
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
                Îți dăm semn aici când o sesizare de-a ta (sau co-semnată) își schimbă statusul ori primește răspuns de la autoritate.
              </div>
            </div>
          ) : (
            <div className="overflow-y-auto">
              {notifs.map((n) => {
                const tone = (n.status && STATUS_TONE[n.status]) || DEFAULT_TONE;
                const emoji = n.status ? STATUS_NOTIFICATION[n.status]?.emoji : null;
                return (
                <Link
                  key={n.id}
                  href={`/sesizari/${n.sesizareCode}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex gap-3 px-4 py-3 hover:bg-[var(--color-surface-2)] border-b border-[var(--color-border)] last:border-b-0 transition-colors",
                    !n.read && "bg-[var(--color-primary-soft)]/30"
                  )}
                >
                  <div className={cn("w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-base", tone.bg, tone.text)}>
                    {emoji ?? <CheckCircle2 size={16} aria-hidden="true" />}
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
                );
              })}
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

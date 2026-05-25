"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import { trackPushPermission } from "@/components/analytics/CiviaTracker";

/**
 * Buton mic pentru activarea/dezactivarea notificărilor push pe acest
 * device. Vizibil doar pentru utilizatori logați și doar dacă Push API
 * e suportat (Chrome/Firefox Android, iOS Safari 16.4+ INSTALAT ca PWA).
 *
 * Flow:
 *  1. Verifică suport API + permission curent
 *  2. Click pe „Activează" → Notification.requestPermission()
 *  3. Dacă „granted" → pushManager.subscribe() cu VAPID public key
 *  4. POST /api/push/subscribe cu subscription serializat
 *
 * Dezactivare: simetric — unsubscribe + DELETE /api/push/subscribe.
 */
export function PushPermissionButton() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok =
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission);
    // Verificăm dacă deja există o subscription pe acest device
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => setSubscribed(false));
  }, []);

  if (!user || !supported) return null;

  const subscribe = async () => {
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      trackPushPermission(perm as "granted" | "denied" | "default");
      if (perm !== "granted") {
        toast("Notificările sunt blocate. Activează-le din setări browser.", "error");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        toast("Notificările nu sunt configurate pe server. Revino mai târziu.", "error");
        return;
      }
      // pushManager.subscribe acceptă BufferSource pentru applicationServerKey.
      // Cast prin .buffer face ca TS să accepte ArrayBuffer (vs Uint8Array
      // direct, care declanșează un mismatch SharedArrayBuffer pe TS 5+).
      const keyBytes = urlBase64ToUint8Array(vapidPublicKey);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes.buffer.slice(
          keyBytes.byteOffset,
          keyBytes.byteOffset + keyBytes.byteLength,
        ) as ArrayBuffer,
      });
      // Trimitem subscription la server pentru stocare
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Eroare la salvare");
      }
      setSubscribed(true);
      toast("Notificările sunt active pe acest device.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare", "error");
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`, {
          method: "DELETE",
        });
      }
      setSubscribed(false);
      toast("Nu mai primești notificări pe acest device.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Eroare", "error");
    } finally {
      setLoading(false);
    }
  };

  // Permission e „denied" — nu putem face nimic prin JS, user trebuie să
  // schimbe din browser settings.
  if (permission === "denied") {
    return (
      <p className="text-[11px] text-[var(--color-text-muted)] inline-flex items-center gap-1.5">
        <BellOff size={11} aria-hidden="true" />
        Notificări blocate (activează din 🔒 lângă URL)
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={subscribed ? unsubscribe : subscribe}
      disabled={loading}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-pill)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-surface)] disabled:opacity-60 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
    >
      {loading ? (
        <Loader2 size={11} className="animate-spin" aria-hidden="true" />
      ) : subscribed ? (
        <BellOff size={11} aria-hidden="true" />
      ) : (
        <Bell size={11} className="text-[var(--color-primary)]" aria-hidden="true" />
      )}
      {subscribed ? "Oprește notificări push" : "Activează notificări push"}
    </button>
  );
}

/** VAPID public key e base64url; convertim la Uint8Array cum cere API-ul. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

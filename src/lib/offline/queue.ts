/**
 * Client-side helper pentru queue-ul offline. Folosit din formulare ca:
 *
 *   import { queueOrSubmit } from "@/lib/offline/queue";
 *   const ok = await queueOrSubmit("/api/feedback/submit", body);
 *   if (ok === "queued") showToast("Salvat — se trimite cand reapare reteaua");
 *
 * Pe browser cu reteaua activa, fetch normal. Pe offline, posteaza in SW
 * queue + cere Background Sync (sau fallback la online event listener).
 */

export type QueueResult = "delivered" | "queued" | "error";

export async function queueOrSubmit(
  url: string,
  body: unknown,
  options: { method?: "POST" | "PUT" | "DELETE"; headers?: Record<string, string> } = {},
): Promise<QueueResult> {
  const method = options.method ?? "POST";
  const headers = options.headers ?? { "Content-Type": "application/json" };

  // Daca suntem online, incercam direct.
  if (typeof navigator !== "undefined" && navigator.onLine !== false) {
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: typeof body === "string" ? body : JSON.stringify(body),
        credentials: "include",
      });
      if (res.ok) return "delivered";
      if (res.status >= 500) {
        // 5xx → poate iesi din retea. Trecem la queue.
        return queueViaServiceWorker(url, method, body, headers);
      }
      return "error";
    } catch {
      // Network gone exact in mid-call.
      return queueViaServiceWorker(url, method, body, headers);
    }
  }

  // Offline.
  return queueViaServiceWorker(url, method, body, headers);
}

async function queueViaServiceWorker(
  url: string,
  method: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<QueueResult> {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.controller) {
    return "error";
  }
  navigator.serviceWorker.controller.postMessage({
    type: "QUEUE_REQUEST",
    url,
    method,
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers,
  });
  return "queued";
}

/**
 * Apel din root layout: cand reapare online, cere SW sa flush coada.
 * iOS Safari nu suporta Background Sync, deci fara asta cererile raman
 * blocate pana cand userul re-deschide tab-ul.
 */
export function attachOnlineFlushListener(): () => void {
  if (typeof window === "undefined") return () => { /* noop */ };
  const handler = () => {
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "FLUSH_OUTBOX" });
    }
  };
  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}

/**
 * Listener pentru notificari de la SW cand un request din coada a fost livrat.
 * UI poate afisa toast „Salvat offline → trimis acum".
 */
export function onOutboxEvent(
  callback: (event: { type: "OUTBOX_DELIVERED" | "OUTBOX_FAILED"; url: string; status?: number }) => void,
): () => void {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) {
    return () => { /* noop */ };
  }
  const handler = (e: MessageEvent) => {
    const data = e.data;
    if (data?.type === "OUTBOX_DELIVERED" || data?.type === "OUTBOX_FAILED") {
      callback(data);
    }
  };
  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}

/**
 * Web Share API Level 2 — atașează pozele REAL la email-ul utilizatorului.
 *
 * `mailto:` din browser nu poate atașa fișiere niciodată (RFC 6068). Singura
 * modalitate prin care un site poate trimite fișiere în compositorul de mail
 * AL UTILIZATORULUI (din contul lui personal, nu de pe server) e Web Share
 * API: navigator.share({ files, text, title }) → share sheet nativ → user
 * alege Mail / Gmail / Outlook → composer-ul se deschide cu pozele atașate.
 *
 * Limitări de protocol:
 * - NU putem pre-completa câmpul „Către:" separat — apps-urile nu suportă
 *   `to` pe Web Share. Userul trebuie să lipească destinatarii manual.
 * - Compensăm copiind destinatarii în clipboard ÎNAINTE de share, ca
 *   userul să facă doar Ctrl+V / long-press paste în câmpul To: după ce
 *   se deschide aplicația.
 *
 * Suport browser (caniuse 2026):
 * - iOS Safari 15+        ✅
 * - Chrome Android        ✅
 * - Edge desktop          ✅
 * - Chrome desktop (Mac+Win) ✅
 * - Firefox               ❌ → fallback la mailto cu URL-uri
 * - Chrome Linux          ❌ → fallback la mailto cu URL-uri
 *
 * Acoperire reală pentru o audiență civic-mobile-heavy: ~75-80%.
 */

export interface ShareAttachmentsInput {
  /** URL-uri publice (Supabase Storage) ale pozelor de atașat. */
  imageUrls: string[];
  /** Subiectul emailului. Devine `title` în share payload. */
  subject: string;
  /** Body-ul emailului. Devine `text` în share payload. */
  body: string;
  /** Lista combinată To+CC pentru a fi copiată în clipboard. */
  recipients: string[];
}

export interface ShareAttachmentsResult {
  ok: boolean;
  reason?:
    | "no-share-api"
    | "no-files-support"
    | "fetch-failed"
    | "user-cancelled"
    | "share-failed";
  error?: string;
}

/**
 * Verifică dacă browser-ul curent poate face share cu fișiere.
 * Folosește un dummy File ca să forțăm canShare să răspundă „pot fișiere".
 * (canShare() fără argument verifică doar suportul general, nu cel cu files.)
 */
export function canShareWithFiles(): boolean {
  if (typeof navigator === "undefined") return false;
  if (!navigator.share || !navigator.canShare) return false;
  try {
    const probe = new File(["probe"], "probe.txt", { type: "text/plain" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/**
 * Descarcă pozele din URL-urile lor (Supabase Storage public bucket) și
 * le transformă în obiecte `File` care pot fi pasate în navigator.share.
 *
 * Numele fișierului e generat curat (sesizare-1.jpg, sesizare-2.jpg...) ca
 * să apară prietenos în lista de atașamente, nu cu hash-uri Supabase.
 *
 * Limitate la 8 poze ca să nu depășim limita de payload Web Share (~25MB
 * pe iOS, mai puțin pe Android low-end).
 */
async function fetchAsFiles(urls: string[]): Promise<File[]> {
  const limited = urls.slice(0, 8);
  const files: File[] = [];

  for (let i = 0; i < limited.length; i++) {
    const url = limited[i]!;
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) {
        console.warn(`[share-attachments] fetch failed pentru ${url}: ${res.status}`);
        continue;
      }
      const blob = await res.blob();
      // Determină extensia din MIME (mai sigur decât din URL — Supabase folosește hash-uri)
      const ext = mimeToExt(blob.type) ?? "jpg";
      const name = `sesizare-${i + 1}.${ext}`;
      files.push(new File([blob], name, { type: blob.type || "image/jpeg" }));
    } catch (e) {
      console.warn(`[share-attachments] error la ${url}`, e);
    }
  }

  return files;
}

function mimeToExt(mime: string): string | null {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/heic":
      return "heic";
    case "application/pdf":
      return "pdf";
    default:
      return null;
  }
}

/**
 * Copiază destinatarii în clipboard ca user să-i lipească în câmpul „Către:"
 * după ce se deschide aplicația de mail. Best-effort — eșuează silent dacă
 * permisiunea clipboard e refuzată.
 */
async function copyRecipientsToClipboard(recipients: string[]): Promise<boolean> {
  if (recipients.length === 0) return false;
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(recipients.join(", "));
    return true;
  } catch {
    return false;
  }
}

/**
 * Flow complet:
 * 1. Copiază destinatarii în clipboard
 * 2. Descarcă pozele ca File obiecte
 * 3. Apelează navigator.share — share sheet apare, user alege app-ul
 * 4. App-ul deschide composer-ul cu pozele atașate + subject + body
 * 5. User lipește destinatarii (Ctrl+V) în câmpul „Către" și trimite
 *
 * Returnează `{ ok: true }` dacă share-ul a fost trigger-uit cu succes
 * (NU înseamnă că userul chiar a trimis — doar că share sheet-ul s-a
 * deschis). Caller-ul poate folosi asta să afișeze instrucțiuni post-share.
 */
export async function shareSesizareWithAttachments(
  input: ShareAttachmentsInput,
): Promise<ShareAttachmentsResult> {
  if (!canShareWithFiles()) {
    return { ok: false, reason: "no-files-support" };
  }

  // Descărcăm pozele ÎNAINTE să atingem clipboard-ul, ca să nu pierdem
  // user-gesture-ul (clipboard.write necesită gesture activ pe unele
  // browsere; share necesită la fel; dar fetch e OK în orice moment).
  let files: File[] = [];
  try {
    files = await fetchAsFiles(input.imageUrls);
  } catch (e) {
    return {
      ok: false,
      reason: "fetch-failed",
      error: e instanceof Error ? e.message : "Unknown",
    };
  }

  if (files.length === 0) {
    return { ok: false, reason: "fetch-failed", error: "Nicio poză descărcată" };
  }

  // Re-check după fetch — Files concrete trebuie să fie ele însele „shareable".
  if (!navigator.canShare({ files })) {
    return { ok: false, reason: "no-files-support" };
  }

  // Copiem destinatarii în clipboard. Best-effort, nu blocăm share-ul dacă
  // eșuează (apps-urile arată oricum textul cu destinatarii în body).
  await copyRecipientsToClipboard(input.recipients);

  try {
    await navigator.share({
      files,
      title: input.subject,
      text: input.body,
    });
    return { ok: true };
  } catch (e) {
    // AbortError = userul a anulat share sheet-ul (a apăsat „Cancel"),
    // nu e o eroare reală. Returnăm reason="user-cancelled" ca caller-ul
    // să nu afișeze toast de eroare.
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, reason: "user-cancelled" };
    }
    return {
      ok: false,
      reason: "share-failed",
      error: e instanceof Error ? e.message : "Unknown",
    };
  }
}

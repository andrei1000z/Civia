/**
 * Bucket-uri pentru referrer source — folosit in funnel-ul de growth.
 *
 * Input: referrer URL (cum vine din document.referrer, deja sanitizat de
 * client la 100 chars). Poate fi „direct" (no referrer), un URL plin
 * („https://www.reddit.com/r/bucuresti/comments/abc"), sau doar hostname.
 *
 * Output: bucket short string („reddit", „google", „twitter", „facebook",
 * „direct", „other") pe care il agreggam in Redis. Mapping conservativ —
 * doar surse cu volum vizibil pentru noi.
 */
export function referrerSource(raw: string | null | undefined): string {
  if (!raw || raw === "direct" || raw === "(none)") return "direct";

  // Normalize: lowercase + strip protocol + strip path
  let host: string;
  try {
    // Daca e URL plin, parseaza
    if (raw.includes("://")) {
      host = new URL(raw).hostname.toLowerCase();
    } else {
      // Altfel asume hostname/raw
      host = raw.toLowerCase().split("/")[0] ?? "";
    }
  } catch {
    host = raw.toLowerCase();
  }
  // Strip www. and m. prefixes
  host = host.replace(/^(?:www\.|m\.|amp\.)/, "");

  if (host.includes("reddit")) return "reddit";
  if (host.includes("google")) return "google";
  if (host.includes("facebook") || host === "fb.me" || host.includes("fb.com")) return "facebook";
  if (host.includes("twitter") || host === "t.co" || host === "x.com") return "twitter";
  if (host.includes("instagram")) return "instagram";
  if (host.includes("tiktok")) return "tiktok";
  if (host.includes("linkedin")) return "linkedin";
  if (host.includes("youtube") || host === "youtu.be") return "youtube";
  if (host.includes("bing")) return "bing";
  if (host.includes("duckduckgo")) return "duckduckgo";
  if (host.includes("yandex")) return "yandex";
  if (host.includes("digi24") || host.includes("hotnews") || host.includes("g4media") ||
      host.includes("pressone") || host.includes("dela0") || host.includes("recorder.ro") ||
      host.includes("libertatea") || host.includes("adevarul") || host.includes("stirileprotv")) {
    return "media-ro";
  }
  // Daca include „civia" e self-referral (intern)
  if (host.includes("civia")) return "internal";
  return "other";
}

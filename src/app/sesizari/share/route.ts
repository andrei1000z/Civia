import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isValidImage } from "@/lib/sanitize";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];
const EXT_FROM_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
};

/**
 * Web Share Target endpoint — receives the multipart POST emitted by
 * the OS share sheet when the user picks "Civia" from another app
 * (camera roll → Share → Civia, browser link → Share → Civia, etc.).
 *
 * The manifest declares:
 *   action:   /sesizari/share
 *   method:   POST
 *   enctype:  multipart/form-data
 *   params:   { title, text → description, url → link, files → photo }
 *
 * We:
 *   1. Pull title / description / link from the form
 *   2. Save the first photo (if any) to Supabase storage so it has a
 *      stable URL we can pass via the redirect query string
 *   3. 303-redirect to /sesizari?from=share&… so the SesizareForm
 *      can pre-fill itself from the URL params
 *
 * No file means we still redirect (user shared a link or text only).
 * Multiple files → only the first is attached for now; honoring all
 * of them would require batched upload + a longer query string.
 */
export async function POST(req: Request) {
  // Rate limit just like /api/upload — share_target is anonymous and
  // could be hammered by an automated share spammer.
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`share-target:${ip}`, {
    limit: 10,
    windowMs: 5 * 60_000,
  });
  if (!rl.success) {
    return redirectTo("/sesizari?from=share&error=rate-limit");
  }

  let title: string | null = null;
  let description: string | null = null;
  let link: string | null = null;
  let photoUrl: string | null = null;

  try {
    const formData = await req.formData();
    title = (formData.get("title") as string | null)?.toString().trim() || null;
    description = (formData.get("description") as string | null)?.toString().trim() || null;
    link = (formData.get("link") as string | null)?.toString().trim() || null;

    // share_target params.files.name was "photo" (singular); browsers
    // send all matching files under that key. Only the first photo
    // gets attached — keeps the redirect URL short and avoids
    // multi-upload latency on the share path.
    const photo = formData.get("photo") as File | null;
    // Skip silently if absent / unsupported MIME / oversize / failed magic
    // check — the share path should always land the user on /sesizari, not
    // hard-fail. Photo just won't be pre-attached.
    if (
      photo &&
      photo.size > 0 &&
      ALLOWED_TYPES.includes(photo.type) &&
      photo.size <= MAX_UPLOAD_BYTES
    ) {
      const validMagic = await isValidImage(photo);
      if (validMagic) {
        const ext = EXT_FROM_MIME[photo.type] ?? "jpg";
        const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
        const path = `public/${filename}`;
        const supabase = await createSupabaseServer();
        const arrayBuffer = await photo.arrayBuffer();
        const { error } = await supabase.storage
          .from("sesizari-photos")
          .upload(path, arrayBuffer, {
            contentType: photo.type,
            cacheControl: "3600",
          });
        if (!error) {
          const { data } = supabase.storage
            .from("sesizari-photos")
            .getPublicUrl(path);
          photoUrl = data.publicUrl;
        }
      }
    }
  } catch {
    // Malformed multipart — fall through to redirect with whatever we
    // managed to extract so the user lands somewhere useful.
  }

  // Build the redirect URL. Browser GETs this URL after the redirect,
  // so the file isn't lost — it's already uploaded and the URL is
  // pinned in the query string for SesizareForm to pick up.
  const params = new URLSearchParams();
  params.set("from", "share");
  if (title) params.set("title", title.slice(0, 200));
  if (description) params.set("desc", description.slice(0, 1000));
  if (link) params.set("link", link.slice(0, 500));
  if (photoUrl) params.set("photo", photoUrl);

  return redirectTo(`/sesizari?${params.toString()}`);
}

function redirectTo(path: string) {
  // 303 (See Other) is the right code after a POST → GET handoff —
  // tells the browser to switch verb to GET. 302 also works but
  // historically some clients re-POST.
  return NextResponse.redirect(new URL(path, "https://civia.ro"), 303);
}

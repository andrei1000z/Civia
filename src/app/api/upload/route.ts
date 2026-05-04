import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { isValidImage, isValidPdf } from "@/lib/sanitize";
import { MAX_UPLOAD_BYTES as MAX_FILE_SIZE } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_DOC_TYPES = [...ALLOWED_IMAGE_TYPES, "application/pdf"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
// PDFs are allowed up to a higher cap because scanned official letters
// often run 2–10 MB, but only when the caller opts in via `kind=document`.
const PDF_MAX_BYTES = 15 * 1024 * 1024;
// Video: telefoane moderne fac clip-uri de 30 sec ≈ 30-50 MB H.264.
// Cap-ăm la 50 MB ca să rămânem în limita Vercel (body 4.5MB pe edge,
// dar nodejs runtime + Supabase Storage acceptă mai mult).
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`upload:${ip}`, { limit: 15, windowMs: 5 * 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Prea multe uploads. Așteaptă câteva minute." },
      { status: 429 }
    );
  }

  // `kind` opts in to specific media types:
  //   - default (image)   — sesizari photo flow
  //   - document          — PDF uploads (status receipts, official letters)
  //   - video             — proteste aftermath video clips
  // Default rămâne image-only ca să nu accepte arbitrar alte tipuri.
  const url = new URL(req.url);
  const kindParam = url.searchParams.get("kind");
  const kind: "image" | "document" | "video" =
    kindParam === "document" ? "document" : kindParam === "video" ? "video" : "image";
  const allowedTypes =
    kind === "document"
      ? ALLOWED_DOC_TYPES
      : kind === "video"
        ? ALLOWED_VIDEO_TYPES
        : ALLOWED_IMAGE_TYPES;

  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "Niciun fișier selectat" }, { status: 400 });
    }
    if (files.length > 5) {
      return NextResponse.json({ error: "Maxim 5 fișiere pe upload" }, { status: 400 });
    }

    // Validate each file — MIME + size + magic number
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: `Tip invalid: ${file.type}` }, { status: 400 });
      }
      const sizeCap =
        file.type === "application/pdf"
          ? PDF_MAX_BYTES
          : file.type.startsWith("video/")
            ? VIDEO_MAX_BYTES
            : MAX_FILE_SIZE;
      if (file.size > sizeCap) {
        return NextResponse.json({ error: `Fișier prea mare: ${file.name}` }, { status: 400 });
      }
      // Magic-byte validation: pentru imagini + PDF avem helper-e robuste.
      // Video skipăm (size cap + MIME check trebuie să fie suficient — un
      // exploit prin video file în storage-ul nostru servit static e
      // foarte improbabil; oricum, container-ul de browser sandbox-ează).
      if (file.type !== "application/pdf" && !file.type.startsWith("video/")) {
        const validMagic = await isValidImage(file);
        if (!validMagic) {
          return NextResponse.json(
            { error: `Fișier corupt sau nu e imagine reală: ${file.name}` },
            { status: 400 }
          );
        }
      } else if (file.type === "application/pdf") {
        const validMagic = await isValidPdf(file);
        if (!validMagic) {
          return NextResponse.json(
            { error: `Fișier PDF corupt: ${file.name}` },
            { status: 400 }
          );
        }
      }
    }

    // Use anon key client — storage policy `photos_upload_anyone` allows public uploads
    // to the sesizari-photos bucket. No need for service_role here.
    const supabase = await createSupabaseServer();
    const uploaded: string[] = [];

    // Map MIME type → safe extension (don't trust client filename)
    const extFromMime: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "application/pdf": "pdf",
      "video/mp4": "mp4",
      "video/webm": "webm",
      "video/quicktime": "mov",
    };

    for (const file of files) {
      const ext = extFromMime[file.type] ?? "jpg";
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const path = `public/${filename}`;

      const arrayBuffer = await file.arrayBuffer();
      const { error } = await supabase.storage
        .from("sesizari-photos")
        .upload(path, arrayBuffer, {
          contentType: file.type,
          cacheControl: "3600",
        });

      if (error) {
        return NextResponse.json({ error: `Eroare upload: ${error.message}` }, { status: 500 });
      }

      const { data } = supabase.storage.from("sesizari-photos").getPublicUrl(path);
      uploaded.push(data.publicUrl);
    }

    return NextResponse.json({ data: { urls: uploaded } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Eroare upload";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

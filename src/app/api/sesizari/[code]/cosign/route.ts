import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getSesizareByCode } from "@/lib/sesizari/repository";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { sanitizeText } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.union([z.string().email(), z.literal(""), z.null()]).optional().transform((v) => (v === "" ? null : v ?? null)),
  city: z.string().max(120).optional().nullable(),
  message: z.string().max(500).optional().nullable(),
  _honey: z.string().optional(),
});

function hashIp(ip: string): string {
  return createHash("sha256").update(ip + (process.env.COSIGN_SALT ?? "civia")).digest("hex").slice(0, 16);
}

/**
 * POST /api/sesizari/[code]/cosign
 *
 * Real co-signing: persists an identified co-signer (user_id or anon email)
 * in `sesizare_cosigners` + writes a "cosemnat" timeline event so followers
 * see "Un alt cetatean a co-semnat". Dedup pe (sesizare_id, user_id) sau
 * (sesizare_id, email) ca sa nu poata fi pumped de un singur user.
 *
 * Pe form-less calls (body fara name) ramane backwards-compat — doar
 * incrementeaza timeline-ul anonim (vechiul flow „Trimite si tu" cu mailto).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`cosign:${ip}`, { limit: 10, windowMs: 60 * 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Prea multe co-semnături. Mai încearcă peste o oră." },
      { status: 429 },
    );
  }

  const { code } = await params;
  const sesizare = await getSesizareByCode(code);
  if (!sesizare) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!sesizare.publica || sesizare.moderation_status !== "approved") {
    return NextResponse.json({ error: "Sesizare nedisponibila pentru co-semnare" }, { status: 403 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // No body → legacy anon counter mode
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Date invalide" }, { status: 400 });
  }
  const { name, email, city, message, _honey } = parsed.data;
  if (_honey) return NextResponse.json({ ok: true });

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createSupabaseAdmin();

  // Identified co-sign (logged-in or anon-with-email).
  let cosignerInserted = false;
  if (name && (user || email)) {
    const insertRow = {
      sesizare_id: sesizare.id,
      user_id: user?.id ?? null,
      name: sanitizeText(name),
      email: email ?? null,
      city: city ? sanitizeText(city) : null,
      message: message ? sanitizeText(message) : null,
      ip_hash: hashIp(ip),
    };

    const { error: insErr } = await admin.from("sesizare_cosigners").insert(insertRow);
    if (insErr) {
      if (insErr.code === "23505") {
        return NextResponse.json({ error: "Ai co-semnat deja aceasta sesizare." }, { status: 409 });
      }
      // Fall through to timeline-only if cosigners table doesn't exist yet
      // (migration 042 hasn't run): treat as legacy mode.
    } else {
      cosignerInserted = true;
    }
  }

  // Timeline event — preserves the legacy „cosemnat" pulse so followers
  // get notified even when the cosigner table write was skipped.
  await admin.from("sesizare_timeline").insert({
    sesizare_id: sesizare.id,
    event_type: "cosemnat",
    description: "Un alt cetățean a co-semnat această sesizare",
    created_by: user?.id ?? null,
  });

  // Count after insert pentru live UI.
  let count = 0;
  if (cosignerInserted) {
    const { count: c } = await admin
      .from("sesizare_cosigners")
      .select("id", { count: "exact", head: true })
      .eq("sesizare_id", sesizare.id);
    count = c ?? 0;
  }

  return NextResponse.json({ ok: true, identified: cosignerInserted, count });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const sesizare = await getSesizareByCode(code);
  if (!sesizare) return NextResponse.json({ count: 0, recent: [] });

  const admin = createSupabaseAdmin();
  const { count } = await admin
    .from("sesizare_cosigners")
    .select("id", { count: "exact", head: true })
    .eq("sesizare_id", sesizare.id);

  const { data: recent } = await admin
    .from("sesizare_cosigners")
    .select("name, city, created_at")
    .eq("sesizare_id", sesizare.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return NextResponse.json({ count: count ?? 0, recent: recent ?? [] });
}

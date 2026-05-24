import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getSesizareByCode } from "@/lib/sesizari/repository";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { sanitizeText } from "@/lib/sanitize";
import { publicAuthorName } from "@/lib/sesizari/display-name";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.union([z.string().email(), z.literal(""), z.null()]).optional().transform((v) => (v === "" ? null : v ?? null)),
  /**
   * IMPORTANT: NU mai trimitem adresa de domiciliu in `city`. Field-ul
   * acceptat aici e exclusiv localitatea (Bucuresti, Cluj-Napoca, etc).
   * Adresa stradala completa NU se mai persista in DB-ul de cosigners
   * — leak vechi (bug 5/19/2026).
   */
  city: z.string().max(60).optional().nullable(),
  message: z.string().max(500).optional().nullable(),
  _honey: z.string().optional(),
});

function hashIp(ip: string): string {
  return createHash("sha256").update(ip + (process.env.COSIGN_SALT ?? "civia")).digest("hex").slice(0, 16);
}

/**
 * POST /api/sesizari/[code]/cosign
 *
 * Real co-signing: persistă un co-semnatar in `sesizare_cosigners`. Dedup:
 *   - user logat: (sesizare_id, user_id)
 *   - anon cu email: (sesizare_id, lower(email))
 *   - anon fara email: (sesizare_id, ip_hash)  ← bugfix 5/19/2026
 *
 * Inainte, daca user nu era logat SI nu da email, ruta INSERA NIMIC si
 * doar timeline-ul primea eveniment → counter ramanea la 1 chiar daca
 * 10 cetateni apasau „Trimite si tu". Acum oricine apasa e contorizat,
 * cu dedup pe IP ca sa nu poata spam de pe acelasi device.
 *
 * GET /api/sesizari/[code]/cosign
 *
 * Returneaza count + ultimii 5 cosigners cu PII ZERO:
 *   - first_name (primul cuvant din nume)
 *   - created_at (data — frontend formateaza „19 mai")
 * Nu mai expunem nume complet, city, email, ip_hash.
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
    // No body → tot incercam cosign anon cu ip_hash.
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

  // Insert UNIVERSAL: oricine apasa „Trimite si tu" → insertam rand cu
  // dedup adecvat (user/email/ip). Numele e optional (default „Cetățean")
  // ca anonimul-fara-form sa fie contat. Adresa nu se persista NICIODATA.
  let cosignerInserted = false;
  const safeName = name ? sanitizeText(name).slice(0, 120) : "Cetățean";
  // City sanitizat la max 60 chars — extra defense impotriva trimiterii
  // unei adrese complete in field-ul ce ar urma sa stea acolo.
  const safeCity = city ? sanitizeText(city).slice(0, 60) : null;
  const insertRow = {
    sesizare_id: sesizare.id,
    user_id: user?.id ?? null,
    name: safeName,
    email: email ?? null,
    city: safeCity,
    message: message ? sanitizeText(message).slice(0, 500) : null,
    ip_hash: hashIp(ip),
  };

  const { error: insErr } = await admin.from("sesizare_cosigners").insert(insertRow);
  if (insErr) {
    if (insErr.code === "23505") {
      // Deja co-semnat de acelasi user/email/IP — întoarcem count actual.
      const { count: c } = await admin
        .from("sesizare_cosigners")
        .select("id", { count: "exact", head: true })
        .eq("sesizare_id", sesizare.id);
      return NextResponse.json(
        { error: "Ai co-semnat deja această sesizare.", count: c ?? 0 },
        { status: 409 },
      );
    }
    // Alt tip de eroare (table missing, schema mismatch, etc) — fall
    // through la timeline-only mode.
  } else {
    cosignerInserted = true;
  }

  // Timeline event — preservam pulse-ul „cosemnat" pentru followers.
  await admin.from("sesizare_timeline").insert({
    sesizare_id: sesizare.id,
    event_type: "cosemnat",
    description: "Un alt cetățean a co-semnat această sesizare",
    created_by: user?.id ?? null,
  });

  const { count } = await admin
    .from("sesizare_cosigners")
    .select("id", { count: "exact", head: true })
    .eq("sesizare_id", sesizare.id);

  // 2026-05-24 (P3.26 fix) — bump civic streak la co-sign pentru user logat.
  // Cosign-urile anonime nu primesc streak (n-au user_id de updatat).
  if (user?.id) {
    const { bumpCivicStreak } = await import("@/lib/civic-streak");
    void bumpCivicStreak(user.id);
  }

  return NextResponse.json({ ok: true, identified: cosignerInserted, count: count ?? 0 });
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

  // PRIVACY: returnam DOAR primul cuvant din nume + data. NU mai expunem:
  //   - nume complet (fost: „Eduard Andrei Mușat")
  //   - city/adresa (fost: „Strada Novaci 12, Sector 5")
  //   - email, ip_hash
  // Asta respecta GDPR principiul de minimizare a datelor.
  const { data: recent } = await admin
    .from("sesizare_cosigners")
    .select("name, created_at")
    .eq("sesizare_id", sesizare.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const sanitized = (recent ?? []).map((r) => ({
    first_name: publicAuthorName({ author_name: r.name, display_name: null }),
    created_at: r.created_at,
  }));

  return NextResponse.json({ count: count ?? 0, recent: sanitized });
}

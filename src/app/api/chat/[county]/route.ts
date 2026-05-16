import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync, getClientIp, identityKey } from "@/lib/ratelimit";
import { sanitizeText } from "@/lib/sanitize";
import { ALL_COUNTIES } from "@/data/counties";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  message: z.string().min(2).max(500),
  display_name: z.string().max(40).optional().nullable(),
  _honey: z.string().optional(),
});

function hashIp(ip: string): string {
  return createHash("sha256").update(ip + (process.env.CHAT_SALT ?? "civia")).digest("hex").slice(0, 16);
}

// Lightweight heuristic moderation. Pe content suspect → pending review
// (admin aproba). Lista e minimala (slur principal + pattern PII).
const SLUR_REGEX = /\b(prost|tampit|idiot|jegos|porc|fascist|comunist)\b/i;
const PHONE_REGEX = /(?<!\d)0[27]\d{8}|\+40\d{9}/;
const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const CNP_REGEX = /\b[12]\d{12}\b/;

function classifyMessage(text: string): { status: string; flag: string } {
  if (CNP_REGEX.test(text)) return { status: "pending", flag: "pii_cnp" };
  if (EMAIL_REGEX.test(text)) return { status: "pending", flag: "pii_email" };
  if (PHONE_REGEX.test(text)) return { status: "pending", flag: "pii_phone" };
  if (SLUR_REGEX.test(text)) return { status: "pending", flag: "slur" };
  if (text.length > 0 && (text.match(/https?:\/\//g) || []).length > 2) {
    return { status: "pending", flag: "spam_links" };
  }
  return { status: "auto_approved", flag: "ok" };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ county: string }> },
) {
  const { county } = await params;
  const upper = county.toUpperCase();
  if (!ALL_COUNTIES.some((c) => c.id === upper)) {
    return NextResponse.json({ error: "County invalid" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("chat_messages")
    .select("id, display_name, message, upvotes, created_at")
    .eq("county", upper)
    .in("moderation_status", ["auto_approved", "approved"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ county: string }> },
) {
  const { county } = await params;
  const upper = county.toUpperCase();
  if (!ALL_COUNTIES.some((c) => c.id === upper)) {
    return NextResponse.json({ error: "County invalid" }, { status: 400 });
  }

  const ip = getClientIp(req);
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const rlKey = `chat:${identityKey(user?.id ?? null, ip)}`;
  const rl = await rateLimitAsync(rlKey, { limit: 10, windowMs: 10 * 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe mesaje. Asteapta 10 min." }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body invalid" }, { status: 400 }); }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
  }
  if (parsed.data._honey) return NextResponse.json({ ok: true });

  const message = sanitizeText(parsed.data.message);
  const displayName = parsed.data.display_name ? sanitizeText(parsed.data.display_name) : null;
  const classification = classifyMessage(message);

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("chat_messages")
    .insert({
      county: upper,
      message,
      display_name: displayName,
      user_id: user?.id ?? null,
      moderation_status: classification.status,
      ai_flag: classification.flag,
      ip_hash: hashIp(ip),
    })
    .select("id, display_name, message, upvotes, created_at, moderation_status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    posted: data.moderation_status === "auto_approved",
    pending_review: data.moderation_status === "pending",
    message: data.moderation_status === "pending"
      ? "Mesajul a fost trimis spre moderare (continea date personale sau cuvinte sensibile)."
      : null,
    data,
  });
}

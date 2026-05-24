import { NextResponse } from "next/server";
import { z } from "zod";
import { addComment, getComments, getSesizareByCode } from "@/lib/sesizari/repository";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";
import { sanitizeText } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

const commentSchema = z.object({
  body: z.string().min(1).max(2000),
  parent_comment_id: z.string().uuid().nullable().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const sesizare = await getSesizareByCode(code);
    if (!sesizare) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const comments = await getComments(sesizare.id);
    return NextResponse.json({ data: comments });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    // IP-scoped ceiling first so unauthenticated spam can't drain
    // Supabase auth + sesizare lookups. A legit logged-in user will
    // typically make <1 comment/min; 30/min per IP leaves plenty of
    // room for shared-network users.
    const ipRl = await rateLimitAsync(`comment-ip:${getClientIp(req)}`, {
      limit: 30,
      windowMs: 60_000,
    });
    if (!ipRl.success) {
      return NextResponse.json({ error: "Prea multe cereri" }, { status: 429 });
    }

    const { code } = await params;
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    const rl = await rateLimitAsync(`comment:${user.id}`, { limit: 10, windowMs: 60_000 });
    if (!rl.success) {
      return NextResponse.json({ error: "Prea multe comentarii" }, { status: 429 });
    }

    const sesizare = await getSesizareByCode(code);
    if (!sesizare) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = commentSchema.parse(body);

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    const displayName = (profile as { display_name: string } | null)?.display_name;

    const row = await addComment({
      sesizareId: sesizare.id,
      userId: user.id,
      authorName: displayName ?? user.email?.split("@")[0] ?? "Cetățean",
      body: sanitizeText(parsed.body, 2000),
      parentCommentId: parsed.parent_comment_id ?? null,
    });

    // 2026-05-24 (P3.26) — bump civic streak la comment.
    const { bumpCivicStreak } = await import("@/lib/civic-streak");
    void bumpCivicStreak(user.id);

    return NextResponse.json({ data: row });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error" }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

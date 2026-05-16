import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { rateLimitAsync } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const themeSchema = z.enum(["light", "dark", "system"]).nullable().optional();

const cookieConsentSchema = z.object({
  essential: z.boolean(),
  preferences: z.boolean(),
  analytics: z.boolean(),
  marketing: z.boolean(),
  acceptedAt: z.string(),
}).nullable().optional();

const dismissedPromptsSchema = z.record(z.string(), z.string()).nullable().optional();

const putSchema = z.object({
  theme: themeSchema,
  cookie_consent: cookieConsentSchema,
  dismissed_prompts: dismissedPromptsSchema,
});

/**
 * GET /api/profile/preferences — hydrate la mount.
 * Returneaza { theme, cookie_consent, dismissed_prompts } sau 401.
 * Cached 0s pentru ca trebuie sa fie fresh la fiecare device-load.
 */
export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("theme, cookie_consent, dismissed_prompts, preferences_updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    theme: data?.theme ?? null,
    cookie_consent: data?.cookie_consent ?? null,
    dismissed_prompts: data?.dismissed_prompts ?? null,
    updated_at: data?.preferences_updated_at ?? null,
  });
}

/**
 * PUT /api/profile/preferences — debounced write (clientul debounce-aza,
 * dar si server-side rate-limit 30/min/user ca anti-abuz).
 */
export async function PUT(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const rl = await rateLimitAsync(`prefs-put:${user.id}`, { limit: 30, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ error: "Prea multe schimbari." }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body invalid" }, { status: 400 }); }
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    preferences_updated_at: new Date().toISOString(),
  };
  if (parsed.data.theme !== undefined) updates.theme = parsed.data.theme;
  if (parsed.data.cookie_consent !== undefined) updates.cookie_consent = parsed.data.cookie_consent;
  if (parsed.data.dismissed_prompts !== undefined) updates.dismissed_prompts = parsed.data.dismissed_prompts;

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { sanitizeText } from "@/lib/sanitize";
import { getHideName, setHideName } from "@/lib/privacy/hidden-users";
import { rateLimitAsync } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Convert "" → null (Zod schema doesn't accept empty strings with min)
const emptyToNull = (v: unknown) => (v === "" ? null : v);

const updateSchema = z.object({
  display_name: z.preprocess(emptyToNull, z.string().min(2).max(80).nullable().optional()),
  full_name: z.preprocess(emptyToNull, z.string().min(2).max(120).nullable().optional()),
  address: z.preprocess(emptyToNull, z.string().min(3).max(300).nullable().optional()),
  phone: z.preprocess(emptyToNull, z.string().max(30).nullable().optional()),
  avatar_url: z.preprocess(emptyToNull, z.string().url().max(500).nullable().optional()),
  newsletter_email_optin: z.boolean().optional(),
  newsletter_sms_optin: z.boolean().optional(),
  // Privacy flag — persisted in Redis so it works without a DB migration.
  hide_name: z.boolean().optional(),
});

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  // Anonymous on public pages: return 200 with data:null instead of 401.
  // Pages like /sesizari-publice render BadgesSection/StreakWidget client
  // components that probe /api/profile to detect login; 401 spams Sentry +
  // browser console for normal anon traffic.
  if (!user) return NextResponse.json({ data: null });

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // hide_name lives in Redis — fetch and merge into the profile payload so
  // the /cont page can render the toggle without needing a DB column.
  const hide_name = await getHideName(user.id);

  // Self-heal: pre-existing users who set hide_name before the email
  // path was added wouldn't have their author_email in Redis yet, so
  // legacy guest-submitted sesizari still leak the name. Re-call
  // setHideName(true, email) which is idempotent — adds to both the
  // user-id and email sets. One Redis round-trip per profile load
  // when the flag is on; cheap.
  if (hide_name && user.email) {
    await setHideName(user.id, true, user.email).catch(() => {
      // Self-heal best-effort; the main response stays useful.
    });
  }

  return NextResponse.json({
    data: { ...(data ?? {}), email: user.email, hide_name },
  });
}

export async function PUT(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const rl = await rateLimitAsync(`profile-put:${user.id}`, { limit: 30, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Prea multe modificări. Încearcă peste un minut." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const parsed = updateSchema.parse(body);

    // Privacy toggle goes to Redis (no DB migration). We also store
    // the user's email so the anonymizer can match historical sesizari
    // that were submitted as guests (user_id=null but author_email
    // matches the now-logged-in user).
    if (parsed.hide_name !== undefined) {
      await setHideName(user.id, parsed.hide_name, user.email ?? null);
    }

    // Build DB update — null means "clear field", undefined means "don't change"
    const updates: Record<string, string | null | boolean> = {};
    if (parsed.display_name !== undefined) {
      updates.display_name = parsed.display_name ? sanitizeText(parsed.display_name, 80) : null;
    }
    if (parsed.full_name !== undefined) {
      updates.full_name = parsed.full_name ? sanitizeText(parsed.full_name, 120) : null;
    }
    if (parsed.address !== undefined) {
      updates.address = parsed.address ? sanitizeText(parsed.address, 300) : null;
    }
    if (parsed.phone !== undefined) {
      updates.phone = parsed.phone ? sanitizeText(parsed.phone, 30) : null;
    }
    if (parsed.avatar_url !== undefined) {
      updates.avatar_url = parsed.avatar_url;
    }
    if (parsed.newsletter_email_optin !== undefined) {
      updates.newsletter_email_optin = parsed.newsletter_email_optin;
    }
    if (parsed.newsletter_sms_optin !== undefined) {
      updates.newsletter_sms_optin = parsed.newsletter_sms_optin;
    }

    // If the user only toggled hide_name, there's nothing to UPDATE on
    // profiles — skip the DB round-trip entirely and just return the
    // current profile row with the new flag merged.
    if (Object.keys(updates).length === 0) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      return NextResponse.json({
        data: { ...(data ?? {}), hide_name: parsed.hide_name ?? (await getHideName(user.id)) },
      });
    }

    // Ensure profile row exists (might not if trigger didn't fire)
    const displayNameForUpsert =
      typeof updates.display_name === "string" && updates.display_name
        ? updates.display_name
        : user.email?.split("@")[0] || "Cetățean";
    await supabase
      .from("profiles")
      .upsert(
        { id: user.id, display_name: displayNameForUpsert },
        { onConflict: "id" }
      );

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Cascade: cand display_name se schimba, propagam la TOATE sesizarile
    // user-ului — coloana e denormalizata pentru queries publice rapide.
    // Fire-and-forget: erorile aici nu blocheaza response-ul (admin poate
    // rerula scriptul de backfill daca cascade-ul cade silent).
    if (parsed.display_name !== undefined) {
      const newDisplay = parsed.display_name
        ? sanitizeText(parsed.display_name, 80)
        : null;
      // service-role bypass RLS — user can update only their own sesizari
      // anyway via user_id match.
      const { createSupabaseAdmin } = await import("@/lib/supabase/admin");
      const sa = createSupabaseAdmin();
      void sa
        .from("sesizari")
        .update({ author_display_name: newDisplay })
        .eq("user_id", user.id)
        .then(() => { /* silent */ });
    }

    return NextResponse.json({
      data: { ...data, hide_name: await getHideName(user.id) },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      const firstIssue = e.issues[0];
      const msg = firstIssue?.message ?? "Date invalide";
      const field = firstIssue?.path.join(".");
      return NextResponse.json(
        { error: `${msg}${field ? ` (${field})` : ""}`, details: e.issues },
        { status: 400 }
      );
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

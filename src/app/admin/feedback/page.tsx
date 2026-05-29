import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { analyticsRedis } from "@/lib/analytics/redis";
import { FeedbackList } from "./FeedbackList";
import { FeedbackInbox } from "./FeedbackInbox";

export const metadata = { title: "Feedback / Contact — Admin" };
export const dynamic = "force-dynamic";

interface Row {
  id: string;
  text: string;
  email: string | null;
  topic: string | null;
  page_path: string | null;
  ip_hash: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

interface RedisFeedbackEntry {
  t: number;
  kind: string;
  message: string;
  email: string | null;
  userId: string | null;
  country: string | null;
  pathname: string | null;
}

export default async function AdminFeedbackPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") notFound();

  // 2026-05-27 — try/catch defensiv. Supabase outage/timeout NU trebuie
  // sa crash-eze /admin/feedback (Redis fallback deja gestionat mai jos).
  const admin = createSupabaseAdmin();
  let rows: Row[] = [];
  try {
    const { data } = await admin
      .from("feedback_submissions")
      .select("id, text, email, topic, page_path, ip_hash, status, admin_notes, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    rows = (data ?? []) as Row[];
  } catch {
    // SQL outage → admin vede doar Redis entries (sau lista goala).
  }

  // Redis feedback — mesaje scrise via /api/feedback (FeedbackBox,
  // ProposePetitieForm, etc.). Mutat aici 2026-05-25 din /admin/analytics.
  // 2026-05-27 — defensive try/catch. Upstash rate-limit (10k/day free tier)
  // sau API outage NU trebuie să crash-eze toată pagina /admin/feedback
  // (SQL list încă util fără Redis entries).
  const redisEntries: RedisFeedbackEntry[] = [];
  if (analyticsRedis) {
    try {
      const raw = await analyticsRedis.lrange("civia:feedback:messages", 0, 199);
      for (const s of raw) {
        try {
          const entry =
            typeof s === "string"
              ? (JSON.parse(s) as RedisFeedbackEntry)
              : (s as RedisFeedbackEntry);
          redisEntries.push(entry);
        } catch {
          // skip malformed
        }
      }
    } catch {
      // Redis outage → afișăm doar SQL feedback, fără Redis entries.
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin"
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
        >
          ← Admin home
        </Link>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-extrabold mt-2">
          Feedback / Contact
        </h1>
      </div>

      <FeedbackInbox redisEntries={redisEntries} sqlCount={rows.length} />
      <FeedbackList rows={rows} />
    </div>
  );
}

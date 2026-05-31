import type { Metadata } from "next";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { ALL_COUNTIES, getCountyBySlug } from "@/data/counties";

/**
 * 🎁 MEDIUM #12 — Embed widget pentru jurnaliști + blogs.
 *
 * Iframe-friendly page: `<iframe src="https://www.civia.ro/embed/sesizari/cj?count=5">`
 *
 * Lightweight (no full layout), CORS-open, cache 5 min.
 */

export const dynamic = "force-dynamic";
export const revalidate = 300; // 5 min cache

type Params = Promise<{ judet: string }>;
type SearchParams = Promise<{ count?: string }>;

export async function generateMetadata(
  { params }: { params: Params },
): Promise<Metadata> {
  const { judet } = await params;
  const county = getCountyBySlug(judet);
  return {
    title: `Sesizări Civia ${county?.name ?? ""} — embed`,
    robots: { index: false, follow: false }, // embed pages NU indexate
  };
}

export async function generateStaticParams() {
  return ALL_COUNTIES.map((c) => ({ judet: c.slug }));
}

export default async function EmbedSesizari({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { judet } = await params;
  const { count = "5" } = await searchParams;
  const limit = Math.max(1, Math.min(20, parseInt(count, 10) || 5));

  const county = getCountyBySlug(judet);
  if (!county) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui, sans-serif", color: "#666" }}>
        Județ necunoscut.
      </div>
    );
  }

  const admin = createSupabaseAdmin();
  const { data: sesizari } = await admin
    .from("sesizari_feed")
    .select("code, titlu, tip, status, locatie, created_at")
    .eq("county", county.id)
    .eq("publica", true)
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);

  const { count: totalResolved } = await admin
    .from("sesizari")
    .select("id", { count: "exact", head: true })
    .eq("county", county.id)
    .eq("status", "rezolvat");

  const { count: totalActive } = await admin
    .from("sesizari")
    .select("id", { count: "exact", head: true })
    .eq("county", county.id)
    .neq("status", "rezolvat");

  const items = (sesizari ?? []) as Array<{
    code: string;
    titlu: string;
    tip: string;
    status: string;
    locatie: string;
    created_at: string;
  }>;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #111; background: #fff; }
        a { color: #059669; text-decoration: none; }
        a:hover { text-decoration: underline; }
      `}</style>
      <div style={{ padding: 16, maxWidth: 720 }}>
        <header style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: 8, marginBottom: 12 }}>
          <h1 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
            Sesizări Civia · {county.name}
          </h1>
          <p style={{ fontSize: 12, color: "#666" }}>
            {totalResolved ?? 0} rezolvate · {totalActive ?? 0} în lucru
          </p>
        </header>
        <ul style={{ listStyle: "none" }}>
          {items.map((s) => (
            <li
              key={s.code}
              style={{
                padding: "8px 0",
                borderBottom: "1px solid #f3f4f6",
                fontSize: 13,
              }}
            >
              <a
                href={`https://www.civia.ro/sesizari/${s.code}`}
                target="_blank"
                rel="noopener"
              >
                <strong>{s.titlu}</strong>
              </a>
              <div style={{ color: "#666", fontSize: 11, marginTop: 2 }}>
                {s.tip} · {s.locatie?.slice(0, 60)}
                {s.status === "rezolvat" && " · ✓ rezolvat"}
              </div>
            </li>
          ))}
        </ul>
        <footer
          style={{
            marginTop: 12,
            paddingTop: 8,
            borderTop: "1px solid #e5e7eb",
            fontSize: 11,
            color: "#666",
            textAlign: "right",
          }}
        >
          via{" "}
          <a href="https://www.civia.ro" target="_blank" rel="noopener">
            Civia.ro
          </a>
        </footer>
      </div>
    </>
  );
}

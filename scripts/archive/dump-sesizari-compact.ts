/**
 * Versiune COMPACTĂ a dump-ului. Per sesizare: 1 bloc condensed,
 * fără email complet (doar primele 200 chars).
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

function fmt(d: string) { return d.replace("T", " ").slice(0, 16); }

async function main() {
  const { data, count } = await sa
    .from("sesizari")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  type R = {
    id: string; code: string; user_id: string | null;
    author_name: string; author_email: string | null; author_address: string | null;
    tip: string; titlu: string; locatie: string; sector: string | null;
    lat: number; lng: number; descriere: string; formal_text: string | null;
    status: string; imagini: string[] | null; publica: boolean;
    sent_via_civia: boolean | null; sent_at: string | null;
    sent_to_emails: string[] | null;
    created_at: string;
  };
  const rows = (data ?? []) as R[];

  const ids = rows.map((r) => r.id);
  const [repliesRes, votesRes, signsRes, followsRes] = await Promise.all([
    sa.from("sesizare_replies").select("sesizare_id, from_email, ai_status, ai_summary").in("sesizare_id", ids),
    sa.from("sesizare_votes").select("sesizare_id, value").in("sesizare_id", ids),
    sa.from("sesizare_cosigners").select("sesizare_id").in("sesizare_id", ids),
    sa.from("sesizare_follows").select("sesizare_id").in("sesizare_id", ids),
  ]);

  const replyMap = new Map<string, number>();
  for (const r of (repliesRes.data ?? []) as Array<{ sesizare_id: string }>) {
    replyMap.set(r.sesizare_id, (replyMap.get(r.sesizare_id) ?? 0) + 1);
  }
  const voteMap = new Map<string, { up: number; down: number }>();
  for (const v of (votesRes.data ?? []) as Array<{ sesizare_id: string; value: number }>) {
    const c = voteMap.get(v.sesizare_id) ?? { up: 0, down: 0 };
    if (v.value > 0) c.up += 1; else c.down += 1;
    voteMap.set(v.sesizare_id, c);
  }
  const signMap = new Map<string, number>();
  for (const s of (signsRes.data ?? []) as Array<{ sesizare_id: string }>) {
    signMap.set(s.sesizare_id, (signMap.get(s.sesizare_id) ?? 0) + 1);
  }
  const followMap = new Map<string, number>();
  for (const f of (followsRes.data ?? []) as Array<{ sesizare_id: string }>) {
    followMap.set(f.sesizare_id, (followMap.get(f.sesizare_id) ?? 0) + 1);
  }

  console.log(`TOTAL: ${count}\n`);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const v = voteMap.get(r.id) ?? { up: 0, down: 0 };
    const replies = replyMap.get(r.id) ?? 0;
    const signs = signMap.get(r.id) ?? 0;
    const follows = followMap.get(r.id) ?? 0;
    const sectorTxt = r.sector ?? "—";
    const sentTxt = r.sent_via_civia ? `✓ ${fmt(r.sent_at ?? "")}` : "✗";
    const dest = r.sent_to_emails?.join(", ") ?? "—";
    const descShort = r.descriere.replace(/\n+/g, " ").slice(0, 180);

    console.log(`#${rows.length - i}. [${r.code}] ${r.titlu}`);
    console.log(`   📅 ${fmt(r.created_at)} | tip=${r.tip} | status=${r.status} | sector=${sectorTxt} | publică=${r.publica ? "DA" : "NU"}`);
    console.log(`   👤 ${r.author_name}${r.author_email ? ` <${r.author_email}>` : ""}${r.author_address ? ` • adresă: ${r.author_address}` : ""}`);
    console.log(`   📍 ${r.locatie}`);
    console.log(`   🗺️  ${r.lat}, ${r.lng}`);
    console.log(`   📝 ${descShort}${r.descriere.length > 180 ? "…" : ""}`);
    console.log(`   🖼️  poze=${r.imagini?.length ?? 0} | formal_text=${r.formal_text?.length ?? 0}c`);
    console.log(`   🚀 trimis=${sentTxt}`);
    console.log(`   📧 destinatari: ${dest}`);
    console.log(`   📊 voturi=${v.up}/${v.down} | co-semnări=${signs} | follows=${follows} | replies=${replies}`);
    console.log("");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

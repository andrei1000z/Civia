import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/auth/constant-time";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://civia.ro";

/**
 * 2026-06-05 — MASTER DAILY CRON (dispecer).
 *
 * Vercel Hobby permite MAX 2 cron-uri (1×/zi). Înainte erau programate doar
 * /api/sesizari/reminders → digestul de newsletter, weekly-rezolvate,
 * auto-status și drafts/nudge NU porneau automat niciodată.
 *
 * Soluție: UN singur cron zilnic care declanșează sub-job-urile potrivite zilei.
 * Fiecare sub-endpoint e o invocare serverless SEPARATĂ (GET + Bearer
 * CRON_SECRET) — deci, chiar dacă acest master expiră la 60s, sub-job-urile
 * rulează independent până la capăt.
 *
 *   ZILNIC : reminders, auto-status, drafts/nudge
 *   LUNI   : newsletter/digest (Săptămâna civică)
 *   VINERI : newsletter/weekly-rezolvate
 *
 * Vercel adaugă automat `Authorization: Bearer ${CRON_SECRET}` la cererile de
 * cron când CRON_SECRET e setat — la fel ca sub-endpoint-urile.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!verifyBearer(auth, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const day = new Date().getUTCDay(); // 0=Duminică, 1=Luni … 5=Vineri
  const jobs: string[] = [
    "/api/sesizari/reminders",
    "/api/sesizari/auto-status",
    "/api/sesizari/drafts/nudge",
    // 2026-06-09 (roadmap Faza 0) — streak win-back. Endpoint-ul exista dar NU
    // era chemat de nicăieri (bucla de retenție era moartă) → acum rulează zilnic.
    "/api/streaks/at-risk",
    // 2026-06-09 (roadmap Faza 1) — chaser a-doua-acțiune: la ~48h după prima
    // sesizare fără a doua acțiune, email „Ce s-a mai raportat în {oraș}".
    "/api/sesizari/winback",
    // 2026-06-10 (conformitate UE) — aplică retenția promisă: anonimizează
    // co-semnatari la sesizări închise >90z + sesizări anonime >3 ani.
    "/api/cron/purge-retention",
    // 2026-06-12 — digest „coada de inbox neprocesată": răspunsuri de autoritate
    // (sancțiuni/intervenții/orfani) care nu s-au auto-aplicat → email admin.
    // Are throttle intern (trimite la schimbare sau săptămânal; zero pe coadă curată).
    "/api/inbox/pending-digest",
  ];
  if (day === 1) jobs.push("/api/newsletter/digest"); // Luni
  if (day === 2) jobs.push("/api/newsletter/digest-local"); // Marți (Faza 2 — digest local pe zonă)
  if (day === 5) jobs.push("/api/newsletter/weekly-rezolvate"); // Vineri
  // 2026-06-12 (FAZA 4 it.2) — ziua 1 a lunii: transmiterea formală a topului
  // „Prioritățile orașului" către primării. Pragurile anti-„cameră goală" +
  // idempotența (28 zile) sunt ÎN endpoint — fără voturi suficiente nu pleacă nimic.
  if (new Date().getUTCDate() === 1) jobs.push("/api/bp/transmite");

  const run = (path: string) =>
    fetch(`${SITE}${path}`, { method: "GET", headers: { Authorization: `Bearer ${secret}` } })
      .then((r) => ({ path, status: r.status, ok: r.ok }))
      .catch((e) => ({ path, status: 0, ok: false, error: e instanceof Error ? e.message : String(e) }));

  const settled = await Promise.allSettled(jobs.map(run));
  const ran = settled.map((s) => (s.status === "fulfilled" ? s.value : { ok: false, error: "rejected" }));

  return NextResponse.json({ ok: true, day, dispatched: jobs.length, ran });
}

/**
 * 2026-05-27 — Backfill `sent_via_civia=true` + `sent_to_emails` retroactiv
 * pentru sesizările care au primit răspunsuri de la primării.
 *
 * Context (audit inbox): 7/10 sesizări cu răspunsuri au sent_via_civia=false
 * și sent_to_emails=[] — adică nu avem audit-trail al destinatarilor, blocând
 * cross-check anti-spoof + atribuire corectă.
 *
 * Logica: pentru fiecare sesizare cu cel puțin 1 reply, marcăm
 * sent_via_civia=true și populăm sent_to_emails cu lista distinctă a
 * from_email de la respondenți (proxy pentru destinatarii originali —
 * primăriile răspund din aceleași inbox-uri unde Civia trimite).
 *
 * Run: npx tsx scripts/backfill-sent-via-civia.ts [--apply]
 */

import { config } from "dotenv";
import { existsSync } from "fs";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const h = { apikey: key, Authorization: `Bearer ${key}` };
const apply = process.argv.includes("--apply");

interface Reply {
  sesizare_id: string;
  from_email: string;
  received_at: string;
}

async function main() {
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}\n`);

  // 1. Fetch all replies cu sesizare_id non-null
  const r = await fetch(
    `${url}/rest/v1/sesizare_replies?select=sesizare_id,from_email,received_at&sesizare_id=not.is.null&order=received_at.asc`,
    { headers: h },
  );
  const replies = (await r.json()) as Reply[];
  console.log(`Replies cu sesizare matched: ${replies.length}`);

  // 2. Group by sesizare_id → unique sender emails + earliest reply timestamp
  const bySesizare = new Map<string, { emails: Set<string>; firstReply: string }>();
  for (const reply of replies) {
    if (!bySesizare.has(reply.sesizare_id)) {
      bySesizare.set(reply.sesizare_id, { emails: new Set(), firstReply: reply.received_at });
    }
    const entry = bySesizare.get(reply.sesizare_id)!;
    entry.emails.add(reply.from_email.toLowerCase());
  }

  console.log(`Sesizari distincte care au primit răspunsuri: ${bySesizare.size}\n`);

  // 3. Pentru fiecare, verifică starea curentă și actualizează dacă lipsește
  let toUpdate = 0;
  const updates: Array<{ id: string; emails: string[]; firstReply: string }> = [];
  for (const [sesizareId, info] of bySesizare) {
    const sr = await fetch(
      `${url}/rest/v1/sesizari?id=eq.${sesizareId}&select=id,code,sent_via_civia,sent_to_emails,sent_at,delivery_status`,
      { headers: h },
    );
    const rows = await sr.json();
    if (!rows[0]) continue;
    const s = rows[0];
    const needsUpdate =
      !s.sent_via_civia ||
      !s.sent_to_emails ||
      (Array.isArray(s.sent_to_emails) && s.sent_to_emails.length === 0) ||
      !s.sent_at ||
      !s.delivery_status;
    if (needsUpdate) {
      toUpdate++;
      const emails = Array.from(info.emails);
      console.log(`  ⏳ ${s.code} (${sesizareId.slice(0, 8)}…) — ${emails.length} respondent(s): ${emails.slice(0, 3).join(", ")}${emails.length > 3 ? "…" : ""}`);
      updates.push({ id: sesizareId, emails, firstReply: info.firstReply });
    }
  }

  console.log(`\nTotal sesizari de actualizat: ${toUpdate}`);

  if (!apply) {
    console.log("\nDry run. Pasează --apply ca să scriem în DB.");
    return;
  }

  // 4. Apply updates
  let applied = 0;
  for (const u of updates) {
    const res = await fetch(`${url}/rest/v1/sesizari?id=eq.${u.id}`, {
      method: "PATCH",
      headers: {
        ...h,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        sent_via_civia: true,
        sent_to_emails: u.emails,
        // sent_at = first reply timestamp (proxy — nu avem timestamp-ul real
        // de trimitere, dar răspunsul autorității oferă bound superior)
        sent_at: u.firstReply,
        // delivery_status: 'delivered' — confirmat de răspunsul autorității
        delivery_status: "delivered",
        delivered_at: u.firstReply,
      }),
    });
    if (res.ok) {
      applied++;
    } else {
      console.error(`  ✗ Failed ${u.id.slice(0, 8)}: ${res.status} ${await res.text()}`);
    }
  }

  console.log(`\n✓ ${applied}/${toUpdate} sesizari actualizate cu audit-trail retroactiv.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

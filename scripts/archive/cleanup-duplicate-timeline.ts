// One-shot cleanup: remove consecutive duplicate timeline rows that
// the admin status route + ticket approval route used to produce
// before `appendTimelineEvent` started deduping at write time.
//
// Rule (must match `appendTimelineEvent` in
// `src/lib/sesizari/timeline-writer.ts`): a row is a duplicate when the
// IMMEDIATELY-PRECEDING row in the same sesizare has the same
// event_type AND the row's description is generic (null, empty, or the
// "Status actualizat la: <status>" auto-text).
//
// Run with: `npx tsx scripts/cleanup-duplicate-timeline.ts`. Reports
// what would be deleted in dry-run mode unless --apply is passed.

import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}

const apply = process.argv.includes("--apply");

interface TimelineRow {
  id: string;
  sesizare_id: string;
  event_type: string;
  description: string | null;
  created_at: string;
}

async function fetchAll(): Promise<TimelineRow[]> {
  const r = await fetch(
    `${url}/rest/v1/sesizare_timeline?select=id,sesizare_id,event_type,description,created_at&order=sesizare_id.asc,created_at.asc`,
    {
      headers: {
        apikey: key!,
        Authorization: "Bearer " + key,
        Prefer: "count=exact",
      },
    },
  );
  if (!r.ok) {
    console.error(`fetch failed: ${r.status} ${await r.text()}`);
    process.exit(1);
  }
  return (await r.json()) as TimelineRow[];
}

function isGenericDescription(eventType: string, description: string | null): boolean {
  const trimmed = description?.trim() ?? "";
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  return (
    lower === `status actualizat la: ${eventType.toLowerCase()}` ||
    lower === `status actualizat: ${eventType.toLowerCase()}`
  );
}

async function deleteRows(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const filter = `id=in.(${ids.map((id) => `"${id}"`).join(",")})`;
  const r = await fetch(`${url}/rest/v1/sesizare_timeline?${filter}`, {
    method: "DELETE",
    headers: {
      apikey: key!,
      Authorization: "Bearer " + key,
    },
  });
  if (!r.ok) {
    console.error(`delete failed: ${r.status} ${await r.text()}`);
    process.exit(1);
  }
}

async function main() {
  console.log(`Mode: ${apply ? "APPLY (rows will be deleted)" : "DRY-RUN"}`);
  console.log("Fetching timeline rows...");

  const rows = await fetchAll();
  console.log(`Loaded ${rows.length} timeline rows.`);

  // Group by sesizare_id, walk chronologically. Order is already
  // (sesizare_id ASC, created_at ASC) from the query.
  const toDelete: TimelineRow[] = [];
  let prevSesizare: string | null = null;
  let prevEventType: string | null = null;

  for (const row of rows) {
    if (row.sesizare_id !== prevSesizare) {
      prevSesizare = row.sesizare_id;
      prevEventType = row.event_type;
      continue;
    }
    if (
      row.event_type === prevEventType &&
      isGenericDescription(row.event_type, row.description)
    ) {
      toDelete.push(row);
      // Don't update prevEventType — the dup is logically equivalent
      // to the kept row, so the next row should still compare against
      // it. Same as appendTimelineEvent's "latest" pointer.
      continue;
    }
    prevEventType = row.event_type;
  }

  console.log(`\n${toDelete.length} duplicate rows identified.`);
  if (toDelete.length === 0) {
    console.log("Nothing to clean up. ✓");
    return;
  }

  // Show first 10 examples so the operator can sanity-check before
  // committing.
  console.log("\nExamples (first 10):");
  for (const r of toDelete.slice(0, 10)) {
    console.log(
      `  · sesizare=${r.sesizare_id.slice(0, 8)} event=${r.event_type} created_at=${r.created_at}`,
    );
  }

  if (!apply) {
    console.log("\nDry run — pass --apply to actually delete.");
    return;
  }

  // Batch deletes so a single huge URL doesn't break PostgREST.
  const ids = toDelete.map((r) => r.id);
  const BATCH = 100;
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    await deleteRows(slice);
    process.stdout.write(`Deleted ${Math.min(i + BATCH, ids.length)}/${ids.length}\r`);
  }
  console.log(`\nDone. Deleted ${ids.length} rows.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

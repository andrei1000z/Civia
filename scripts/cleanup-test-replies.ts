/**
 * Curata reply-uri test din DB. Ruleaza dupa testul end-to-end pentru a
 * pastra DB-ul curat.
 *
 * Sterge:
 *   1. Reply-uri unde sesizare_id IS NULL (cod necunoscut sau test dummy)
 *   2. Reply-uri pe 00044 care sunt de test (subject contine „TEST" sau
 *      from_email contine „test@")
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  // 1. Sterg orphan-uri (sesizare_id null)
  const { data: orphans } = await sa
    .from("sesizare_replies")
    .select("id, from_email, subject")
    .is("sesizare_id", null);
  console.log(`Orphan replies (sesizare_id null): ${orphans?.length ?? 0}`);
  for (const o of orphans ?? []) {
    console.log(`  - ${o.id} from ${o.from_email}: ${o.subject}`);
  }
  if ((orphans?.length ?? 0) > 0) {
    const { error } = await sa
      .from("sesizare_replies")
      .delete()
      .is("sesizare_id", null);
    if (error) console.error("Delete orphans failed:", error);
    else console.log(`  Deleted ${orphans?.length} orphan replies.`);
  }

  // 2. Test replies pe orice sesizare (subject TEST sau email test@)
  const { data: testReplies } = await sa
    .from("sesizare_replies")
    .select("id, from_email, subject, sesizare_id")
    .or("subject.ilike.%TEST%,from_email.ilike.test@%");
  console.log(`\nTest replies (TEST subject or test@ email): ${testReplies?.length ?? 0}`);
  for (const r of testReplies ?? []) {
    console.log(`  - ${r.id} from ${r.from_email}: ${r.subject}`);
  }
  if ((testReplies?.length ?? 0) > 0) {
    const ids = (testReplies ?? []).map((r) => r.id);
    const { error } = await sa
      .from("sesizare_replies")
      .delete()
      .in("id", ids);
    if (error) console.error("Delete test replies failed:", error);
    else console.log(`  Deleted ${ids.length} test replies.`);
  }
}
main();

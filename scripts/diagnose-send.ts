import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const code = process.argv[2] ?? "00044";

  // Try the same UPDATE the route does to see what error we get.
  const { data: sesizare } = await sa
    .from("sesizari")
    .select("id, code, status")
    .eq("code", code)
    .maybeSingle();

  if (!sesizare) {
    console.error("Sesizarea nu există:", code);
    process.exit(1);
  }

  console.log(`Found sesizare ${code} id=${sesizare.id} status=${sesizare.status}`);

  const dryUpdate = {
    sent_via_civia: true,
    sent_at: new Date().toISOString(),
    sent_to_emails: ["test@example.com"],
    resend_message_id: "test-id",
    ...(sesizare.status === "nou" ? { status: "trimis" } : {}),
  };

  console.log("Dry update payload:", JSON.stringify(dryUpdate, null, 2));

  const { error, data } = await sa
    .from("sesizari")
    .update(dryUpdate)
    .eq("id", sesizare.id)
    .select("id, sent_via_civia, sent_at, status")
    .maybeSingle();

  if (error) {
    console.error("UPDATE ERROR:", error);
    process.exit(1);
  }
  console.log("UPDATE SUCCEEDED:", data);

  // Rollback
  await sa
    .from("sesizari")
    .update({
      sent_via_civia: false,
      sent_at: null,
      sent_to_emails: null,
      resend_message_id: null,
      status: sesizare.status,
    })
    .eq("id", sesizare.id);
  console.log("Rolled back to original state");
}
main();

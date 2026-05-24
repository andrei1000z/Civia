/**
 * Verifica ultimele intrari in inbox_debug_log. Util ca sa vezi DACA
 * Worker-ul Cloudflare pinge-uieste heartbeat-ul SI ce trimite la
 * /api/inbox/reply (auth header, body, etc.).
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
  const { data, error } = await sa
    .from("inbox_debug_log")
    .select("*")
    .order("received_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error(error);
    return;
  }
  console.log(`Latest ${data?.length ?? 0} debug log entries:\n`);
  for (const r of data ?? []) {
    console.log("─".repeat(80));
    console.log(`${r.received_at} | ${r.endpoint.toUpperCase()} | status=${r.http_status ?? "-"} | ip=${r.source_ip}`);
    console.log(`UA: ${r.source}`);
    if (r.error_message) console.log(`Error/Info: ${r.error_message}`);
    if (r.request_headers) {
      const h = r.request_headers as Record<string, string>;
      const interesting = ["authorization", "content-type", "user-agent", "host", "x-forwarded-host"];
      for (const k of interesting) {
        if (h[k]) console.log(`  ${k}: ${h[k]}`);
      }
    }
    if (r.request_body) {
      console.log(`  body[0..200]: ${r.request_body.slice(0, 200).replace(/\n/g, "\\n")}`);
    }
  }
  console.log("─".repeat(80));
}
main();

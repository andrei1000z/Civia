/** Test Cloudflare Workers AI text (OpenAI-compat) pt cascada gratis. */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const acct = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  console.log("account:", acct ? "set" : "MISSING", "token:", token ? "set" : "MISSING");
  const models = [
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "@cf/meta/llama-3.1-8b-instruct-fast",
    "@cf/qwen/qwen2.5-coder-32b-instruct",
  ];
  for (const model of models) {
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/v1/chat/completions`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: "Reformulează în română oficială, doar textul, fără preambul." },
              { role: "user", content: "sa monteze stalpisori in plm ca trec masinile pe trotuar" },
            ],
            temperature: 0.2,
            max_tokens: 200,
          }),
          signal: AbortSignal.timeout(30000),
        },
      );
      const txt = await res.text();
      let out = txt;
      try { out = JSON.parse(txt).choices?.[0]?.message?.content ?? txt; } catch {}
      console.log(`\n${model}: HTTP ${res.status}`);
      console.log(`  → ${String(out).slice(0, 200)}`);
    } catch (e) {
      console.log(`\n${model}: ERR ${(e as Error).message}`);
    }
  }
}
main();

/**
 * Aplică migration 061_actualizari.sql direct via Supabase REST.
 * Folosește exec_sql RPC dacă există, altfel folosește split-statements
 * + queries directe pentru a crea tabela.
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const sqlPath = join(process.cwd(), "supabase", "migrations", "061_actualizari.sql");
  const sql = readFileSync(sqlPath, "utf-8");

  console.log("📄 Loaded migration 061_actualizari.sql");
  console.log(`   ${sql.length} chars\n`);

  // Try via exec_sql RPC first
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`;
  console.log(`▶ POST ${url}`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql }),
  });

  if (res.ok) {
    const j = await res.json().catch(() => ({}));
    console.log("✅ Migration aplicată via exec_sql:", j);
    // Verify table exists
    const { count, error } = await sa
      .from("actualizari")
      .select("*", { count: "exact", head: true });
    if (error) {
      console.log("⚠️ Verify failed:", error.message);
    } else {
      console.log(`✓ Tabela actualizari exists, ${count} rows`);
    }
    return;
  }

  const errText = await res.text();
  console.log(`❌ exec_sql failed: ${res.status} — ${errText.slice(0, 300)}`);
  console.log("\n→ Falling back: încearcă să verific dacă tabela există deja sau nu...");

  // Test direct insert (fail gracefully)
  const { error: testErr } = await sa
    .from("actualizari")
    .select("versiune", { head: true, count: "exact" })
    .limit(1);

  if (!testErr) {
    console.log("✓ Tabela actualizari există deja — verific dacă v0.0.0 e seeded");
    const { data: v000 } = await sa
      .from("actualizari")
      .select("*")
      .eq("versiune", "0.0.0")
      .maybeSingle();
    if (v000) {
      console.log("✓ v0.0.0 deja există, totul OK!");
    } else {
      console.log("⚠️ Tabela există dar v0.0.0 lipsește, insert acum...");
      const { error: insErr } = await sa.from("actualizari").insert({
        versiune: "0.0.0",
        data: "2026-05-23T12:50:00+03:00",
        titlu: "Civia se naște",
        descriere: null,
        schimbari: [],
        major: false,
        minimalist: true,
        continut_markdown: `**Civia** este o platformă civică independentă pentru România.

Cetățenii pot trimite **sesizări oficiale** către primării, prefecturi, Poliția Locală sau CNAIR în **90 de secunde**, conform legii **OG 27/2002**.

### Ce face Civia chiar acum:

- 📸 **Camera AI** — fotografiezi problema, iar inteligența artificială detectează automat tipul și autoritatea competentă
- ✍️ **AI scrie textul formal** cu temei legal românesc — tu doar revizuiești și apeși *Trimite*
- 📬 **Trimitere directă** prin \`sesizari@civia.ro\` — fără mailto, fără atașări manuale
- 🔔 **Urmărire automată** — când primăria răspunde, AI clasifică răspunsul și te notifică
- 🤝 **Co-trimitere** — alți cetățeni pot apăsa *Trimite și tu* cu identitatea lor
- 🗺️ **Acoperire națională** — 42 județe + 6 sectoare București + 220 orașe + 1500 autorități
- 🤖 **Civic Assistant** — chatbot AI pentru drepturile tale civice
- 📚 **Conținut educațional** — Glosar 50 termeni, ghiduri, drepturile cetățeanului
- 📊 **Date deschise** — statistici live, API public CC BY 4.0
- 📱 **PWA installabil** — offline, push notifications native, camera 1-tap

Civia este **gratuită**, **fără reclame** și **fără cont obligatoriu**. Misiunea: democratizarea informației civice în România.`,
        published: true,
      });
      if (insErr) {
        console.log("❌ Insert eșuat:", insErr.message);
      } else {
        console.log("✅ v0.0.0 inserat cu succes!");
      }
    }
    return;
  }

  console.log("\n❌ Tabela actualizari NU există și exec_sql RPC NU e configurată.");
  console.log("\nFix manual: deschide Supabase Dashboard → SQL Editor →");
  console.log("            paste conținutul din supabase/migrations/061_actualizari.sql");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

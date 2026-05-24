/**
 * Backfill formal_text pentru TOATE sesizările existente folosind
 * template-ul nou determinist. Înlocuiește output-ul AI vechi
 * (cu „Subsemnatul", „Vă sesizez", placeholder-uri, etc.) cu format
 * uniform.
 *
 * Identitate (nume + adresă) e dedusă din author_name + locatie cetățean.
 * Adresa cetățeanului nu e stocată separat — folosim locația sesizării.
 * Asta-i ok pentru re-generare: în template, „locuiesc în {adresa}" e
 * adresa CETĂȚEANULUI. Pentru sesizările vechi unde nu avem asta, omitem
 * paragraful „Mă numesc..." și începem direct cu „Doresc să vă aduc...".
 *
 * NOTE: scriptul folosește data ORIGINALĂ a sesizării (created_at), nu
 * data de azi — semnătura reflectă când a fost trimisă inițial.
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { generateFormalText } from "../src/lib/sesizari/formal-template";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const onlyCode = process.argv.find((a) => a.startsWith("--code="))?.split("=")[1];

  let query = sa
    .from("sesizari")
    .select("id, code, tip, locatie, author_name, imagini, created_at, formal_text")
    .order("created_at", { ascending: true });
  if (onlyCode) query = query.eq("code", onlyCode);

  const { data, error } = await query;
  if (error) {
    console.error("Query error:", error);
    process.exit(1);
  }
  const rows = (data ?? []) as Array<{
    id: string;
    code: string;
    tip: string;
    locatie: string;
    author_name: string | null;
    imagini: string[] | null;
    created_at: string;
    formal_text: string | null;
  }>;

  let updated = 0;
  let unchanged = 0;

  // Extrage adresa cetățeanului din textul vechi (formal_text-ul vechi
  // are forma „Mă numesc X și locuiesc în Y" — vrem să păstrăm Y).
  function extractAdresa(oldText: string | null): string | null {
    if (!oldText) return null;
    // Capturăm tot ce vine după „locuiesc în" / „domiciliat în" până la
    // un marker clar de continuare: „mă adresez", „și doresc", „vă adresez",
    // „și mă", „, mă", sau punct + literă mare. Adresele pot conține virgule
    // (ap, etaj, sector) deci [^,] nu funcționează.
    // Markers care indică sfârșitul adresei (fraza care urmează în text).
    // NU folosim „punct + literă mare" ca terminator pentru că „Str." e
    // abreviere comună („Str. Țintasului").
    const TERM = /(?:și\s+doresc|și\s+mă\s+adresez|mă\s+adresez|vă\s+adresez|doresc\s+să|\.\s*\n)/i.source;
    const patterns = [
      new RegExp(`(?:Mă numesc|Subsemnat[ăa]?l?[au]?)\\s+[^\\n]+?(?:și\\s+)?locuiesc\\s+(?:în|pe)\\s+(.+?)\\s*[,.]?\\s*${TERM}`, "i"),
      new RegExp(`(?:domiciliat[ăa]?)\\s+(?:în|pe)\\s+(.+?)\\s*[,.]?\\s*${TERM}`, "i"),
    ];
    for (const rx of patterns) {
      const m = oldText.match(rx);
      if (m?.[1]) {
        const addr = m[1].trim().replace(/^(?:în|pe)\s+/i, "");
        if (addr.length > 5 && addr.length < 200) return addr;
      }
    }
    return null;
  }

  for (const row of rows) {
    const extractedAdresa = extractAdresa(row.formal_text);
    const newText = generateFormalText({
      tip: row.tip ?? "altele",
      locatie: row.locatie ?? "",
      nume: row.author_name,
      adresa: extractedAdresa,
      hasPhotos: Array.isArray(row.imagini) && row.imagini.length > 0,
      date: new Date(row.created_at),
    });

    if (newText === row.formal_text) {
      unchanged++;
      continue;
    }

    if (dryRun) {
      console.log(`[DRY] ${row.code} | ${row.tip} | ${row.locatie.slice(0, 50)}`);
      console.log(`  OLD: ${(row.formal_text ?? "").slice(0, 100)}`);
      console.log(`  NEW: ${newText.slice(0, 100)}`);
      console.log();
      updated++;
      continue;
    }

    const { error: updErr } = await sa
      .from("sesizari")
      .update({ formal_text: newText })
      .eq("id", row.id);
    if (updErr) {
      console.error(`[${row.code}] update failed:`, updErr);
      continue;
    }
    updated++;
    console.log(`[${row.code}] ✓ updated`);
  }

  console.log(`\nDone. Updated: ${updated}, Unchanged: ${unchanged}, Total: ${rows.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

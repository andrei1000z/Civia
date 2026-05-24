// Verifică DNS MX records pentru toate domeniile email din autoritati-contact.
// Output: lista domains care nu au MX → email-uri probabil fabricate.
// Nu modifică nimic.
//
// Usage: npm run verify:emails
//
// Strategy: deduplicăm domain-urile (multe entries share același domain),
// verificăm MX o dată per domain, raportăm count + status. Lookup parallel
// cu cap (15 simultaneous) ca să nu DDoS DNS resolver.

import { resolveMx } from "node:dns/promises";
import {
  PREFECTURI,
  PRIMARII,
  POLITIA_LOCALA_JUDET,
  ORASE_IMPORTANTE,
} from "../src/data/autoritati-contact";

interface AuthorityContact {
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
}

function collectEmails(records: Record<string, AuthorityContact>): string[] {
  return Object.values(records)
    .map((r) => r.email)
    .filter((e): e is string => typeof e === "string" && e.includes("@"));
}

function collectFromOrase(): string[] {
  // ORASE_IMPORTANTE has nested structure — adapt
  const emails: string[] = [];
  for (const city of Object.values(ORASE_IMPORTANTE) as Array<{ primarie?: AuthorityContact }>) {
    if (city.primarie?.email && city.primarie.email.includes("@")) {
      emails.push(city.primarie.email);
    }
  }
  return emails;
}

const allEmails = [
  ...collectEmails(PREFECTURI),
  ...collectEmails(PRIMARII),
  ...collectEmails(POLITIA_LOCALA_JUDET),
  ...collectFromOrase(),
];

const domains = Array.from(new Set(allEmails.map((e) => e.split("@")[1]?.toLowerCase()).filter(Boolean))) as string[];

console.log(`Verifying ${domains.length} unique domains (${allEmails.length} total emails)...\n`);

const CONCURRENT = 15;
const results: Array<{ domain: string; ok: boolean; mx?: string[]; error?: string }> = [];

async function checkDomain(domain: string): Promise<void> {
  try {
    const mx = await resolveMx(domain);
    if (mx.length === 0) {
      results.push({ domain, ok: false, error: "no MX records" });
    } else {
      results.push({ domain, ok: true, mx: mx.map((m) => `${m.exchange}:${m.priority}`) });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    results.push({ domain, ok: false, error: msg });
  }
}

// Process in batches of CONCURRENT
async function run() {
  for (let i = 0; i < domains.length; i += CONCURRENT) {
    const batch = domains.slice(i, i + CONCURRENT);
    await Promise.all(batch.map(checkDomain));
    process.stdout.write(`\r${Math.min(i + CONCURRENT, domains.length)}/${domains.length}...`);
  }
  process.stdout.write("\n\n");

  const bad = results.filter((r) => !r.ok);
  const good = results.filter((r) => r.ok);

  console.log(`OK: ${good.length} domains have MX records`);
  console.log(`BAD: ${bad.length} domains MISSING MX or unreachable\n`);

  if (bad.length > 0) {
    console.log("=== Domains FĂRĂ MX (probabil emails fabricated): ===");
    for (const r of bad.sort((a, b) => a.domain.localeCompare(b.domain))) {
      const sampleEmails = allEmails.filter((e) => e.split("@")[1]?.toLowerCase() === r.domain).slice(0, 2);
      console.log(`  ${r.domain.padEnd(40)} ${r.error}  (e.g. ${sampleEmails.join(", ")})`);
    }
    process.exit(1);
  }
  console.log("✓ Toate domeniile au MX records valide.");
}

run().catch((e) => {
  console.error("Script failed:", e);
  process.exit(2);
});

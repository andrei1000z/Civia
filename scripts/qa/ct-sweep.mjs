import { readFileSync, writeFileSync } from "fs";
const IMPORT = `import { verifyBearer } from "@/lib/auth/constant-time";`;
const ANCHOR = `import { NextResponse } from "next/server";`;
const PAIRS = [
  ["const isCron = cronSecret && auth === `Bearer ${cronSecret}`;", "const isCron = verifyBearer(auth, cronSecret);"],
  ["const viaBearer = !!cronSecret && authHeader === `Bearer ${cronSecret}`;", "const viaBearer = verifyBearer(authHeader, cronSecret);"],
  ["if (cronSecret && auth === `Bearer ${cronSecret}`) return { ok: true, viaCron: true };", "if (verifyBearer(auth, cronSecret)) return { ok: true, viaCron: true };"],
  ["if (cronSecret && auth === `Bearer ${cronSecret}`) return true;", "if (verifyBearer(auth, cronSecret)) return true;"],
  ["if (cronSecret && auth === `Bearer ${cronSecret}`) {", "if (verifyBearer(auth, cronSecret)) {"],
  ["if (auth === `Bearer ${process.env.CRON_SECRET}`) return true;", "if (verifyBearer(auth, process.env.CRON_SECRET)) return true;"],
  ["if (auth !== `Bearer ${secret}`) {", "if (!verifyBearer(auth, secret)) {"],
  ["if (!secret || auth !== `Bearer ${secret}`) {", "if (!verifyBearer(auth, secret)) {"],
];
const FILES = [
  "cron/slow-pages","petitii/scrape-updates","admin/stiri/regenerate-summaries","intreruperi/refresh",
  "newsletter/weekly-rezolvate","intreruperi/buildings/warm","newsletter/digest-local","intreruperi/alerts/dispatch",
  "streaks/at-risk","stiri/fetch","sesizari/auto-status","sesizari/drafts/nudge","sesizari/pattern-detection",
  "sesizari/winback","sesizari/reminders","inbox/reply","cron/daily",
].map(f=>`src/app/api/${f}/route.ts`);
for (const path of FILES) {
  let src = readFileSync(path, "utf8");
  let changed = false;
  for (const [from,to] of PAIRS) { if (src.includes(from)) { src = src.split(from).join(to); changed = true; } }
  if (changed && !src.includes(IMPORT)) {
    src = src.replace(ANCHOR, `${ANCHOR}\n${IMPORT}`);
  }
  if (changed) { writeFileSync(path, src); console.log(`✅ ${path}`); }
  else console.log(`⚠️ NESCHIMBAT ${path}`);
}

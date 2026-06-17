// Definitively pin a live React hydration mismatch in PRODUCTION (no dev mode):
// install a MutationObserver BEFORE hydration, then record exactly which DOM
// nodes React rewrites to correct the server↔client mismatch.
// Usage: node scripts/audit-hydration-mut.mjs [baseUrl] [comma,paths]
import { chromium } from "playwright";

const BASE = process.argv[2] || "https://civia.ro";
const PATHS = (process.argv[3] || "/intreruperi,/cj").split(",");

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "ro-RO" });
  for (const path of PATHS) {
    const p = await ctx.newPage();
    await p.addInitScript(() => {
      window.__mut = [];
      const obs = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.type === "characterData") {
            const oldV = (m.oldValue || "").trim();
            const now = (m.target.textContent || "").trim();
            if (oldV !== now && (oldV || now)) window.__mut.push({ t: "TEXT", old: oldV.slice(0, 90), now: now.slice(0, 90) });
          } else if (m.type === "childList" && (m.removedNodes.length || m.addedNodes.length)) {
            const rem = [...m.removedNodes].map((n) => (n.textContent || "").trim().slice(0, 70)).filter(Boolean);
            const add = [...m.addedNodes].map((n) => (n.textContent || "").trim().slice(0, 70)).filter(Boolean);
            if (rem.length || add.length) {
              const par = (m.target.tagName || "?") + (m.target.id ? "#" + m.target.id : "") + "." + String(m.target.className || "").slice(0, 35);
              window.__mut.push({ t: "CHILD", par, rem, add });
            }
          } else if (m.type === "attributes") {
            const el = m.target;
            const now = el.getAttribute ? el.getAttribute(m.attributeName) : null;
            if ((m.oldValue || "") !== (now || "")) {
              window.__mut.push({ t: "ATTR", attr: m.attributeName, tag: (el.tagName || "?") + "." + String(el.className || "").slice(0, 30), old: (m.oldValue || "").slice(0, 90), now: (now || "").slice(0, 90) });
            }
          }
        }
      });
      obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true, characterDataOldValue: true, attributes: true, attributeOldValue: true });
    });
    let muts = [];
    try {
      await p.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 25000 });
      await p.waitForTimeout(3500);
      muts = await p.evaluate(() => window.__mut || []);
    } catch (e) {
      console.log(`  (nav/eval err: ${String(e).slice(0, 70)}) — retry...`);
      try { await p.waitForTimeout(1500); muts = await p.evaluate(() => window.__mut || []); } catch { /* */ }
    }
    console.log(`\n===== ${path} =====  (${muts.length} mutații în timpul hydration)`);
    // filtrează zgomotul de framework (clase tranziție-temă, style toggles fără semantică)
    const noise = (m) => m.t === "ATTR" && /^(class|style)$/.test(m.attr) && /theme-ready|transition/.test((m.old || "") + (m.now || ""));
    muts.filter((m) => !noise(m)).slice(0, 22).forEach((m) => {
      if (m.t === "TEXT") console.log(`  TEXT: "${m.old}"  →  "${m.now}"`);
      else if (m.t === "ATTR") console.log(`  ATTR [${m.attr}] @${m.tag}: "${m.old}"  →  "${m.now}"`);
      else console.log(`  CHILD @${m.par}\n        -[${m.rem.join(" | ").slice(0, 120)}]\n        +[${m.add.join(" | ").slice(0, 120)}]`);
    });
    await p.close();
  }
  await browser.close();
}
main().catch((e) => { console.error(String(e).slice(0, 200)); process.exit(1); });

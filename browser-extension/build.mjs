#!/usr/bin/env node
/**
 * Civia Lens — minimal build script.
 *
 * Copy source files into `dist/` ready for ZIP packaging.
 * No bundler needed — extension is small enough that source = dist.
 *
 * Usage:
 *   node build.mjs
 *   # Then zip dist/ → civia-lens.zip
 *   # Upload la Chrome Web Store / Mozilla Add-ons
 */

import { promises as fs } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "dist");

async function copyFile(src, dest) {
  await fs.mkdir(dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

async function build() {
  // Clean dist
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });

  // Files to include
  const files = [
    "manifest.json",
    "background.js",
    "popup.html",
    "content/facebook-badges.js",
  ];

  for (const file of files) {
    const src = join(__dirname, file);
    const dest = join(DIST, file);
    await copyFile(src, dest);
    console.log(`✓ ${file}`);
  }

  // Icons folder — placeholder if not present (extension store requires them)
  const iconsDir = join(__dirname, "icons");
  try {
    await fs.access(iconsDir);
    await fs.cp(iconsDir, join(DIST, "icons"), { recursive: true });
    console.log("✓ icons/");
  } catch {
    console.warn("⚠ icons/ folder lipseste — adauga icon-16.png, icon-48.png, icon-128.png inainte de release");
  }

  // Read manifest pentru version
  const manifest = JSON.parse(await fs.readFile(join(__dirname, "manifest.json"), "utf-8"));
  console.log(`\n✅ Build complet pentru Civia Lens v${manifest.version}`);
  console.log(`   Dist: ${DIST}`);
  console.log(`   Next: cd dist && zip -r ../civia-lens.zip .`);
}

build().catch((e) => {
  console.error("Build failed:", e);
  process.exit(1);
});

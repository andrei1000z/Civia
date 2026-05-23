/**
 * Smoke-test bookmarklet generation + verifică decodarea + valid JS.
 */
import { buildDeclicBookmarklet } from "../src/lib/petitii/declic-bookmarklet";

const sample = {
  firstName: "Eduard Andrei",
  lastName: "Mușat",
  email: "musateduardandrei10@gmail.com",
  county: "BUCUREȘTI",
  phone: "+40 722 627 281",
};

const href = buildDeclicBookmarklet(sample);
console.log("Bookmarklet href length:", href.length);
console.log("Starts with javascript: →", href.startsWith("javascript:"));

// Decode + check JS parse
const decoded = decodeURIComponent(href.replace(/^javascript:/, ""));
console.log("\nDecoded JS preview (first 400 chars):");
console.log(decoded.slice(0, 400));
console.log("...");

// Try to parse as JS (will throw if syntax error)
try {
  // eslint-disable-next-line no-new-func
  new Function(decoded);
  console.log("\n✓ JS parses without syntax errors");
} catch (e) {
  console.log("\n❌ JS syntax error:", (e as Error).message);
  process.exit(1);
}

// Check data is properly inlined
if (!decoded.includes("Eduard Andrei")) {
  console.log("❌ firstName not inlined");
  process.exit(1);
}
if (!decoded.includes("BUCURE")) {
  console.log("❌ county not inlined");
  process.exit(1);
}
console.log("✓ Data correctly inlined in bookmarklet");

// Show what would happen on Declic by simulating the regex tests
const testInputDescriptors = [
  "firstname  given-name",
  "lastname  family-name",
  "emailaddress email",
  "region",
  "phone",
  "country", // shouldn't match anything
];
console.log("\n--- Field name detection simulation ---");
for (const desc of testInputDescriptors) {
  const s = desc.toLowerCase();
  let matched = "—";
  if (/given|first|prenume/.test(s)) matched = "firstName";
  else if (/family|last|surname|nume[\s_-]*de[\s_-]*familie|^nume$|^lastname$/.test(s)) matched = "lastName";
  else if (/email|e[\s_-]?mail|mail[\s_-]?address/.test(s)) matched = "email";
  else if (/county|region|judet|județ|district|state/.test(s)) matched = "county";
  else if (/phone|tel|telefon|phone[\s_-]?number/.test(s)) matched = "phone";
  console.log(`  "${desc}" → ${matched}`);
}

// Test end-to-end inbox pipeline: trimite un email cu PDF atașat
// programat via Resend → ajunge la Cloudflare Email Routing →
// Worker v4 upload R2 → backend extracție Gemini → DB update.
//
// Usage: node scripts/test-inbox-pipeline.mjs
//
// Necessită .env.local cu RESEND_API_KEY_DEV setat.

import { Resend } from "resend";
import { config } from "dotenv";
config({ path: ".env.local" });

const RESEND_KEY = process.env.RESEND_API_KEY_DEV;
if (!RESEND_KEY) {
  console.error("❌ RESEND_API_KEY_DEV missing in .env.local");
  process.exit(1);
}

const resend = new Resend(RESEND_KEY);

// PDF minimal valid — 1 page „Hello PDF test 2026-05-27".
// Generat manual, ~700 bytes. Are text-native (extractabil cu unpdf).
const TINY_PDF_BASE64 = `JVBERi0xLjQKJeLjz9MKMyAwIG9iaiA8PC9MZW5ndGggMTEwPj5zdHJlYW0KQlQgL0YxIDE4IFRm
IDcyIDcyMCBUZCAoUHJpbWFyaWEgQnVjdXJlc3RpIFRFU1QpIFRqIEVUCkJUIC9GMSAxMiBUZiA3
MiA2NTAgVGQgKFNlc2l6YXJlYSAwMDAwOSBpbnJlZ2lzdHJhdGEgY3UgbnIgUE1CIDk5OTk5IC8g
MjcuMDUuMjAyNikgVGogRVQKZW5kc3RyZWFtIGVuZG9iagoxIDAgb2JqIDw8L1R5cGUvUGFnZS9N
ZWRpYUJveCBbMCAwIDU5NSA4NDJdL1BhcmVudCAyIDAgUi9SZXNvdXJjZXMgPDwvRm9udCA8PC9G
MSA0IDAgUj4+Pj4vQ29udGVudHMgMyAwIFI+PmVuZG9iagoyIDAgb2JqIDw8L1R5cGUvUGFnZXMv
S2lkcyBbMSAwIFJdL0NvdW50IDE+PmVuZG9iago0IDAgb2JqIDw8L1R5cGUvRm9udC9TdWJ0eXBl
L1R5cGUxL0Jhc2VGb250L0hlbHZldGljYT4+ZW5kb2JqCjUgMCBvYmogPDwvVHlwZS9DYXRhbG9n
L1BhZ2VzIDIgMCBSPj5lbmRvYmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmDQowMDAwMDAw
MTYzIDAwMDAwIG4NCjAwMDAwMDAyNjYgMDAwMDAgbg0KMDAwMDAwMDAxNSAwMDAwMCBuDQowMDAw
MDAwMzEwIDAwMDAwIG4NCjAwMDAwMDAzNzMgMDAwMDAgbg0KdHJhaWxlciA8PC9TaXplIDYvUm9v
dCA1IDAgUj4+CnN0YXJ0eHJlZgo0MTcKJSVFT0Y=`;

// Send test
const result = await resend.emails.send({
  from: "noreply@civia.ro", // domeniu verificat (presupun deja)
  to: "sesizari+TEST3@civia.ro",
  subject: "Re: Sesizare 00009 — confirmare AI extraction PDF",
  text: "Buna ziua, va confirmam ca sesizarea dvs a fost inregistrata. Vedeti atasament PDF.",
  attachments: [
    {
      filename: "raspuns-PMB.pdf",
      content: TINY_PDF_BASE64,
    },
  ],
});

console.log("Resend response:", JSON.stringify(result, null, 2));

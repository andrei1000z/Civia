import { config } from "dotenv";
import { existsSync } from "fs";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });

import { sendEmail, emailTemplate } from "../../src/lib/email/resend";

const body = `
  <p style="font-size:16px;margin:0 0 16px;color:#0f172a">Bună, Mihai! 👋</p>
  <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.65">
    Mulțumim mult pentru mesaj și pentru interesul de a folosi Civia în Craiova!
  </p>
  <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.65">
    <strong>Răspunsul scurt: da, absolut.</strong> Civia este o platformă
    <strong>națională</strong> — nu e dedicată exclusiv Bucureștiului. Poți depune
    sesizări din orice localitate din România, iar noi le direcționăm automat către
    autoritățile <strong>locale</strong> potrivite.
  </p>
  <p style="margin:0 0 8px;color:#334155;font-size:15px;line-height:1.65">
    Concret, pentru o sesizare din <strong>Craiova</strong>, Civia o trimite către:
  </p>
  <ul style="margin:0 0 16px;padding-left:18px;color:#334155;font-size:15px;line-height:1.7">
    <li>🏛️ <strong>Primăria Craiova</strong></li>
    <li>👮 <strong>Poliția Locală Craiova</strong> — când e vorba de parcări, trotuare, ordine publică</li>
    <li>🏢 iar în copie, <strong>Prefectura Dolj</strong>, ca autoritate de control</li>
  </ul>
  <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.65">
    Tot ce trebuie să faci e să scrii adresa cu orașul (ex: <em>„Calea București, Craiova"</em>)
    — sistemul detectează automat județul (Dolj) și alege instituțiile corecte. Textul
    sesizării e formalizat de AI în limbaj oficial, conform OG 27/2002, iar primăria are
    obligația legală să răspundă în maximum 30 de zile.
  </p>
  <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.65">
    Și un <strong>mulțumesc special</strong>: feedback-ul tău ne-a ajutat să descoperim și
    să reparăm chiar azi o mică problemă de direcționare pentru adresele din Craiova. Exact
    pentru asta există butonul de feedback — apreciem enorm. 🙏
  </p>
  <p style="margin:0 0 4px;color:#334155;font-size:15px;line-height:1.65">
    Așteptăm cu drag sesizările tale din Craiova. Dacă te lovești de orice, scrie-ne oricând.
  </p>
`;

const html = emailTemplate({
  title: "Da, Civia funcționează pentru toată România",
  kicker: "RĂSPUNS LA MESAJUL TĂU",
  icon: "🇷🇴",
  preheader: "Civia e o platformă națională — poți depune sesizări și din Craiova.",
  body,
  ctaText: "Fă o sesizare în Craiova",
  ctaUrl: "https://civia.ro/sesizari",
});

const text = `Bună, Mihai!

Mulțumim pentru mesaj! Răspunsul scurt: da, absolut — Civia este o platformă NAȚIONALĂ, nu doar pentru București.

Pentru o sesizare din Craiova, o trimitem către Primăria Craiova, Poliția Locală Craiova și, în copie, Prefectura Dolj. Tu scrii adresa cu orașul (ex: "Calea București, Craiova"), iar sistemul detectează județul (Dolj) și alege instituțiile corecte. Textul e formalizat de AI conform OG 27/2002, iar primăria răspunde în max 30 de zile.

Mulțumim special pentru feedback — ne-a ajutat să reparăm chiar azi o problemă de direcționare pentru Craiova.

Așteptăm cu drag sesizările tale!

Echipa Civia · civia.ro`;

async function main() {
  const res = await sendEmail({
    to: "bugmihai@gmail.com",
    from: "Echipa Civia <contact@civia.ro>",
    replyTo: "contact@civia.ro",
    subject: "Da, Civia funcționează pentru toată România — inclusiv Craiova 🇷🇴",
    html,
    text,
  });
  console.log("REZULTAT:", JSON.stringify(res));
  if (res.ok && res.id) {
    console.log(`✅ TRIMIS — Resend message id: ${res.id}`);
  } else {
    console.log("❌ EȘUAT:", JSON.stringify(res));
    process.exit(1);
  }
}
main();

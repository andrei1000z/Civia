import { config } from "dotenv";
import { existsSync } from "fs";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
import { groqText, GROQ_MODEL_FAST } from "../../src/lib/groq/client";
import { SYSTEM_PROMPT_CLASSIFIER } from "../../src/lib/groq/prompts";

const cases = [
  { code: "00042", expect: "copac", text: "Pe trotuarul Străzii Doctor Constantin Istrati, copacii nu sunt toaletați, ceea ce împiedică mersul pietonilor." },
  { code: "00053", expect: "parcare", text: "Un șofer al unui autoturism Dacia Logan a circulat pe trotuarul destinat pietonilor în intersecția Bulevardul Chișinău cu Bulevardul Pantelimon." },
  { code: "00059", expect: "trotuar", text: "Pe Bulevardul Theodor Pallady nr. 42J, lipsa unui trotuar delimitat pentru pietoni creează o problemă de siguranță. Pietonii sunt forțați să meargă pe carosabil." },
  { code: "00061", expect: "mobilier", text: "Coșurile de gunoi sunt amplasate pe stâlpii de iluminat pe strada Cetatea de Baltă, direct pe carosabil, ceea ce obstrucționează circulația." },
  { code: "00070", expect: "copac/trecere_pietoni", text: "La intersecția Drumul Sării cu Șoseaua Sebastian există o situație periculoasă datorită unui copac cu ramuri și frunziș care blochează vizibilitatea la trecerea de pietoni." },
];

async function main() {
  for (const c of cases) {
    const content = await groqText({
      model: GROQ_MODEL_FAST,
      messages: [
        { role: "system", content: SYSTEM_PROMPT_CLASSIFIER },
        { role: "user", content: c.text },
      ],
      temperature: 0.1, max_tokens: 50, response_format: { type: "json_object" },
    });
    let tip = "?";
    try { tip = JSON.parse(content || "{}").tip ?? "?"; } catch {}
    const ok = c.expect.includes(tip) && tip !== "altele";
    console.log(`[${c.code}] asteptat: ${c.expect.padEnd(22)} -> AI: ${tip.padEnd(16)} ${ok ? "OK" : (tip==="altele"?"INCA ALTELE":"alt tip valid")}`);
  }
}
main();

import { config } from "dotenv";
import { existsSync } from "fs";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
import { getGroqClient } from "../../src/lib/groq/client";
import { SYSTEM_PROMPT_CLASSIFIER } from "../../src/lib/groq/prompts";
async function main() {
  const groq = getGroqClient();
  if (!groq) { console.log("Groq client null (no key local)"); return; }
  const c = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: SYSTEM_PROMPT_CLASSIFIER },
      { role: "user", content: "Pe trotuarul Străzii Doctor Constantin Istrati, copacii nu sunt toaletați, ceea ce împiedică mersul pietonilor." },
    ],
    temperature: 0.1, max_tokens: 50, response_format: { type: "json_object" },
  });
  console.log("00042 (copaci netoaletați) → AI tip:", c.choices[0]?.message?.content?.trim());
}
main().catch(e => console.log("err:", e.message));

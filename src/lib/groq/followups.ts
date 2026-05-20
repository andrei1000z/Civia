import { getGroqClient, GROQ_MODEL_FAST } from "./client";

export interface FollowupAction {
  /** Short label shown as the action chip ("Email consilier", "Plângere Avocatul Poporului"). */
  label: string;
  /** One-sentence rationale shown when expanded. */
  reason: string;
  /** Optional href — relative or full URL. If absent, the chip is informational only. */
  href?: string;
  /** Lucide icon name (e.g. "mail", "scale", "users"). Renderer maps to component. */
  icon: "mail" | "scale" | "users" | "alert" | "share";
}

export interface FollowupsResult {
  actions: FollowupAction[];
  fallback?: boolean;
}

const SYSTEM_PROMPT = `Esti un consilier civic. Userul tocmai a depus o sesizare la o autoritate publica. Sugereaza-i 3 actiuni concrete de URMARIT in zilele/saptamanile urmatoare, daca autoritatea nu raspunde sau raspunde superficial.

Raspunzi STRICT in JSON cu acest schema:
{
  "actions": [
    {
      "label": "<max 5 cuvinte>",
      "reason": "<o fraza scurta in romana, sub 100 caractere>",
      "icon": "mail|scale|users|alert|share",
      "href": "<URL opțional>"
    }
  ]
}

Reguli:
- Exact 3 actiuni, in ordinea: cea mai usoara → cea mai escalatoare.
- icon = "mail" pt comunicari (consilier local, ONG), "scale" pt institutii de control (Avocatul Poporului, Curtea de Conturi), "users" pt co-semnare/comunitate, "alert" pt media/jurnalisti, "share" pt social.
- Nu spune "asteapta". Toate actiunile sunt CONCRETE, executabile in 5-15 minute.
- Pentru fiecare actiune, reason explica DE CE merge mai departe decat sesizarea initiala.
- Daca tip-ul sesizarii e local (groapa, gunoi, parcare), prima actiune e in general "Email consilier local" sau "Co-semnare comunitate".
- Daca tip-ul e sistemic (transport, mediu), prima actiune poate fi "Avocatul Poporului" sau "Petitia online".
- DOAR JSON, fara markdown sau text suplimentar.`;

const GENERIC_FALLBACK: FollowupsResult = {
  fallback: true,
  actions: [
    {
      label: "Co-semnare vecini",
      reason: "Cu 5+ co-semnaturi, sesizarea trece pe lista prioritara a primariei.",
      icon: "users",
    },
    {
      label: "Distribuie cu prietenii",
      reason: "Vizibilitate publica creste presiunea pe autoritate sa raspunda in 30 zile.",
      icon: "share",
    },
    {
      label: "Avocatul Poporului",
      reason: "Dupa 30 zile fara raspuns, depui plangere pentru incalcarea OG 27/2002.",
      icon: "scale",
      href: "https://avp.ro/",
    },
  ],
};

/**
 * Generate 3 personalized follow-up actions for a sesizare.
 *
 * Audit item #90. Cheap call to Groq Llama 3.1 8B Instant (~50ms).
 * Best-effort — returns a generic fallback set if Groq fails so the UI
 * always has something to show.
 */
export async function generateFollowups(args: {
  tip: string;
  titlu: string;
  county?: string | null;
}): Promise<FollowupsResult> {
  try {
    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL_FAST,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Tip: ${args.tip}\nTitlu: ${args.titlu}\nJudet: ${args.county ?? "necunoscut"}\n\nSugereaza 3 actiuni follow-up.`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 600,
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return GENERIC_FALLBACK;

    const parsed = JSON.parse(raw) as { actions?: FollowupAction[] };
    if (!Array.isArray(parsed.actions) || parsed.actions.length === 0) {
      return GENERIC_FALLBACK;
    }
    const cleaned: FollowupAction[] = parsed.actions.slice(0, 3).map((a) => ({
      label: typeof a.label === "string" ? a.label.slice(0, 60) : "Actiune",
      reason: typeof a.reason === "string" ? a.reason.slice(0, 200) : "",
      icon:
        a.icon === "mail" || a.icon === "scale" || a.icon === "users" ||
        a.icon === "alert" || a.icon === "share"
          ? a.icon
          : "alert",
      href: typeof a.href === "string" && a.href.startsWith("http") ? a.href : undefined,
    }));
    return { actions: cleaned };
  } catch {
    return GENERIC_FALLBACK;
  }
}

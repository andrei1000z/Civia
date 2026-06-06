import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { rateLimitAsync } from "@/lib/ratelimit";
import { getGroqClient, GROQ_MODEL, GROQ_MODEL_VISION } from "@/lib/groq/client";
import {
  SESIZARE_STATUS_META,
  SESIZARE_STATUS_VALUES,
  isSesizareStatus,
  type SesizareStatus,
} from "@/lib/sesizari/status";
import { polishSynthesisLine } from "@/lib/ai/polish-synthesis";
import { sanitizeText } from "@/lib/sanitize";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface AssistResponse {
  suggested_status: SesizareStatus;
  suggested_event_at: string | null;
  refined_note: string;
  suggested_decision_note: string;
  confidence: "high" | "medium" | "low";
  warnings: string[];
}

const SYSTEM_PROMPT = `Ești asistentul intern al admin-ului Civia care verifică propunerile de update de status pe sesizările civice.

Primești CONTEXTUL complet (sesizarea originală + nota propunătorului + dovada — fie poză prin vision, fie PDF / fără dovadă, doar text). Sarcina ta e să decizi, ca un admin senior, cum ar trebui aprobată propunerea.

EXTRAGI și RĂSPUNZI numai cu un obiect JSON cu fix aceste chei:
- "suggested_status": una dintre valorile permise (vezi listă în mesajul utilizator); dacă dovada confirmă propunerea, păstrează valoarea propusă; dacă dovada arată ALTCEVA (ex. propus „interventie" dar PDF-ul e o adresă de înregistrare), CORECTEAZĂ pe baza dovezii.
- "suggested_event_at": ISO 8601 (YYYY-MM-DDTHH:MM) cea mai bună dată/oră inferabilă din notă sau dovadă (data poștei pe document, dată menționată în text, etc.); null dacă nu se poate deduce — atunci admin-ul va folosi „acum".
- "refined_note": versiune curățată în română corectă cu diacritice a notei propunătorului, max 280 caractere, începe cu majusculă, NU inventează fapte. Asta intră direct în timeline-ul public.
- "suggested_decision_note": opțional (string, poate fi gol "") — notă scurtă pe care admin-ul o poate trimite către propunător prin email (ex. „mulțumim, am verificat documentul" / „contradicție între notă și dovadă, te rugăm reîncearcă").
- "confidence": "high" dacă dovada confirmă fără echivoc, "medium" dacă e plauzibil dar nedovedit, "low" dacă există suspiciuni.
- "warnings": listă scurtă de avertismente (string[]); folosește o intrare ca „Dovada nu corespunde notei" sau „Nu s-a putut deduce data" când e cazul; gol [] dacă nimic.

REGULI:
- Limba română corectă, diacritice complete (ă, â, î, ș, ț), acord perfect.
- NU inventa cifre, nume, date, articole de lege.
- NU plasa o dată dacă nu e dedusă clar — pune null.
- Răspunde DOAR cu obiect JSON valid, fără markdown wrap, fără text suplimentar.`;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  // The vision call is expensive — cap to a sane per-admin rate so a
  // browser tab left open hammering the button doesn't burn the quota.
  const rl = await rateLimitAsync(`admin-ai-assist:${user.id}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Prea multe acțiuni AI. Așteaptă un minut." },
      { status: 429 },
    );
  }

  const admin = createSupabaseAdmin();
  const { data: ticket, error: tErr } = await admin
    .from("sesizare_status_tickets")
    .select("id, sesizare_id, proposed_status, note, proof_url, decision, created_at")
    .eq("id", id)
    .maybeSingle();
  if (tErr || !ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: sesizare } = await admin
    .from("sesizari")
    .select("code, titlu, status, locatie, tip, descriere")
    .eq("id", ticket.sesizare_id)
    .maybeSingle();

  const proofUrl: string | null = ticket.proof_url ?? null;
  const isPdfProof = proofUrl ? proofUrl.toLowerCase().endsWith(".pdf") : false;
  const hasImageProof = proofUrl ? !isPdfProof : false;

  const now = new Date();
  const ctxLines = [
    `Astăzi: ${now.toISOString().slice(0, 16)} (UTC).`,
    `Sesizare cod: ${sesizare?.code ?? "necunoscut"}`,
    `Titlu sesizare: ${sesizare?.titlu ?? "—"}`,
    `Locație: ${sesizare?.locatie ?? "—"}`,
    `Tip: ${sesizare?.tip ?? "—"}`,
    `Status curent al sesizării: ${sesizare?.status ?? "—"}`,
    `Descrierea sesizării (sumarizată): ${(sesizare?.descriere ?? "").slice(0, 400)}`,
    "",
    `Statusul PROPUS de cetățean: ${ticket.proposed_status}`,
    `Nota propunătorului: ${ticket.note}`,
    proofUrl
      ? isPdfProof
        ? `Dovadă atașată: PDF la ${proofUrl} (nu o poți „vedea" — bazează-te pe notă + descrierea sesizării).`
        : `Dovadă atașată: poză (analizează vision-ul).`
      : "Dovadă atașată: niciuna.",
    "",
    `Statusuri permise (alege EXACT una): ${SESIZARE_STATUS_VALUES.map(
      (s) => `${s} (${SESIZARE_STATUS_META[s].label} — ${SESIZARE_STATUS_META[s].hint})`,
    ).join("; ")}.`,
  ].join("\n");

  const groq = getGroqClient();
  const useVision = hasImageProof;
  const userContent = useVision
    ? [
        { type: "text" as const, text: ctxLines },
        { type: "image_url" as const, image_url: { url: proofUrl! } },
      ]
    : ctxLines;

  let raw = "";
  try {
    const completion = await groq.chat.completions.create({
      model: useVision ? GROQ_MODEL_VISION : GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent as unknown as string },
      ],
      temperature: 0.2,
      max_tokens: 700,
      response_format: { type: "json_object" },
    });
    raw = completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (e) {
    Sentry.captureException(e, {
      tags: { kind: "ticket_ai_assist" },
      extra: { ticketId: id, useVision },
    });
    return NextResponse.json(
      { error: "AI nu a putut răspunde. Încearcă din nou." },
      { status: 502 },
    );
  }

  let parsed: Partial<AssistResponse>;
  try {
    parsed = JSON.parse(raw) as Partial<AssistResponse>;
  } catch {
    return NextResponse.json({ error: "AI a returnat JSON invalid." }, { status: 502 });
  }

  // ─── Sanitize + fall-back so the UI always gets something usable ──
  const fallbackStatus = (
    isSesizareStatus(ticket.proposed_status)
      ? ticket.proposed_status
      : "in-lucru"
  ) as SesizareStatus;
  const suggested_status: SesizareStatus = isSesizareStatus(parsed.suggested_status)
    ? parsed.suggested_status
    : fallbackStatus;

  // 2026-06-06 (audit #25) — refined_note vine din JSON-ul AI și intră în
  // timeline-ul PUBLIC + în emailuri. sanitizeText strip-uie HTML/control chars
  // înainte de polish, ca un model compromis să nu poată injecta `<img onerror>`.
  const refined_note = polishSynthesisLine(
    sanitizeText(String(parsed.refined_note ?? ticket.note), 280),
  );
  const suggested_decision_note =
    typeof parsed.suggested_decision_note === "string"
      ? parsed.suggested_decision_note.slice(0, 500)
      : "";

  let suggested_event_at: string | null = null;
  if (typeof parsed.suggested_event_at === "string" && parsed.suggested_event_at.trim()) {
    const d = new Date(parsed.suggested_event_at);
    if (!Number.isNaN(d.getTime())) {
      // Constrain into a sensible band: not before sesizare creation,
      // not after now (admin will only ever stamp past events).
      const minDate = sesizare ? new Date(ticket.created_at) : new Date(0);
      const maxDate = new Date();
      const ts = Math.min(Math.max(d.getTime(), minDate.getTime()), maxDate.getTime());
      suggested_event_at = new Date(ts).toISOString();
    }
  }

  const confidence = (
    parsed.confidence === "high" || parsed.confidence === "low" ? parsed.confidence : "medium"
  ) as "high" | "medium" | "low";

  const warnings: string[] = Array.isArray(parsed.warnings)
    ? parsed.warnings
        .filter((w): w is string => typeof w === "string" && w.length > 0)
        .slice(0, 5)
    : [];

  const response: AssistResponse = {
    suggested_status,
    suggested_event_at,
    refined_note,
    suggested_decision_note,
    confidence,
    warnings,
  };

  return NextResponse.json({ data: response });
}

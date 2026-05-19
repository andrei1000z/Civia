import { getActiveInterruptions, getInterruptionsForCounty, toIcsCalendar } from "@/data/intreruperi";
import { rateLimitAsync, getClientIp } from "@/lib/ratelimit";

// 2026-05-19: 30min → 4h. Subscriberii calendar refresh-eaza la 1h+ oricum.
export const revalidate = 14400;

/**
 * GET /api/intreruperi/ics        — întreg calendarul
 * GET /api/intreruperi/ics?county=CJ — doar județul respectiv
 *
 * Răspuns: text/calendar (ICS / iCalendar format).
 * Subscribe: pune linkul ăsta în Google Calendar → „Add calendar" → „From URL".
 */
export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimitAsync(`intreruperi-ics:${ip}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.success) {
    return new Response("Rate limit", { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const county = searchParams.get("county")?.toUpperCase();
  const items = await (county
    ? getInterruptionsForCounty(county)
    : getActiveInterruptions());
  const ics = toIcsCalendar(items);
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="civia-intreruperi${county ? `-${county.toLowerCase()}` : ""}.ics"`,
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}

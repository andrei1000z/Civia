import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresh Supabase auth session at the edge.
 *
 * REQUIRED for SSR auth persistence — without it, the access-token JWT
 * (default TTL 1h) expires and the user appears logged out after ~1h
 * even though the refresh token is still valid. Middleware MUST call
 * `supabase.auth.getUser()` so the token-refresh logic in @supabase/ssr
 * has a chance to mint a new access token and rewrite the cookies.
 *
 * Bug raportat user 5/20/2026: a inchis browserul si laptopul, a
 * revenit pe civia.ro, era LOGGED OUT. Cauza: proxy.ts nu chema niciun
 * supabase auth API → cookie-ul access-token expira silent fara ca
 * refresh-ul sa fie efectuat → la fetch-ul urmator (getUser pe browser
 * sau pe RSC) Supabase returneaza null → AuthProvider seteaza user=null
 * → toate butoanele „Trimite via Civia" etc dispar.
 *
 * Folosire in proxy.ts: peste tot unde construim un NextResponse, il
 * trecem prin updateSession ca sa garantam cookie refresh.
 */
// 2026-05-24 Faza 2 (perf): fast-path pentru anonymous traffic.
// @supabase/ssr stochează session-ul în cookie-uri cu nume `sb-<ref>-auth-token`
// (eventual chunked în `.0`, `.1`). Pentru un visitor anonim (>80% din trafic),
// niciun astfel de cookie nu există → getUser() face un round-trip inutil la
// Supabase auth server (50-80ms) doar ca să returneze `null`. Skip-uim acel
// call când nu există nicio cookie auth. Pentru users logați, comportamentul
// e neschimbat (refresh la fiecare request, getUser pune JWT-ul refreshat).
function hasAuthCookie(request: NextRequest): boolean {
  for (const c of request.cookies.getAll()) {
    if (c.name.startsWith("sb-") && c.name.includes("-auth-token")) return true;
  }
  return false;
}

export async function updateSupabaseSession(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Missing env in some preview contexts — bail silent so we don't 500
  // every request. The browser client throws loud later if env is gone.
  if (!url || !key) return response;

  // Fast-path: anonymous visitor — no auth cookies → skip Supabase round-trip.
  // Tipic salvează 50-80ms per request pe ~80% din trafic (anonimi).
  if (!hasAuthCookie(request)) return response;

  // Build a server client that reads from the incoming request cookies
  // and writes refreshed cookies to BOTH the response (sent to the
  // browser) AND the request (so any downstream middleware logic sees
  // the new values). @supabase/ssr handles the auto-refresh internally
  // when getUser() is called.
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // The call itself triggers refresh if the access token is expired and
  // the refresh token is still valid. Ignore the result — we only need
  // the side-effect of cookies being refreshed.
  try {
    await supabase.auth.getUser();
  } catch {
    // Network/Supabase transient — don't block the request.
  }

  return response;
}

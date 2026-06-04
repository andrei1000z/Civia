# Civia — Deployment & Configuration Guide

This is the runbook for setting up a new environment from scratch (Vercel + Supabase + Upstash Redis + Groq) and for keeping a running deployment healthy.

---

## 1. Environment variables (Vercel)

Set these in **Vercel Dashboard → Project Settings → Environment Variables** (apply to Production + Preview + Development unless noted):

### Required

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project>.supabase.co` | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | "anon public" key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | service_role secret — server only |
| `GROQ_API_KEY` | `gsk_...` | https://console.groq.com/keys |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | main text model |
| `GROQ_MODEL_FAST` | `llama-3.1-8b-instant` | classifier + petition extractor |
| `GROQ_MODEL_VISION` | `meta-llama/llama-4-scout-17b-16e-instruct` | photo analysis on sesizari |
| `NEXT_PUBLIC_SITE_URL` | `https://civia.ro` | ⚠️ `next.config.ts` build-fails if a localhost URL leaks into a Vercel build |
| `CRON_SECRET` | long random string | sent as `Authorization: Bearer ${CRON_SECRET}` by Vercel Cron + the in-app self-healing fetch trigger |
| `UPSTASH_REDIS_REST_URL` | `https://xxx.upstash.io` | rate limits + analytics + caches |
| `UPSTASH_REDIS_REST_TOKEN` | `AXxx...` | |

### Optional

| Variable | Used by |
|---|---|
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | newsletter + transactional email |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | privacy-friendly analytics |
| `NEXT_PUBLIC_SENTRY_DSN` | error tracking |
| `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=1` | show Google button (only after configuring in Supabase Dashboard) |
| `NEXT_PUBLIC_ENABLE_APPLE_AUTH=1` | show Apple button (only after configuring in Supabase Dashboard) |
| `OPENAQ_API_KEY`, `WAQI_TOKEN` | bonus AQI sensor sources beyond Sensor.Community |

---

## 2. Database migrations

Migrations are **idempotent** — safe to re-run. Apply in numerical order from a fresh Supabase project.

### Automatic (preferred)

```bash
npm run migrate
```

This calls `scripts/migrate.ts`, which uses `SUPABASE_SERVICE_ROLE_KEY` to invoke the `exec_sql` Postgres RPC. The first time you run it, the script will print a one-time bootstrap RPC for you to paste into the Supabase SQL Editor.

### Manual

Run these in the Supabase Dashboard → SQL Editor, in order:

1. `supabase/schema.sql` — base schema
2. `supabase/migrations/002_stiri_cache.sql`
3. `supabase/migrations/003_expanded_tipuri.sql`
4. `supabase/migrations/004_profiles_extended.sql`
5. `supabase/migrations/005_sesizari_resolved.sql`
6. `supabase/migrations/006_security_newsletter_role.sql` — adds `profiles.role` + `newsletter_subscribers` + RLS hardening
7. `supabase/migrations/007_sesizare_follows.sql`
8. `supabase/migrations/008_drop_chat_tables.sql`
9. `supabase/migrations/009_fulltext_search.sql`
10. `supabase/migrations/010_romania_authorities.sql`
11. `supabase/migrations/011_sesizari_county_locality.sql`
12. `supabase/migrations/012_stiri_county.sql`
13. `supabase/migrations/013_stiri_ai_summary.sql`
14. `supabase/migrations/014_sector_nullable.sql`
15. `supabase/migrations/015_hide_name.sql`
16. `supabase/migrations/016_status_amanata_response.sql`
17. `supabase/migrations/017_interruption_submissions.sql`
18. `supabase/migrations/018_feedback_submissions.sql`
19. `supabase/migrations/019_comment_replies_votes.sql`
20. `supabase/migrations/020_petitii.sql`
21. `supabase/migrations/021_petitii_target_nullable.sql`
22. `supabase/migrations/022_profile_avatar_newsletter_optin.sql`
23. `supabase/migrations/023_petitii_ai_summary.sql`

> Migrările `024`–`092` se aplică în ordine numerică după cele de mai sus.
> Notabilă: `092_drop_votes_follows.sql` (2026-06-04) elimină tabelele
> `sesizare_votes` + `sesizare_follows` și agregatele de voturi/urmăriri din
> view-ul `sesizari_feed`.

### Make yourself admin

After migration 006:

```sql
update public.profiles set role = 'admin' where id = '<your-user-id>';
```

Get the user ID from Supabase Dashboard → Authentication → Users.

---

## 3. Supabase Auth configuration

**Authentication → URL Configuration:**

- Site URL: `https://civia.ro`
- Redirect URLs:
  - `https://civia.ro/auth/callback`
  - `http://localhost:3000/auth/callback`

### Google OAuth (optional)

1. Google Cloud Console → create OAuth 2.0 Client ID (Web).
2. Authorized redirect URI: `https://<project>.supabase.co/auth/v1/callback`.
3. Copy Client ID + Secret into Supabase Dashboard → Authentication → Providers → Google → Enable.
4. Set `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=1` in Vercel.

### Apple Sign-In (optional)

1. Apple Developer Portal → Services ID for Sign in with Apple.
2. Domain: `<project>.supabase.co`. Return URL: `https://<project>.supabase.co/auth/v1/callback`.
3. Create a Key, download `.p8`, note Key ID + Team ID.
4. Supabase Dashboard → Apple provider → paste Services ID + Key ID + Team ID + .p8 contents → Enable.
5. Set `NEXT_PUBLIC_ENABLE_APPLE_AUTH=1` in Vercel.

### Magic-link email template

Supabase Dashboard → Authentication → Email Templates → "Magic Link":

```html
<h2>Bun venit pe Civia</h2>
<p>Apasă linkul de mai jos pentru a te conecta:</p>
<p><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 24px;background:#1C4ED8;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Conectează-mă</a></p>
<p style="color:#64748b;font-size:14px;">Linkul expiră în 1 oră. Dacă nu ai cerut acest email, ignoră-l.</p>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
<p style="color:#94a3b8;font-size:12px;">Civia — platforma civică a României · civia.ro</p>
```

---

## 4. Background work (cron + self-healing)

The Hobby plan caps Vercel Cron at **1 run per day**. We work around this with two layers:

### Layer 1 — Vercel Cron (`vercel.json`)

```json
{
  "crons": [
    { "path": "/api/stiri/fetch", "schedule": "0 6 * * *" },
    { "path": "/api/newsletter/digest", "schedule": "0 8 * * 1" }
  ]
}
```

Vercel auto-sends `Authorization: Bearer $CRON_SECRET` for cron-triggered requests; the routes authorize on that header.

### Layer 2 — self-healing on traffic (no Pro plan needed)

`/api/stiri` triggers `/api/stiri/fetch` in `after()` on each request, throttled by a Redis NX lock with 5-min TTL. Result: as long as somebody is visiting `/stiri`, fresh articles surface within ~5 minutes of being posted on Digi24/HotNews/etc. — no upgrade required.

### Layer 3 — optional external cron

For deterministic refresh during quiet hours, a free cron-job.org or a GitHub Actions workflow can hit `/api/stiri/fetch` with the Bearer secret. The endpoint is idempotent.

---

## 5. Production build checklist

```bash
npm install
npx tsc --noEmit                                  # 0 errors
node --stack-size=8192 node_modules/eslint/bin/eslint.js .   # 0 errors
npm run test                                      # all green
npm run build                                     # bundle should succeed
```

Smoke test before promoting:

- [ ] `/` loads, hero green, navbar liquid-glass over the hero.
- [ ] `/sesizari` form submits, AI rewrite returns formal text, no clichés.
- [ ] `/sesizari/<code>` shows status pill + timeline + cosign counter.
- [ ] `/petitii` lists active + closed; clicking one opens detail with AI sinteză.
- [ ] `/stiri` autorefresh dot pulses, article opens with AI sinteză + reading-progress bar.
- [ ] `/harti` switcher slides smoothly between tabs (Web Animations API).
- [ ] `/admin` requires admin role; `/admin/newsletter` lists subscribers.
- [ ] `/cont` loads, county dropdown writes/clears the cookie, newsletter toggles auto-save.
- [ ] `/legal/confidentialitate` and `/legal/termeni` render with full GDPR/DSA detail.
- [ ] `/api/stiri` returns articles; the second call (>5 min later) shows fresh ones if any were posted.

---

## 6. DNS (`civia.ro` → Vercel)

If the domain is at RoTLD with nameservers only, the easiest path is Cloudflare:

1. Add `civia.ro` to a free Cloudflare account → note the assigned nameservers.
2. RoTLD → set nameservers to Cloudflare's.
3. Cloudflare DNS:
   - `A` `@` → `76.76.21.21`
   - `CNAME` `www` → `cname.vercel-dns.com`
4. Vercel → Project → Domains → add both `civia.ro` and `www.civia.ro`. Vercel issues SSL automatically.

Propagation: usually 1h, max 24h.

---

## 7. Post-deploy maintenance

Useful one-shot scripts in `scripts/` (each idempotent):

- `npm run migrate` — apply pending DB migrations
- `npx tsx scripts/backfill-cosigns.ts [--dry]` — synthesize cosemnat timeline rows from same-tip duplicates within radius
- `npx tsx scripts/verify-populations.ts` — diff `data/counties.ts` populations vs INS 2021 reference
- `npx tsx scripts/verify-emails.ts` — DNS MX check on every authority email in `data/autoritati-contact.ts`
- `npx tsx scripts/fetch-stiri.ts` — local one-shot RSS pull (for testing without hitting the production API)

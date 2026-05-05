# Security Policy

## Reporting a Vulnerability

If you discover a security issue in Civia, please **do not** open a public
GitHub issue. Instead, email the maintainers directly with:

- A clear description of the issue and impact
- Steps to reproduce (or proof-of-concept)
- Affected component (e.g. `/api/sesizari/[code]`, RLS policy on `petitii`,
  AI endpoint)

We aim to acknowledge within 72 hours and ship a fix or mitigation within
14 days for confirmed vulnerabilities.

Public disclosure is coordinated with the reporter — you'll be credited
unless you'd prefer to stay anonymous.

## Scope

In scope:
- Authentication / authorization bypasses (RLS, admin role gating)
- PII leaks (names, emails, addresses surfaced to non-owners)
- Stored / reflected XSS, CSRF
- SQL injection, IDOR, SSRF
- Secret exposure (env vars, service-role keys leaking client-side)
- Rate-limit bypass on AI endpoints (cost-amplification)

Out of scope:
- Issues requiring a fully compromised user device
- Self-XSS without amplification
- DoS via volumetric traffic (use `gh report` for spam, not security)
- Reports about third-party services we depend on (Supabase, Groq, Vercel,
  Resend, Upstash) — report those upstream

## What we collect (transparency)

- **Anonymous analytics** (Upstash Redis, 30-day retention): visitor ID
  hash, country/city from IP, device class, pageviews, click events, AI
  usage counts, web vitals. Never email/name. See `src/lib/analytics/`.
- **Per-visitor session timeline** for the admin dashboard (last 200
  events / visitor, 30-day TTL, 1000 visitor cap). Used to debug UX
  regressions; never to profile individuals.
- **User-submitted content** (sesizări, petitions, feedback) stored in
  Supabase with RLS. Names and addresses are scrubbed from public
  surfaces by default — only the owner sees their own data unredacted.

The full privacy policy lives at `/legal/confidentialitate` on civia.ro.

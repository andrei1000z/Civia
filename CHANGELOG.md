# Changelog Civia

Toate schimbările majore în Civia sunt documentate aici. Format inspirat din [Keep a Changelog](https://keepachangelog.com/) cu versionare semver-light (Civia e platformă, nu lib).

## [Q2 2026] — Major refresh „1000 puncte"

### ✨ Added
- `/legal/accesibilitate` — declarație WCAG 2.2 AA + EN 301 549 v3.2.1 + EAA conformity
- `/legal/cookie-policy` — politică cookies separată, conformă cu Austria 2025 GDPR parity ruling
- `/legal/dpa-autoritati` — template DPA pentru primării (GDPR art. 28)
- `/despre` — pagină despre Civia: valori, stack, echipa, susținere
- `/status` — status în timp real al serviciilor (Supabase, Groq, Resend, etc.)
- `/roadmap` — roadmap public cu livrate/active/planificate/visate
- `OfflineIndicator` component — banner sticky-top când conexiunea pică
- `EmptyState` component shared (3 variante: no-data/no-results/no-permission)
- `AiDisclosure` component — UE AI Act art. 50 transparency disclosure
- `lib/copy/cta.ts` — CTA copy constants unificate (50+ strings)
- `lib/pluralize-ro.ts` — helper pluralizare română corectă (adaugă „de" peste 20)
- `PetitionJsonLd` schema — CreativeWork extended cu InteractionCounter
- Civic Streak triggers — vote/cosign/comment/sign/follow bump streak
- Pattern Detection cron weekly — AI Groq detectează systemic issues
- AVP escalation generator — la 60 zile fără răspuns
- Vision AI severity score — auto-attribute low/medium/high/critical
- Newsletter weekly „Rezolvate" cron — Friday digest
- Open311 v2 API — services.json + requests.json (CORS public)
- /api/sesizari/drafts + nudge cron — autosave + 24h reminder email
- Cmd/Ctrl+Enter shortcut pentru submit SesizareForm
- Playwright E2E config + smoke tests (10 tests critical flows)

### 🐛 Fixed
- **CRITICAL Newsletter confirmation** — handler updata doar `confirmed_at` dar nu `confirmed`. 8/9 subscribers retroactive activați.
- **Sectors null** — 28 sesizări recuperate via regex backfill + 4 manual fix. **Acum 0/48 null.**
- **Sesizare #44 coordonate Sibiu** — fixat la Splaiul Unirii × Abator Sector 5
- **Pattern detection JSON.parse** — wrap try/catch + Sentry, max_tokens 1500
- **JsonLd HTML escape** — extins cu U+2028 LINE SEP + U+2029 PARAGRAPH SEP
- **Tip mis-classification** — 00023 trotuar→groapa, 00036 stalpisori→banda_transport
- **Migration 070** — extins CHECK constraint cu 5 tipuri noi (banda_transport, etc.)
- **Identity unification** — vremschimbare/Vrem Schimbare → unified
- **Resend ghost sends** — strict check pe message_id absence
- **„3 cuvinte" misleading** în hero — replace cu „câteva fraze"

### ⚡ Performance
- AnalyticsDashboard lazy-loaded (next/dynamic) → -200ms admin load
- ISR `/[judet]` 24h → 6h (date fresh)
- `generateStaticParams` pe /petitii/[slug] + /proteste/[slug] (toate 16 prerendered)
- Recharts deja dynamic în /istoric ✅
- Tesseract.js deja lazy ✅
- Sentry sample rate optim (2% baseline + 50% critic + replay 0.5)

### 🔒 Security
- **Dark mode locked** — schema force „dark", 7 profile migrate
- Honeypot field verified (left:-9999px + aria-hidden + tabIndex=-1)
- FLoC opt-out în Permissions-Policy ✅
- DKIM/SPF/DMARC verified pe `civia.ro` (Resend dashboard)
- AI Act disclosure pe toate AI-generated content
- DPA template public pentru autorități

### ♿ Accessibility (WCAG 2.2 AA)
- Touch targets ≥44px mobile pe Footer, Button sm, CookieBanner, MarkdownEditor, Navbar
- CookieBanner — Accept/Reject parity vizuală (Austria 2025 ruling)
- ARIA — `aria-label` pe nav-uri, `aria-haspopup="dialog"` pe modal triggers
- Modal title `line-clamp-2` pentru long titles
- text-[10px] purge pe surfaces user-facing (Footer, actualizari badges)

### 🇷🇴 Romanian polish
- Diacritics fix: „aceasta primarie" → „această primărie", „Reincearca" → „Reîncarcă"
- Pluralize helper cu „de" peste 20 ✓ tests
- 10 FAQ entries noi (sesizari, petitii, proteste, intreruperi)
- Voice civic-prietenos „tu" peste tot

### 📚 Documentation
- CHANGELOG.md (this file)
- CONTRIBUTING.md
- Roadmap public la `/roadmap`
- Press kit la `/press` (already existed)

---

## [Q1 2026] — Initial public launch

Vezi commit history pe [GitHub](https://github.com/andrei1000z/Civia/commits/main).

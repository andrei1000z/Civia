# 🚀 Big Features Roadmap — Implementation Status

Status implementare big features din `docs/audit-2026-05-29/features-big.md`.

User a aprobat 7 features (skip #2 telefonic AI, #6 AR urbanistic, #7 Open Data Marketplace).

---

## ✅ Feature #1 — Agent AI „Insistent" (SCAFFOLDED)

**Status**: 🟢 SCAFFOLDED & READY pentru migration + cron schedule

**Files shipped**:
- `src/app/api/cron/agent-insistent/route.ts` — cron handler complet cu 3 stage-uri
- `supabase/migrations/089_agent_insistent_schema.sql` — sesizari columns + tabelă audit
- Cleanup automat: nu suprapune stage-uri (escalation_stage < next_stage)

**Pipeline implementat**:
- **Ziua 30** → Reamintire la primărie cu citarea OG 27/2002 art. 8
- **Ziua 45** → Notificare către Avocatul Poporului (`relatii_publice@avp.ro`) + Prefectura județului (din `PREFECTURI` catalog)
- **Ziua 60** → Trimite la cetățean template plângere contencios administrativ (Legea 554/2004) cu CTA „semnează + depune la judecătorie"

**Post-deploy steps**:
1. `npm run migrate` (aplică 089)
2. pg_cron schedule (sau Vercel cron) la 09:00 zilnic:
   ```sql
   SELECT cron.schedule('agent-insistent-daily', '0 9 * * *',
     $$SELECT net.http_post(
       url := 'https://www.civia.ro/api/cron/agent-insistent',
       headers := '{"Authorization": "Bearer ' || current_setting('app.cron_secret') || '"}'::jsonb
     );$$
   );
   ```

**Civic value**: Forțează primării să răspundă în 30 zile, altfel escaladare AUTOMATĂ.

---

## 🟡 Feature #3 — Stream live ședințe consiliu local (PLANNED)

**Status**: 📐 SCHEMA + UI PLAN draft

**Resursă blocant**: necesită Cloudflare Stream subscription ($5/mo per 1000 minutes) + Whisper API calls (~$0.006/min Groq). La 50 consilii × 6h ședință × 30 zile = 9000h/lună → ~$54/mo Stream + ~$3240/mo Groq Whisper. **NU începem fără sponsor sau Q4.**

**Schema preliminară** (de implementat când start):
```sql
CREATE TABLE consiliu_streams (
  id UUID PRIMARY KEY,
  consiliu TEXT NOT NULL,        -- "PMB", "Sector 1", "Cluj-Napoca"
  county TEXT,
  stream_url TEXT,               -- YouTube/Facebook URL
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  transcript TEXT,               -- AI Whisper output
  tags TEXT[]
);
CREATE TABLE consiliu_alerts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  consiliu TEXT NOT NULL,
  keywords TEXT[],
  channel TEXT NOT NULL          -- 'email' | 'push'
);
```

**Alternative pana fonduri**: scrape doar AGENDA ședinței (PDF document) + AI summary o dată/săptămână. Mult mai ieftin ($1/lună). User primește notificare „mâine consiliul Sector 5 discută X".

---

## 🟡 Feature #4 — Buget interactiv „Pe banii MEI" (PLANNED)

**Status**: 📐 PLAN draft

**Implementare propusă**:
- `/buget/personal` page cu input salariu lunar + județ
- Calcul taxe: impozit 10% + CAS 25% + CASS 10% + TVA medie 7%
- Mappa la cheltuieli primării din data.gov.ro (open data ANAF) — refresh anual
- Recharts treemap interactiv
- DB: cache materialized view `buget_primarii_year` cu cheltuieli per departament

**Resursă blocant**: nimic — Recharts deja folosit, data publice gratis. **Q2 priority**.

**Files de creat** (TODO):
- `src/app/buget/personal/page.tsx`
- `src/app/api/buget/calculate/route.ts`
- `src/lib/buget/calc.ts` (formule taxe RO)
- `supabase/migrations/0XX_buget_data.sql` (materialized view + buget_imports table)

---

## 🟡 Feature #5 — Inițiative cetățenești OTP SMS (PLANNED)

**Status**: 📐 PLAN draft

**Implementare propusă**:
- `/initiative` page + flow create initiative (titlu + descriere + obiectiv legal + nr semnaturi target)
- SMS OTP via Vonage/Twilio (cost ~$0.02/SMS — 100 semnături = $2 per inițiativă)
- DB: `initiative` table + `initiative_signatures` (cu CNP hash + telefon hash, NU raw)
- PDF generator pentru dosar oficial către Consiliul Local
- Per oraș: legal template (Legea 189/1999 statute primării diferite)

**Resursă blocant**: cost SMS — necesită sponsor sau crowdfunding. **Q3 priority**.

**Risk**: legal review necesar pentru fiecare oraș (statute diferite).

---

## 🟡 Feature #8 — Compass Finanțare UE (PLANNED)

**Status**: 📐 PLAN draft

**Implementare propusă**:
- Scraper săptămânal `fonduri-ue.ro` + `fonduri-structurale.ro` + EU TED
- `/compass-ue` page cu profil cetățean (rol + interes + județ)
- AI match daily: Groq Llama compară profil ↔ programe deschise
- Push notification când match
- PDF assistant pentru dosar aplicație (RAG via pgvector pe ghiduri UE)

**Resursă blocant**: scraping legal + AI cost (~$10/lună Groq). **Q2-Q3 priority**.

**Files de creat** (TODO):
- `src/lib/ue/scraper.ts`
- `src/app/api/cron/scrape-ue-apels/route.ts`
- `src/app/compass-ue/page.tsx`
- `supabase/migrations/0XX_ue_programs.sql`

---

## 🟡 Feature #9 — Verificare avere demnitari (PLANNED)

**Status**: 📐 PLAN draft

**Implementare propusă**:
- Scraper ANI (`integritate.eu`) — declarații avere publice (10k+ demnitari)
- AI extraction Llama 3.3 70B + Vision pentru PDF parse
- DB time-series: `demnitari_avere(year, salary, real_estate, cash, vehicles, etc.)`
- Pattern detection: salt avere > 50% YoY + AI flag suspect
- `/verificare-avere/[cnp_slug]` page per demnitar
- LeaderBoard public „Top 50 demnitari cu salt suspect"
- **LEGAL REVIEW NECESAR înainte de launch** (defamation risk)

**Resursă blocant**: legal review + AI cost mediu (~$30/lună Gemini Vision pentru PDFs). **Q3-Q4 priority**.

---

## 🟡 Feature #10 — Decizii Deschise consiliu (PLANNED)

**Status**: 📐 PLAN draft

**Implementare propusă**:
- Scraper website consiliu local PMB + 6 sectoare + 41 capitale județe (~50 sites)
- AI summary per propunere: „Pe scurt → Ce schimbă → Cine câștigă → Cine pierde"
- DB: `consiliu_propuneri(id, consiliu, titlu, ai_summary, status, vote_results)`
- Comments cetățenești cu auto-moderation
- `/decizii-deschise` page + per propunere `/decizii/[id]`
- Public DB voting record consilieri

**Resursă blocant**: scraping reliability (siteuri primării sunt junky). **Q2-Q3 priority**.

**Files de creat** (TODO):
- `src/lib/decizii/scrapers/` (per primarie)
- `src/app/api/cron/scrape-decizii/route.ts`
- `src/app/decizii-deschise/page.tsx`
- `supabase/migrations/0XX_decizii_schema.sql`

---

## 📊 Sinteză Status

| # | Feature | Status | Effort total | Q | Civic Impact |
|---|---|---|---|---|---|
| 1 | Agent AI Insistent | 🟢 SHIPPED | L | Q1 | 🔥🔥🔥 |
| 3 | Stream consiliu | 🟡 BLOCKED (cost) | L | Q4+ | 🔥🔥🔥 |
| 4 | Buget „pe banii MEI" | 🟡 PLAN | L | Q2 | 🔥🔥 |
| 5 | Inițiative OTP | 🟡 BLOCKED (cost) | XL | Q3 | 🔥🔥🔥 |
| 8 | Compass UE | 🟡 PLAN | L | Q2-Q3 | 🔥🔥 |
| 9 | Verificare avere | 🟡 BLOCKED (legal) | L | Q3-Q4 | 🔥🔥 |
| 10 | Decizii Deschise | 🟡 PLAN | L | Q2-Q3 | 🔥🔥🔥 |

**Recomandare**: Foundation #1 → Q2 implement #4 + #10 (data-driven, no infra cost) → Q3+ restul după review legal/cost.

# 🎁 20 Features MEDII pentru Civia.ro

> Features moderat de complexe (S/M effort) cu impact mediu/high. Sweet spot ROI — shippable în 1-3 sprint-uri fiecare.

---

## 1. 🔍 Search semantic sesizări publice cu AI

**Tier**: medium · **Impact**: high · **Effort**: M

### Descriere
Search bar care nu doar match keywords ci înțelege intenția: „mașini parcate pe trotuar lângă școală" găsește toate sesizările cu acel context, nu doar cele cu cuvinte identice. Folosește embeddings (pgvector) pe descriere + formal_text. Search rapid (<500ms), highlight pe rezultate.

### User Story
Ca cetățean, vreau să caut „groapa de pe Pantelimon" și să găsesc toate sesizările relevante chiar dacă unele zic „crater carosabil" sau „deteriorare asfalt".

### Technical Notes
- pgvector extension Supabase + Groq embeddings model
- Index HNSW pentru speed
- Hybrid search: keyword + vector cu weighting

### Civic Value
Discoverability sesizări — co-semnatari găsesc cazuri identice cu ale lor → multi-voice impact.

---

## 2. 🌐 Buton „Sesizez și în alt județ"

**Tier**: medium · **Impact**: medium · **Effort**: S

### Descriere
Pe sesizare detail page, buton „Această problemă există și în județul tău?" → click pre-fill formular cu același tip + descriere editată + locație nouă. Tracker: câte „copii" are sesizarea originală → social proof.

### User Story
Ca cetățean din Cluj care vede o sesizare bună din București (ex: „stâlpișori anti-parcare"), vreau să o adaptez 1-click pentru strada mea.

### Technical Notes
- Pre-fill via URL params
- Linked sesizari (parent_code field)
- Visualizare „arbore" de sesizări similare

### Civic Value
Cetățeni învață unii de la alții — bune practici se propagă în țară.

---

## 3. 📅 Calendar civic — toate evenimentele relevante săptămânale

**Tier**: medium · **Impact**: medium · **Effort**: M

### Descriere
Calendar agregat:
- Ședințe consiliu local
- Consultări publice deschise
- Audieri parlamentare relevante
- Proteste programate (deja avem `/proteste`)
- Termenele limită declarații (impozit etc.)
- Apeluri UE deschise

### User Story
Ca cetățean activ, vreau o sursă unică pentru tot ce se întâmplă civic săptămâna asta.

### Technical Notes
- Aggregator scrape multiple sources
- iCal export pentru Google Calendar
- Filter per județ/interes
- Push notification opt-in

### Civic Value
Awareness → participare. Cetățenii nu participă pentru că nu știu CÂND.

---

## 4. 🏆 Quiz „Ce știi despre primăria ta?" — 10 întrebări gamificate

**Tier**: medium · **Impact**: medium · **Effort**: S

### Descriere
Quiz scurt: „Cine e primarul tău? Ce buget anual are primăria? Câte sesizări a primit în 2025? Câte au fost rezolvate?" — cu răspunsuri din date oficiale. Scor + share pe social media. Per judet diferite.

### User Story
Ca cetățean care nu mă interesez de politică, vreau să fiu provocat să aflu cât de puțin știu despre administrația mea, ca să mă educ.

### Technical Notes
- Static questions per județ + dynamic answers din DB
- LeaderBoard județean
- Share Open Graph image cu scor

### Civic Value
Edu civic prin joc. Awareness → interes → engagement.

---

## 5. 📖 Glosar termeni administrativi cu search

**Tier**: medium · **Impact**: medium · **Effort**: S

### Descriere
„Ce înseamnă PUG? Ce e contencios administrativ? Diferența între petiție și sesizare?" — un dicționar searchable cu explicații accesibile + linkuri la legi. Tooltip-uri pe restul siteului — orice termen din glosar e link.

### User Story
Ca cetățean care vede „contencios administrativ" în textul Civia, vreau să apăs și să citesc explicație simplă, nu să caut pe Google.

### Technical Notes
- Static MDX content în `/glosar`
- Tooltip component că wrappuiește termeni
- Search instant in-page

### Civic Value
Acces la cunoaștere = empowerment.

---

## 6. 👤 Profil public opțional cu lista sesizări rezolvate

**Tier**: medium · **Impact**: medium · **Effort**: M

### Descriere
Cetățeanul poate face profilul public (opt-in) cu un username + lista sesizări rezolvate la activul lui + badge-uri civice (top contributor 2026, etc.). Apare ca link pe sesizările sale publice.

### User Story
Ca cetățean care a făcut 50 sesizări rezolvate, vreau să arăt asta public pentru bragging rights + community recognition.

### Technical Notes
- `profiles` table extended cu `public_profile_slug`
- New route `/u/[slug]`
- Privacy guard pentru opt-in only

### Civic Value
Recognition → motivație pentru cetățeni activi.

---

## 7. 🔥 Streak „X zile consecutive cu activitate civică"

**Tier**: medium · **Impact**: medium · **Effort**: S

### Descriere
Vizualizare gamificată (Duolingo-style flame icon) când cetățeanul a făcut o sesizare, semnat petiție, sau citit știre civică zilnic. Streak counter în profil. Pierde streak = re-engage cu reminder.

### User Story
Ca cetățean care vreau să rămân implicat, vreau motivare zilnică prin streak ca să nu uit de Civia.

### Technical Notes
- Activity tracking în Redis Sorted Set
- Daily cron pentru reset/increment
- Push notification opt-in pentru streak risk

### Civic Value
Habit formation pentru civic engagement.

---

## 8. 📰 Newsletter săptămânal personalizat

**Tier**: medium · **Impact**: high · **Effort**: M

### Descriere
Email weekly: „Pe Civia săptămâna asta în județul tău" cu top 5 sesizări de votat, 3 știri civice relevante, 1 petiție de semnat, 1 eveniment de participat. AI personalizat per preferințe.

### User Story
Ca cetățean ocupat, vreau o sintetiză săptămânală cu ce contează civic în zona mea, fără să mă uit pe site zilnic.

### Technical Notes
- Resend audience + segmentation
- Cron weekly luni dimineață
- AI personalize via preferences în profile

### Civic Value
Retention + re-engagement low-effort.

---

## 9. 🎙 Voice input pentru sesizări (PWA Speech Recognition)

**Tier**: medium · **Impact**: medium · **Effort**: M

### Descriere
Microphone icon în textarea descriere → user vorbește, Civia transcribe automat. Util pe mobile + accessibility pentru vârstnici sau cetățeni cu mobilitate redusă.

### User Story
Ca cetățean care văd o problemă pe stradă și nu vreau să tastez 200 chars pe mobil, vreau să apăs mic și să dictez sesizarea.

### Technical Notes
- Web Speech API (gratuit dar limitat iOS Safari)
- Fallback Groq Whisper pentru iOS
- Real-time transcription preview

### Civic Value
Accessibility pentru categorii vulnerabile.

---

## 10. 🗺 Heatmap intensitate sesizări per oraș

**Tier**: medium · **Impact**: high · **Effort**: M

### Descriere
Hartă cu density heatmap colorată per stradă — roșu = multe sesizări nerezolvate, verde = curat. Filter pe tip (parcare, groapă, iluminat). Click pe zonă → lista sesizărilor.

### User Story
Ca cetățean care vreau să mă mut în alt cartier, vreau să văd visual care zone au probleme și cât de active sunt.

### Technical Notes
- Leaflet.heat plugin
- Pre-compute zile/lună în materialized view
- Filtri client-side

### Civic Value
Decizie informată pentru cetățean + pressure pe primării să curețe „roșu".

---

## 11. 📑 Export sesizare ca PDF cu semnătură digitală

**Tier**: medium · **Impact**: medium · **Effort**: M

### Descriere
Buton „Descarcă PDF cu semnătură" → generate PDF cu textul formal + ID sesizare + QR code + signature server-side (DocuSign API or self-signed cert). Cetățeanul poate depune fizic dacă vrea.

### User Story
Ca cetățean care vrea să depună sesizarea și fizic la registratură, vreau un PDF profesional cu semnătură care arată legitim.

### Technical Notes
- Puppeteer for PDF render
- Signing cert RSA self-managed sau DocuSign API
- QR code lib

### Civic Value
Hybrid online/offline workflow respectă realitate RO.

---

## 12. 📺 Embed widget „ultimele sesizări în zona ta" pentru jurnaliști + blogs

**Tier**: medium · **Impact**: medium · **Effort**: M

### Descriere
1-line `<script>` snippet pe care jurnaliști/bloggeri îl pun pe articole locale → embed dinamic cu ultimele 5 sesizări în acel județ + count rezolvate vs nerezolvate. Drive trafic la Civia.

### User Story
Ca bloger civic local, vreau să arăt vizitatorilor ce sesizări au făcut alți cetățeni din oraș, fără să copy-paste manual.

### Technical Notes
- iframe embeddable cu custom domain
- CORS pentru cross-domain
- Lightweight: <50kb total

### Civic Value
Distributed visibility — Civia infiltrat în ecosistemul info local.

---

## 13. 🔔 Notificări push pentru lucrări programate (apă, curent, gaz)

**Tier**: medium · **Impact**: high · **Effort**: M

### Descriere
Cetățeanul setează adresa, primește push automat când apare oprire programată pe strada sa (deja avem `/intreruperi` data) cu 24h în avans. Plus notificare „ne-am întors online" când lucrarea s-a terminat.

### User Story
Ca lucrător la domiciliu, vreau să primesc alertă cu 24h înainte că mâine nu am curent între 9-15, ca să planific întâlnirile.

### Technical Notes
- Push Notification API
- Geofence pe adresa salvată
- Match cu intreruperi data live

### Civic Value
Utility imediată — soluționează durere reală zilnică.

---

## 14. 📈 Counter „Azi rezolvate" pe homepage

**Tier**: medium · **Impact**: medium · **Effort**: S

### Descriere
Pe homepage, vizualizare „Azi pe Civia: 47 sesizări rezolvate de primării, 23 sesizări noi, 156 voturi". Real-time counter animat. Builds momentum + social proof.

### User Story
Ca prim-vizitator pe Civia, vreau să văd că platforma e activă și produce rezultate, nu un site fantomă.

### Technical Notes
- Redis counters + SSE stream pentru live update
- Animație CountUp.js

### Civic Value
Trust building + engagement signal.

---

## 15. ⚡ Acțiuni „1-tap" pentru problemele cele mai comune

**Tier**: medium · **Impact**: high · **Effort**: M

### Descriere
Pe homepage mobile, butoane „1-tap" pentru problemele frecvente: „Mașină pe trotuar aici" → deschide camera, take photo, GPS auto-detect, pre-fill all → submit în <30 secunde. Bypass form complet pentru cazuri obvious.

### User Story
Ca cetățean care vede mașina pe trotuar acum, vreau să sesizez în 10 secunde pe mobil, fără să tastez nimic.

### Technical Notes
- Reuse logică QuickCameraCTA existentă
- GPS + Vision AI tip detection
- Confirm screen + submit

### Civic Value
Friction zero → mai multe sesizări reale → presiune pe primării.

---

## 16. 🤝 Co-semnatari direct fără cont (OTP email)

**Tier**: medium · **Impact**: high · **Effort**: M

### Descriere
Lista co-semnatari pe sesizare publică. Click „Semnez și eu" → modal cu email + nume → OTP verify → adăugat ca co-semnatar fără cont permanent. Email follow-up cu update-uri.

### User Story
Ca cetățean care vede pe Reddit o sesizare bună pe Civia, vreau să semnez fast fără să-mi fac cont nou.

### Technical Notes
- Resend OTP email cu Magic Link
- Temporary cosigner table separate
- Convert to full account opt-in later

### Civic Value
Lower barrier → mai mulți semnatari → multi-voice pressure pe primării.

---

## 17. 🌍 Multilang interface (RO + HU + UK)

**Tier**: medium · **Impact**: medium · **Effort**: M

### Descriere
Romanian default. Maghiară pentru cetățeni transilvania (700k vorbitori). Ucraineană pentru refugiați (>1M în RO). Toate UI strings + AI prompts adaptate.

### User Story
Ca cetățean maghiar din Cluj-Napoca, vreau Civia în limba mea ca să folosesc eficient.

### Technical Notes
- next-intl library
- AI multilingual via Groq (output în limbă cerută)
- Persistent cookie per locale

### Civic Value
Civic platforms = pentru toți cetățenii RO, nu doar majoritari.

---

## 18. 🎬 Mod „Presa" — embed timeline sesizări pe oraș

**Tier**: medium · **Impact**: medium · **Effort**: M

### Descriere
Jurnaliști pot crea „mod presă" pe Civia: select oraș + perioadă → embed timeline frumos cu top 20 sesizări + stats + heatmap. Folosit pe articol „Ce am ignorat în Cluj în mai 2026".

### User Story
Ca jurnalist care scriu material despre civic în oraș, vreau visual ready-to-embed care arată profesionist și atrage cititori.

### Technical Notes
- Pre-built embed page `/presa/[oras]/[luna]`
- Frame-friendly CSS
- Stats + visualizations

### Civic Value
Press amplification — articole bune ancorate pe Civia → mass awareness.

---

## 19. 🗳 „Verificare daca primaria ta e in audit Curtea de Conturi"

**Tier**: medium · **Impact**: high · **Effort**: M

### Descriere
Curtea de Conturi publică rapoarte de audit per UAT. Civia scrape + simplifică: „Primăria ta a fost auditată în 2024. Constatări majore: X cheltuieli nejustificate, Y mil RON returnați". Per primarie page cu istorie audit.

### User Story
Ca cetățean, vreau să știu dacă primaria mea are istorice de probleme financiare, ca să votez informat.

### Technical Notes
- Scrape Curtea de Conturi PDF reports
- AI parse + categorize findings
- Display per primarie

### Civic Value
Anti-corupție prin transparență.

---

## 20. ⏰ Alertă „Expiră termen legal de răspuns"

**Tier**: medium · **Impact**: high · **Effort**: S

### Descriere
Cetățeanul primește notificare cu 5 zile înainte ca termenul de 30 zile (OG 27/2002) să expire pentru sesizarea lui. Email + push: „Mâine se împlinesc 30 zile de la depunere. Dacă nu răspund azi, ai dreptul să escaladezi la Avocatul Poporului".

### User Story
Ca cetățean care a depus sesizarea acum 25 zile și am uitat de ea, vreau reminder ca să acționez la timp.

### Technical Notes
- pg_cron daily check termen aproape
- Email + push notification cu CTA „Escaladez acum"
- Linked cu feature #1 din big features (Agent AI Insistent)

### Civic Value
Empowerment — cetățeanul cunoaște + folosește drepturile legale.

---

## 📊 Sinteză

| # | Feature | Effort | Impact |
|---|---|---|---|
| 1 | Search semantic AI | M | high |
| 2 | Sesizez și în alt județ | S | medium |
| 3 | Calendar civic | M | medium |
| 4 | Quiz primaria | S | medium |
| 5 | Glosar termeni | S | medium |
| 6 | Profil public opt-in | M | medium |
| 7 | Streak civic | S | medium |
| 8 | Newsletter personalizat | M | high |
| 9 | Voice input | M | medium |
| 10 | Heatmap intensitate | M | high |
| 11 | PDF cu semnătură | M | medium |
| 12 | Embed widget presă | M | medium |
| 13 | Push lucrări programate | M | high |
| 14 | Counter „Azi rezolvate" | S | medium |
| 15 | 1-tap quick sesizări | M | high |
| 16 | Co-semnatari OTP fără cont | M | high |
| 17 | Multilang RO/HU/UK | M | medium |
| 18 | Mod „Presa" embed | M | medium |
| 19 | Audit Curtea Conturi | M | high |
| 20 | Alert termen 30 zile | S | high |

**8 features = high impact**, perfect pentru Q1-Q2 priority. Restul = continuous backlog.

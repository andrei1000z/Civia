# Civia — Plan FEATURE-uri NOI (61 idei)

_Generat 2026-05-28 via mega-audit workflow (54 agents, 866 findings raw, 3.77M tokens)_

## 🚀 BIG features (10) — game-changing, L/XL effort

### 1. Lex Agent — AI găsește articolul de lege încălcat

**Impact**: transformative · **Effort**: XL

Un agent AI care analizează fiecare sesizare și identifică automat articolele specifice din legislația românească pe care autoritatea le încalcă (OG 27/2002, Codul Administrativ, Legea 544/2001, OUG 195/2002 etc.). Generează un mini-memoriu juridic atașat sesizării: «Conform Art. X din Legea Y, autoritatea are obligația Z în termen de N zile». Crește dramatic rata de răspuns pentru că primăriile știu că cetățeanul are argument legal. Include linkuri către portal.just.ro și legislatie.just.ro pentru verificare.

> **Tech**: RAG cu pgvector pe corpus de legi RO (scraping legislatie.just.ro), embedding cu Cohere multilingv sau Voyage, retrieval Top-K + Groq llama-3.3-70b cu prompt structurat. Cache agresiv per (tip_sesizare, autoritate).

---

### 2. Cazuri Colective — unificare sesizări pe stradă/cartier

**Impact**: transformative · **Effort**: XL

Detectează automat când >3 sesizări de același tip apar pe aceeași stradă sau în raza de 200m și propune cetățenilor să se alăture unui «Caz Colectiv». Cazul devine o sesizare unitară cu N semnatari, trimisă oficial către primărie cu greutate politică crescută. Include chat intern între participanți, vot pe pași următori, escaladare la Prefectură dacă primăria ignoră. Inspirat din class-action plus Decidim.

> **Tech**: PostGIS pentru clustering geografic, scheduler care rulează la fiecare sesizare nouă, tabel cases (parent) cu case_members. Realtime Supabase pentru chat. Email batch când autoritatea răspunde.

---

### 3. Politicieni Watch — tracker promisiuni vs realizări

**Impact**: transformative · **Effort**: XL

Bază de date cu toți primarii, președinții CJ, parlamentarii pe județ, cu promisiunile electorale (extrase din programe + presă) marcate ca «îndeplinită / în lucru / abandonată / contrazisă». Cetățenii pot adăuga dovezi (citatul + sursa) și vota pe veridicitate. Scor de credibilitate per politician afișat înainte de alegeri. Integrare cu /sesizari: «Primarul X a promis reabilitare străzi în 2024 — vezi toate sesizările despre străzi deteriorate trimise lui».

> **Tech**: Tabele politicians, promises, evidence, votes. Scraper inițial pentru AEP + presă locală, moderare manuală asistată de AI pentru abuse. RLS strictă pe vot.

---

### 4. Auto-Petiție când >50 sesizări similare

**Impact**: transformative · **Effort**: L

Când un cluster de sesizări (tip + județ + perioadă) depășește pragul de 50, sistemul generează automat o petiție națională sintetizată de AI: titlu, expunere de motive cu date statistice reale din sesizări, listă cereri concrete. Petiția se publică pe /petitii și e propusă tuturor sesizărilor părinte spre semnare. Transformă frustrarea individuală în presiune politică agregată.

> **Tech**: Cron daily care rulează agregare pe (tip, judet, ultimele 90 zile). Groq generează draft, admin aprobă într-un panou de moderare înainte de publicare automată.

---

### 5. Civia Score — credit civic cu beneficii reale

**Impact**: transformative · **Effort**: L

Sistem de scor 0-1000 calculat pe acțiuni civice verificate (sesizări rezolvate, petiții semnate, articole citite, vot la consultări). Scor afișat pe profil public opțional. Parteneriate cu ONG-uri, librării, cafenele, transport public pentru reduceri reale la scoruri mari. Badge-uri trimestriale: «Top 10 Brașov», «Vocea Cartierului Manastur». Anti-gaming prin verificări (sesizările care primesc răspuns oficial cântăresc mai mult decât cele neresolvate).

> **Tech**: Tabelă scores cu re-calc nightly via cron, ledger de events (event_type, weight, verified_at). Algoritm cu decay temporal — punctele vechi se diminuează.

---

### 6. Predictive Civic — Hartă probabilistică probleme viitoare

**Impact**: transformative · **Effort**: XL

ML model care prezice unde vor apărea probleme în 30/60/90 zile pe baza istoricului: «Strada Cluj — probabilitate 78% gropi în asfalt în martie» sau «Cartier Floreasca — risc poluare AQI > 100 până vineri». Cetățenii primesc notificare preventivă, primăria primește alertă pentru intervenție pro-activă. Combină istoric sesizări, vreme, sezonalitate, lucrări planificate.

> **Tech**: Feature engineering pe sesizari + outages + weather API (Open-Meteo). XGBoost sau LightGBM rulat pe Modal/Replicate, exportat ca tabel predictions. Heatmap Leaflet cu opacitate per probabilitate.

---

### 7. Civia Live — Townhall video lunar cu primarul

**Impact**: transformative · **Effort**: L

Eveniment lunar video live unde primarii invitați răspund întrebărilor cetățenilor agregate pe Civia, moderat de echipa platformei. Cetățenii submit întrebări în avans, votează pe cele mai relevante (Reddit-style), Top 10 sunt răspunse live. Înregistrare publică, transcript AI cu timestamp pe răspuns, follow-up: dacă primarul promite ceva live, devine entry în Politicieni Watch.

> **Tech**: Integrare Livepeer sau Mux pentru streaming, Whisper pentru transcript, link automat în Politicieni Watch cu evidence_type='live_promise'.

---

### 8. Buget Participativ Național — propune & votează proiecte locale

**Impact**: transformative · **Effort**: XL

Platformă completă de buget participativ pentru orice primărie care vrea să adopte (replică Decidim Barcelona / Madrid Decide). Cetățenii propun proiecte (cu cost estimat, locație, beneficiari), comunitatea dezbate, votează în ferestre oficiale. Civia oferă tooling gratuit primăriilor cu populație <50k care nu au resurse. Validare CNP via ROeID/Bucuresti DigitalSign.

> **Tech**: Modul nou /buget-participativ/[primarie], integrare cu ROeID pentru one-citizen-one-vote, geofence cu PostGIS pentru voturi locale, audit log imutabil pentru transparență.

---

### 9. Sesizare Vocală + WhatsApp Bot

**Impact**: transformative · **Effort**: XL

Cetățenii pot face o sesizare vorbind 30 secunde la telefon (1-800-CIVIA) sau trimițând voice note pe WhatsApp Business. AI (Whisper + Groq) transcrie, clasifică, geo-localizează din voice context, generează draftul formal și trimite cetățeanului link de confirmare prin SMS. Elimină barierele pentru bunici, oameni fără digital literacy, persoane cu dizabilități.

> **Tech**: Twilio Voice + WhatsApp Business API, Whisper large-v3, pipeline async cu BullMQ pe Redis. Costuri Twilio/WhatsApp implică sponsorship.

---

### 10. Civia Federated — protocol open pentru civic tech

**Impact**: transformative · **Effort**: XL

Expunere ActivityPub-style a sesizărilor publice și petițiilor, astfel încât platforme similare din Bulgaria, Polonia, Ungaria sau ONG-uri RO să poată subscribe și colabora. Romania devine hub regional pentru civic-tech federation. Sesizările transfrontaliere (poluare Dunăre, vamă Vama Veche) pot avea semnatari din mai multe țări. Inspirat Mastodon + Fediverse.

> **Tech**: WebFinger + ActivityPub endpoints, Signed HTTP signatures, outbox pe fiecare actor (sesizare/petiție). Compatibilitate parțială cu Mastodon pentru cross-post.

---


## ✨ SMALL features (51) — quick wins

### 1. Status Page personal — «Sesizările mele» — `high` · `M`

Dashboard centralizat /cont/sesizari care arată toate sesizările cetățeanului cu progress bar (Trimisă → Recepționată → În lucru → Rezolvată). Inspirat din track-package UPS. Counter de zile rămase până la termenul legal (30 zile OG 27/2002) cu culoare semafor.

### 2. Push notifications PWA — `high` · `S`

Web Push API pentru notificări când autoritatea răspunde, când o sesizare similară a fost rezolvată pe strada ta, sau când o petiție pe care ai semnat-o atinge un milestone. Service worker existent în Next 16 PWA mode.

> Tech: VAPID keys, tabel push_subscriptions, opt-in granular pe canale în /cont/notificari.

### 3. Comentarii pe sesizările publice — `medium` · `M`

Cetățenii pot comenta pe sesizările publice ale altora (cu moderare AI anti-toxic). Discuție civilizată, sortare după upvotes Reddit-style. Crește engagement și permite confirmare colectivă: «Și eu am pățit asta acum 2 săptămâni».

### 4. Tag «Eu sunt afectat» — `high` · `S`

Pe sesizare publică, buton «Sunt și eu afectat» care incrementează counter și trimite o notificare grupată autorității la 24h: «Sesizarea #1234 are acum 47 cetățeni afectați». Lightweight version de Cazuri Colective.

### 5. Embed widget pentru bloguri / presă — `medium` · `S`

Buton «Embed» pe orice sesizare publică sau petiție care generează iframe responsive pentru bloguri civice, presă locală, ONG-uri. Crește vizibilitatea Civia organic.

> Tech: /embed/sesizare/[code], CSP frame-ancestors *, dimensiuni 600x400/800x600.

### 6. Export PDF profesional al sesizării — `high` · `M`

Buton «Descarcă PDF oficial» pe pagina sesizării care generează un document cu antet Civia, conținut formal, semnătura electronică a cetățeanului (dacă a încărcat-o), QR code spre versiunea online verificabilă. Util pentru depunere fizică la registratură.

> Tech: react-pdf sau Puppeteer headless, fonts Inter + serif românesc.

### 7. Mod «expat» — Civia în engleză — `medium` · `M`

Switch limbă EN/RO pentru expați și jurnaliști străini. Sesizările rămân în RO (e cum primăria le citește) dar UI, ghidurile, fact-pack-urile sunt traduse. Crește credibilitate internațională.

> Tech: next-intl, dictionar JSON pentru UI; conținut user-generated rămâne RO cu link Translate.

### 8. Calendar consultări publice (toate primăriile) — `high` · `M`

Agregare a tuturor consultărilor publice anunțate pe legestart.ro și site-urile primăriilor (scrape lunar). Calendar /consultari cu filtru pe județ + tip act. Notificare push cu 7 zile înainte de termen.

### 9. Quiz «Cine este primarul tău?» — `medium` · `S`

Quiz interactiv de 5 întrebări pentru cetățenii care nu știu cine îi reprezintă local. Output: «Primarul X (PSD), CL Y, președinte CJ Z» cu link spre profilurile lor. Onboarding distractiv care crește activarea.

### 10. Search semantic în toate sesizările — `medium` · `M`

Bara de căutare cu embeddings semantice peste toate sesizările publice. «Câini fără stăpân» găsește și «maidanezi», «haite», «câini comunitari». Power user feature pentru jurnaliști.

> Tech: pgvector pe coloana descriere, embedding cu Voyage-3-lite la creare.

### 11. Galerie foto «Înainte / După» — `high` · `S`

Când o sesizare e marcată rezolvată, cetățenii pot încărca o poză «după» care apare side-by-side cu cea «înainte». Galerie publică /rezolvate cu cele mai impresionante transformări. Proof social puternic.

### 12. Sondaj rapid săptămânal — `medium` · `S`

Single-question poll afișat în header pentru toți utilizatorii («Cum evaluați mandatul primarului în 2026?»). Răspuns 1-click, rezultate agregate pe județ. Source de continut pentru presă: «47% din cetățenii Civia din Cluj sunt nemulțumiți».

### 13. «Sesizarea săptămânii» — newsletter highlight — `medium` · `S`

Editorial pick săptămânal: sesizarea cea mai impresionantă, cea mai rapid rezolvată, sau cea care a generat schimbare. Afișată pe home + în newsletter. Recunoaștere publică pentru autor (badge + scor Civia).

### 14. Auto-detect duplicat înainte de submit — `high` · `M`

Când cetățeanul scrie sesizarea, după 50 caractere și locație, sistemul caută duplicate semantice în raza de 100m. «Există deja 3 sesizări similare la 50m. Vrei să te alături sau să trimiți separat?»

> Tech: Debounce 800ms, embedding cerere + KNN cu pgvector, geo-filter PostGIS.

### 15. Sticker / shareable cards (Instagram-ready) — `medium` · `S`

Generator de imagine 1080x1080 cu rezumat sesizare/petiție, brand Civia, QR code. Buton «Share pe Instagram Stories» care preîncărcă imaginea. Engagement viral pentru Gen Z.

> Tech: @vercel/og pentru generare, OG image dinamic per sesizare.

### 16. Map clustering cu MarkerCluster — `medium` · `S`

Pe /harti, când sunt >1000 sesizări vizibile, clustering automat în bule numerice care explodează la zoom. Performance + UX dramatic mai bun pentru Bucuresti, Cluj, Iasi.

> Tech: Leaflet.markercluster, deja compatibil cu setup-ul actual.

### 17. Filtru temporal pe hartă (slider) — `medium` · `S`

Slider sub hartă: «Arată sesizările din ultimele 7 / 30 / 90 / 365 zile» sau range custom. Animație play care arată cum apar și dispar problemele în timp. Util pentru jurnaliști și analiști.

### 18. Heatmap public pe /harti — `high` · `S`

Layer toggle «Densitate sesizări» care randează heatmap (gradient roșu) peste oraș. Identifică instant cartierele problematice. Folosește deja AirHeatGrid pattern din proiect.

> Tech: Reuse Canvas IDW din AirHeatGrid, alimentat cu sesizari (lat, lon, count).

### 19. Civic Onboarding — wizard 60s — `high` · `S`

First-time user flow: 4 pași (alege județ → urmărește 3 subiecte → activează notificări → primește newsletter de bun-venit). Crește retention day-7 cu 30-50% conform best practice SaaS.

### 20. Profile public opțional — `medium` · `M`

Cetățenii pot activa profil public /u/[username] cu sesizări publice, badge-uri, scor Civia. Default privat. Permite recunoaștere pentru activiști, jurnaliști cetățeni.

### 21. Follow pe utilizatori activiști — `medium` · `M`

Buton Follow pe profilele publice. Feed personalizat «Activistii pe care îi urmăresc» — vezi ce sesizări postează, ce petiții semnează. Mastodon vibe pentru civic.

### 22. RSS feed per județ + tip sesizare — `medium` · `S`

Feeduri RSS publice /rss/sesizari/[judet] și /rss/petitii etc. Power users și jurnaliști pot subscribe în Feedly / NetNewsWire. Civia devine sursă canonică pentru civic data RO.

### 23. API publică gratuită (rate-limited) — `medium` · `M`

/api/public/v1/sesizari, /petitii, /outages cu key gratuit (1000 req/zi) și rate limit Upstash. Permite jurnaliști și cercetători să construiască vizualizări proprii. Documentație pe /developers.

> Tech: Reuse Upstash rate limit, key în tabel api_keys, doc cu Mintlify sau Scalar.

### 24. Mod offline (PWA cache) — `medium` · `M`

Service worker care cache-ează ghidurile, hărțile județului user-ului, sesizările proprii. Cetățeanul poate redacta o sesizare offline în zonele rurale fără semnal — se sincronizează la reconectare.

### 25. Voice-to-text pentru descrierea sesizării — `medium` · `S`

Buton microfon în formularul de sesizare care folosește SpeechRecognition browser API pentru a transcrie vocea în text. Util pentru utilizatori cu dizabilități sau cei cu tastatură mică pe telefon.

### 26. Drag-and-drop multi-photo cu reorder — `medium` · `S`

Suport pentru 5-10 poze per sesizare cu drag-to-reorder, preview, click-to-remove. AI analizează toate pozele (nu doar prima) pentru context mai bogat.

### 27. Compress automat poze >5MB client-side — `medium` · `S`

Browser image compression înainte de upload (target 1MB, max 2048px) pentru a accelera upload pe 4G și a economisi storage. Folosește browser-image-compression.

### 28. Avatar generator gratuit — `low` · `S`

Pe profil, opțiune de generare avatar abstract (DiceBear API) bazat pe username. Evită upload de poze personale și păstrează identitate vizuală.

### 29. Dark mode toggle în header — `medium` · `S`

Toggle vizibil sun/moon în header (acum doar prefers-color-scheme). Persistă în cookie. Multi user explicit cerea control.

### 30. Print-friendly CSS pentru sesizări — `medium` · `S`

@media print stylesheet care ascunde nav, header, comentarii, și aranjează sesizarea ca document A4 oficial. Util pentru cetățenii care vor să meargă cu hârtia la primărie.

### 31. Shortcut tastatură pentru power users — `low` · `S`

Cmd+K pentru search global, G+S pentru sesizări, G+P pentru petiții, N pentru sesizare nouă. Cmd palette Linear-style. Power user delight.

> Tech: cmdk library, react-hotkeys-hook.

### 32. Achievements / badges — `medium` · `S`

Badge-uri vizuale pe profil: «Prima sesizare», «10 sesizări rezolvate», «Vocea Cartierului», «Activist de 1 an». Gamification subtilă fără să devină cringe.

### 33. Referral / invită prieten — `medium` · `S`

Link unic /invita/[code] care când e folosit de un prieten dă +50 Civia Score ambilor. Growth loop organic.

### 34. Integrare Ghiseul.ro (deeplink) — `medium` · `S`

Pe ghidurile despre taxe + amenzi, buton «Plătește pe Ghișeul.ro» care deeplink direct la formularul corect. Reduce frustrarea de a căuta manual pe portal.

### 35. Sesizare programată / scheduled — `low` · `S`

Cetățeanul poate scrie sesizarea acum și programa trimiterea pentru luni dimineața la 9:00 (când primăria deschide). Crește rata de citire timpurie de către funcționari.

### 36. Răspuns automat «mulțumesc» la rezolvare — `low` · `S`

Când autoritatea răspunde că s-a rezolvat, cetățeanul primește un draft de mulțumire pre-completat de AI pe care îl poate trimite cu un click. Civilitate care reciprocates positive behavior.

### 37. Reminder de re-sesizare dacă autoritatea nu răspunde în 30 zile — `high` · `S`

Cron care detectează sesizările fără răspuns la +30 zile (termen OG 27/2002 depășit) și trimite cetățeanului email/push: «Termenul legal a expirat. Vrei să escaladezi la Prefectură / ANAP / DSP?» cu draft pregătit.

### 38. Escaladare în 1-click către Prefectură / ANI / Avocatul Poporului — `high` · `M`

Buton «Escaladează» pe sesizările cu termen depășit care generează a doua sesizare formală către autoritatea ierarhic superioară, cu referință la sesizarea inițială și termenul nerespectat.

### 39. Anchor links + table of contents pe ghiduri — `medium` · `S`

Pe /ghiduri, sidebar sticky cu TOC auto-generat din H2/H3, scroll-spy highlight. Pattern gov.uk + Stripe Docs. Util pentru ghiduri lungi.

### 40. Comparator candidați la alegeri — `high` · `M`

Înainte de alegeri locale 2028, tabel side-by-side cu toți candidații dintr-o localitate: program, scor Politicieni Watch, sesizări către ei dacă deja sunt în funcție. Voter helper.

### 41. Hartă investiții publice (PNRR / fonduri UE) — `high` · `M`

Layer pe /harti cu toate proiectele PNRR și fonduri UE finanțate în comuna ta, cu status, buget, termen. Sursa: mfe.gov.ro + PNRR dashboard. Cetățenii pot sesiza dacă proiectul nu există fizic.

### 42. Statistici lunar primărie pe profil public — `high` · `M`

Pagina /primaria/[slug] cu: total sesizări, rată răspuns, timp mediu răspuns, top 3 categorii, comparație cu media națională. Transparență presiune pe primării.

### 43. Ranking primării pe transparență — `high` · `S`

Pagina /ranking-primarii sortată după rate-of-response, viteză, satisfacție. Public, share-abil, refresh lunar. Generează presă: «Top 10 cele mai responsive primării din România».

### 44. Widget «Sesizările tale» pentru iPhone/Android — `low` · `M`

Home screen widget cu count sesizări active, ultimul status update. Folosește PWA shortcut + Android widgets. iOS via Shortcut app.

### 45. Quick action via URL params — `medium` · `S`

Deep link /sesizari/noua?tip=groapa&lat=X&lng=Y care pre-populează formularul. Util pentru QR coduri lipite pe obstacole («Scanează ca să raportezi această groapă»).

### 46. QR code pentru sesizare publică — `low` · `S`

Fiecare sesizare are QR code descărcabil care duce la pagina ei publică. Cetățeanul îl poate lipi pe obiectul problematic (e.g. coș de gunoi spart) pentru ca alții să confirme.

### 47. Translate one-click pentru răspunsurile birocratice — `high` · `S`

Pe răspunsurile primite de la primării (adesea în limbaj juridic-birocratic obscur), buton «Tradu în română simplă» care folosește Groq pentru reformulare accesibilă, păstrând sensul.

### 48. Săptămânalul AI «Ce s-a întâmplat în județul X» — `medium` · `M`

Newsletter săptămânal personalizat per județ: top 5 sesizări rezolvate, top 3 nereolvate, petiție activă, știre relevantă. AI generat. Inbox-friendly, 2 min de citit.

### 49. Mobile-first bottom tab bar — `high` · `S`

Pe mobil, tab bar fixă jos cu 5 iconuri (Acasă, Sesizări, Hartă, Petiții, Cont). Pattern Instagram/TikTok-style. Reduce friction de navigare, crește engagement pe mobil (>70% din trafic).

### 50. Skeleton loaders pe toate paginile dinamice — `medium` · `S`

Înlocuiește spinner-ele cu skeleton screens pentru perceived performance mai bună. Pattern LinkedIn / Facebook. Loading.tsx files în App Router fac asta natural în Next 16.

### 51. Confetti la prima sesizare rezolvată — `low` · `S`

Micro-moment de bucurie când primești primul răspuns pozitiv: animație confetti + mesaj «Ai schimbat ceva! Spune-le și prietenilor». Boost emoțional + share trigger.

> Tech: canvas-confetti library, 5KB gzipped.


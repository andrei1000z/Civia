# 🚀 10 Features MAJORE Game-Changing pentru Civia.ro

> Features mari care transformă Civia dintr-o platformă de sesizări într-un sistem civic complet. Toate sunt fezabile pe stack-ul actual (Next.js 16 + Supabase + Groq + Cloudflare) cu budget realist.

---

## 1. 🤖 Agent AI „Insistent" — escaladare automată sesizări nerespunse

**Tier**: big · **Impact**: transformative · **Effort**: L

### Descriere
Un agent AI care urmărește fiecare sesizare după trimitere și ESCALADEAZĂ automat când autoritatea nu răspunde. Pipeline:
- **Ziua 30** (termen legal OG 27/2002 expirat): trimite automat REAMINTIRE cu citarea articolului + warning despre Avocatul Poporului
- **Ziua 45**: trimite CC către Avocatul Poporului (`relatii_publice@avp.ro`) + Prefectura județului
- **Ziua 60**: generează automat plângere contencios administrativ (template legal) pe care cetățeanul o poate semna și depune
- **Continu**: monitorizează inbox-ul pentru orice răspuns târziu și update status

### User Story
Ca cetățean care a depus o sesizare ignorată de primărie, vreau ca Civia să escaladeze automat la autorități superioare și să-mi pregătească pașii legali următori, ca să nu pierd termenele și să forțez un răspuns real.

### Technical Notes
- pg_cron job zilnic care query-ează `sesizari WHERE delivery_status='delivered' AND no_reply_for > 30 days`
- Groq Llama 3.3 70B pentru template-uri personalizate per caz
- Integration cu API `apv.ro`/`prefectura.ro` (research necesar)
- PDF generator pentru plângerea contencios administrativ

### Civic Value
**SCHIMBĂ JOCUL**. Primăriile răspund azi pentru că ESCALATION = automat. „Dacă nu răspunzi în 30 zile, peste 15 zile Avocatul Poporului primește CC, peste 30 zile contencios administrativ" devine UN DAT. România civic = ai instrumente automate vs primăria neglijentă.

---

## 2. 📞 Asistent Civic AI care telefonează la primărie (cu acordul cetățeanului)

**Tier**: big · **Impact**: transformative · **Effort**: XL

### Descriere
Pentru sesizările urgente (groapă mare, semafor defect, copac căzut), cetățeanul poate cere ca Civia să TELEFONEZE direct la dispeceratul primăriei (PMB 021 9544, etc.) cu un AI voice agent care:
- Se prezintă: „Bună ziua, sunt asistentul AI Civia.ro, sun în numele cetățeanului X care a depus sesizarea cu codul Y"
- Explică problema concis (max 30 sec)
- Solicită numărul de înregistrare verbal
- Înregistrează conversația ca proof
- Trimite recording + transcript la cetățean pe email

### User Story
Ca cetățean care nu vorbește bine la telefon sau nu are timp, vreau ca Civia să sune în numele meu la dispecerat ca să primesc un nr înregistrare imediat fără să stau eu la coadă telefonică 20 min.

### Technical Notes
- Twilio/Vonage Voice API + Groq Whisper STT + Groq Llama TTS (OpenAI compatible)
- Recording auto + transcript storage R2
- Acord explicit GDPR — cetățeanul confirmă recording
- Limit 3 calls/zi/cetățean ca să nu abuzăm
- Cost: ~$0.10 per call

### Civic Value
**TRANSFORMATIV**. Telefonul = format primar în RO civic. Eliminăm bariera „nu am timp / nu știu ce să zic / mi-e frică". Cetățeni vârstnici sau fără skill comunicare formală pot folosi sistemul.

---

## 3. 📺 Stream live ședințe consiliu local cu transcript AI + alerte personalizate

**Tier**: big · **Impact**: transformative · **Effort**: L

### Descriere
Ingest video stream YouTube/Facebook al ședințelor consiliu local (PMB + 6 sectoare + 41 capitale județe = ~50 streams). Pipeline:
- **Stream capture** continuu cu Cloudflare Stream + audio extract
- **Transcript AI** real-time cu Groq Whisper
- **AI tagging**: detect proposals voted, motions tabled, urban planning items
- **Personalized alerts**: cetățeanul setează „alertează-mă când în consiliul Sector 5 se discută Calea 13 Septembrie" → push notification + email cu timestamp + clip 30s
- **Searchable archive**: full-text search pe transcripte istorice

### User Story
Ca cetățean interesat de cartierul meu, vreau să primesc notificare când consiliul local discută strada mea, ca să pot urmări/contesta în timpul votului, fără să mă uit 6h de ședință.

### Technical Notes
- Cloudflare Stream pentru ingest
- Groq Whisper batch processing pe segments 30s
- pgvector pentru semantic search arhivă
- Edge function pentru alert delivery
- Storage R2 pentru recordings (lifecycle 90 zile)

### Civic Value
**ENORM**. Consiliile locale = unde se iau deciziile reale (buget, urbanism, parking). Acum sunt opace — chiar streamingul existent e nesearchabil. Civia face transparența reală: „consiliul a votat aseară să demoleze parkul X" → cetățenii știu IMEDIAT.

---

## 4. 💰 Buget interactiv comparativ „Pe banii MEI" — vizual + per categorie

**Tier**: big · **Impact**: high · **Effort**: L

### Descriere
Cetățeanul introduce salariul lunar + județul → Civia calculează exact câți lei din taxele lui (impozit + CAS + CASS + TVA) merg la fiecare departament al primăriei. Apoi vizualizează:
- **Treemap interactiv** cu sumele alocate (poliție locală, salubrizare, infrastructura, etc.)
- **Comparare** cu alte primării din țară pentru aceeași categorie
- **„Cumpărate pe banii tăi"** — lista achiziții publice locale: „Tu ai contribuit cu 23 RON la mașina X cumpărată de PMB"
- **Pulse** cu sesizările făcute pe acea infrastructură: „Banii tăi au plătit asfaltul pe Calea Griviței care are 47 sesizări nerezolvate"

### User Story
Ca contribuabil, vreau să văd EXACT ce face primăria cu banii mei și să compar cu alte orașe, ca să pot vota informat și pretinde rezultate concrete.

### Technical Notes
- Open data integration: data.gov.ro + Tenders Electronic Daily (TED)
- Recharts pentru treemap interactiv
- Calcul realtime din salariu → contribuții
- Cache zilnic în Supabase materialized view

### Civic Value
**MASIV**. „Pe banii MEI" = framing care personalizează abstractul „buget public". Cetățeanul vede legătura directă bani-rezultate-sesizări. Pressure pe primării pentru cheltuieli transparente + sponsor real activism.

---

## 5. 🎯 „Inițiativă cetățenească" — petiții locale cu OTP SMS gratuit + validare oficială

**Tier**: big · **Impact**: transformative · **Effort**: XL

### Descriere
Mecanism complet de inițiative cetățenești locale care RESPECTĂ legea (Legea 189/1999). Cetățenii pot:
- **Initialize** o petiție/inițiativă (de ex: „Bicicleta pe Calea Griviței") cu titlu + descriere + obiectiv legal
- **Sign** cu OTP SMS gratuit (Civia plătește SMS-uri) — verificat real
- **Tracker** până la nr minim de semnături (depinde de oraș — 100-500)
- **Auto-generate** documentația oficială pentru depunere la Consiliul Local
- **Track** progresul depunerii și votul consiliului
- **Public dashboard** cu toate inițiativele în curs din țară

### User Story
Ca cetățean care vrea schimbare reală în cartier, vreau un instrument de inițiative cetățenești care să facă procesul legal trivial — colectez semnături online, validez cu SMS, generez dosarul, urmăresc votul, fără să cunosc avocat.

### Technical Notes
- Twilio/Vonage SMS API (cost ~$0.05/SMS → $5 pentru 100 semnături)
- OTP 6 cifre + verificare CNP (opt-in)
- PDF generation cu wkhtmltopdf
- Legal templates per oraș (research necesar — primării au statute diferite)
- Anti-fraud: 1 SMS/CNP, geofencing

### Civic Value
**REVOLUȚIONAR**. Inițiativele cetățenești sunt rare în RO pentru că birocrația e cumplită. Civia face procesul 1-click. Schimbare locală reală devine fezabilă pentru cetățean obișnuit, nu doar ONG-uri.

---

## 6. 🗺 Hartă 3D AR pentru proiecte urbanistice cu vot cetățenesc

**Tier**: big · **Impact**: high · **Effort**: XL

### Descriere
Primăria publică un proiect (de ex „Pasaj nou pe Pantelimon-Chișinău"). Civia oferă:
- **Vizualizare 3D** a proiectului propus suprapus pe imagine satelit + Street View
- **AR mode mobile** — cetățeanul pointează telefonul spre intersecție și vede proiectul SUPRAPUS în AR
- **Vot cetățenesc consultativ** — pro/contra + comentariu
- **Alternative crowdsourced** — cetățenii desenează contra-propuneri rapide
- **Impact estimat AI**: trafic, zgomot, mediu, pietoni

### User Story
Ca cetățean care urmează să fie afectat de un proiect urbanistic, vreau să văd cum va arăta IN REAL LIFE, să dau feedback informat, și să văd alternative pe care nu le-am imaginat singur.

### Technical Notes
- Three.js pentru 3D web
- WebAR (8thwall sau MindAR) pentru iOS Safari
- GeoJSON for project boundaries + GLB models
- Integration cu PUG (Plan Urbanistic General) PDF parsers
- Cost: $$ dezvoltare 3D models per proiect

### Civic Value
**MARE**. Consultările publice azi = PDF cu plan tehnic neințeles. Civia transformă în experiență vizuală accesibilă. Mai mulți cetățeni → opoziție/sprijin informat → primării mai responsabile.

---

## 7. 📊 Open Data Marketplace pentru jurnaliști + cercetători

**Tier**: big · **Impact**: high · **Effort**: L

### Descriere
Civia agregă date publice oficiale + crowdsourced și le servește JSON/CSV/Parquet:
- **Sesizări publice** (anonimizate, geo-tagged) — toate cele rezolvate cu timeline
- **Contracte publice** (ANAP scrape + cleaning)
- **Buget primării** (annual)
- **Trafic + air quality** (live)
- **Avere demnitari** (ANI scrape)
- **API REST + GraphQL** cu rate limits per tier (free 1000/zi, $20/mo pentru 100k/zi)
- **Pre-built notebooks** (Jupyter) pentru cercetători comuni: „Top 10 primării cu cele mai multe sesizări nerezolvate", etc.

### User Story
Ca jurnalist de investigație, vreau acces rapid la date civice agregate ca să public materiale ancorate în date reale, fără să petrec 2 săptămâni curățând CSV-uri de pe data.gov.ro.

### Technical Notes
- Supabase + pgvector pentru search semantic
- DuckDB pentru export Parquet
- Cloudflare Workers pentru API
- Authentication API keys + Stripe pentru tiers paid
- Revenue stream pentru sustainability Civia

### Civic Value
**STRATEGIC**. Jurnaliști = forța multiplicatoare pentru civic. Articolul „95% din sesizările pe parcare ilegală în S2 sunt ignorate" publicat în Gândul/HotNews bazat pe API Civia = MAXIM PRESSURE pe autoritate.

---

## 8. 💸 Compass Finanțare UE — alertă personalizată + asistent aplicare

**Tier**: big · **Impact**: high · **Effort**: L

### Descriere
Există SUTE de programe UE active pentru cetățeni RO (microîntreprinderi, fermieri, ONG-uri, primării, comunități). Civia:
- **Profil cetățean**: rol (student, antreprenor, primar, etc.) + interes (energie verde, agricultură, smart city)
- **Match AI** zilnic cu programele UE deschise (FEADR, POR, POIM, etc.)
- **Notification push**: „Apel deschis: 500k EUR pentru biciclisti urbani — termen 30 zile"
- **Assistent AI aplicare**: ghidează completarea dosarului, deadlines, documente necesare
- **Public dashboard**: bani UE absorbiți pe județ + lista beneficiari

### User Story
Ca antreprenor mic care nu are timp să citească Monitorul Oficial zilnic, vreau să fiu alertat când există apel UE pe domeniul meu cu suficient timp să aplic.

### Technical Notes
- Scrape fonduriueministerial.ro + EU funding sites (PrivateNetwork TED)
- Groq Llama match: profil ↔ program
- PDF assistant pentru dosare (RAG)
- Public ANAF data pentru beneficiari

### Civic Value
**ECONOMIC + CIVIC**. RO returnează miliarde EUR neabsorbite anual. Civia ajută alocare democratică — nu doar marii consultanți știu de apeluri.

---

## 9. 🔍 Verificare Avere Demnitari cu Pattern Detection AI

**Tier**: big · **Impact**: high · **Effort**: L

### Descriere
ANI (Agenția Națională de Integritate) publică declarațiile de avere ale demnitarilor. Sunt PDF-uri 30 pagini fiecare, gretu de comparat. Civia:
- **Scrape** toate declarațiile ANI (~10k demnitari)
- **AI extraction** cu pattern detection:
  - Salt brusc în avere între ani (>50%)
  - Discrepanțe gen „salariu 5k/lună dar acumulare 500k cash în 1 an"
  - Conflict interes (companie proprie care primește contracte de la instituția unde lucrează)
  - Family chain: rude care primesc contracte de la instituția demnitarului
- **Public leaderboard**: „Top 50 demnitari cu salt suspect de avere"
- **Notificare** Direcția Națională Anticorupție cu evidence pack

### User Story
Ca cetățean care vrea să voteze informat, vreau un dashboard public unde să văd care politicieni au pattern suspect de îmbogățire, susținut cu date oficiale ANI, nu doar zvonuri.

### Technical Notes
- ANI PDF scrape + OCR (Tesseract sau Gemini Vision)
- Time-series analysis pe avere/an
- Graph neural network pentru detect conflict interes prin rețele rude
- pgvector pentru similaritate suspicioasă cazuri
- LEGAL REVIEW NECESAR pentru defamation risk

### Civic Value
**ANTI-CORUPȚIE**. România = corupție endemic. Civia face transparenta accesibilă, nu doar pentru ZIarul Lumina sau PressOne.

---

## 10. 🏛 „Decizii Deschise" — orice propunere consiliu local cu rezumat AI + comments cetățenești

**Tier**: big · **Impact**: transformative · **Effort**: L

### Descriere
Toate propunerile la dispoziția consiliilor locale (PMB + sectoare + județe) sunt ingerate de Civia:
- **AI Summary** pentru fiecare propunere („Pe scurt: ce schimbă, cine câștigă, cine pierde")
- **Visual diff** cu varianta anterioară (dacă e modificare ordonanță existentă)
- **Comments** cetățenești înainte de vot — primăria DEAJA OBLIGATĂ să le publice (Legea 52/2003)
- **Vote tracker**: cum a votat fiecare consilier
- **Lobby map**: cine a comentat în favoarea propunerii (asociații, firme) — public list
- **Notification**: cetățeanul abonat la „transport urban" primește alert când propunere relevantă

### User Story
Ca cetățean interesat de politica locală, vreau să fiu informat înainte de vot despre toate propunerile relevante mie, să comentez public, și să văd ulterior cum a votat consilierul meu, ca să-l pot judeca la următoarele alegeri.

### Technical Notes
- Scrape consiliu local websites (Bucuresti, sectoare, Cluj, Timisoara, etc.)
- AI summarization + diff
- Comments cu moderation (auto + admin)
- Public DB voting record
- pg_cron daily refresh

### Civic Value
**FUNDAMENTAL**. Consiliile locale = unde se ia 80% din deciziile care afectează viața. Acum sunt opace. Civia face transparență sistemică — cetățeanul are voce în legislativul local.

---

## 🎯 Sinteză Effort vs Impact

| # | Feature | Effort | Impact | ROI |
|---|---|---|---|---|
| 1 | Agent AI Insistent | L | transformative | 🔥🔥🔥 |
| 2 | Asistent telefonic AI | XL | transformative | 🔥🔥 |
| 3 | Stream ședințe AI | L | transformative | 🔥🔥🔥 |
| 4 | Buget „pe banii MEI" | L | high | 🔥🔥 |
| 5 | Inițiative cetățenești OTP | XL | transformative | 🔥🔥🔥 |
| 6 | AR proiecte urbanistice | XL | high | 🔥 |
| 7 | Open Data Marketplace | L | high | 🔥🔥 |
| 8 | Compass UE | L | high | 🔥🔥 |
| 9 | Verificare avere | L | high | 🔥🔥 |
| 10 | Decizii Deschise | L | transformative | 🔥🔥🔥 |

### Recomandare ordine implementare (1-an roadmap)

**Q1 (90 zile)**: #1 Agent AI Insistent (cea mai rapidă, leveraging email pipeline existent)
**Q2**: #10 Decizii Deschise + #4 Buget „pe banii MEI" (data-driven, scrape primării)
**Q3**: #5 Inițiative cetățenești (mecanismul legal complet)
**Q4**: #3 Stream ședințe + #7 Open Data Marketplace (infrastructura mare)

#2, #6, #8, #9 — anul 2 sau parteneriat cu ONG-uri specializate.

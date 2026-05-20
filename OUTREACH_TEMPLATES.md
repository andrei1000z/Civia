# Outreach templates — jurnaliști + ONG-uri RO

> Template-uri editabile pentru a contacta jurnaliști, redacții și ONG-uri pentru parteneriate Civia.

## 1. Email rece la jurnalist investigativ

**Subject:** Date publice gratuite pentru articole civice (CC BY 4.0)

```
Salut [Nume],

Sunt [Tu], creator al Civia.ro — platformă civică gratuită care
permite cetățenilor să trimită sesizări AI-formalizate către primării
din toate 42 de județe.

Am observat articolul tău despre [subiect] și cred că datele Civia
ti-ar putea fi utile pentru continuări:

- 📊 API public CC BY 4.0: https://civia.ro/dezvoltatori
- 🏆 Clasament primării (rata răspuns): /api/v2/clasament
- 📍 Harta sesizări live: civia.ro/sesizari-publice/harta
- 📰 Press kit complet: civia.ro/PRESS_KIT.md

Câteva idei de articole:
1. „Care primării răspund cel mai prost la sesizări"
2. „Top 10 zone de oraș cu cele mai multe gropi raportate"
3. „Sectorul X are de 5× mai multe sesizări de parcare ilegală decât Sectorul Y"

Dacă te interesează un export custom de date sau o întâlnire pentru
brief tehnic, sunt disponibil oricând.

Cu respect,
[Nume]
civia.ro
```

## 2. Email la ONG civic-tech

**Subject:** Parteneriat Civia.ro — date publice + API gratuit

```
Salut [Nume ONG],

Civia.ro este o platformă civică pentru România cu:
- 42 județe + 6 sectoare București
- AI care formalizează automat sesizările cetățenilor
- API public sub CC BY 4.0 cu toate datele agregate

Pentru [Nume ONG] cred că am putea face un parteneriat în următoarele zone:

1. Embed widget Civia pe site-ul vostru (gratis)
2. Acces la dataset complet pentru research
3. Co-branding pe campanii civic awareness
4. Newsletter colaborativ „Civia + [ONG]"

Vreau să vorbim 15 minute pe Zoom?

[Nume]
```

## 3. Pitch la presa locală (după sector / județ)

**Subject:** Date despre primăria voastră — exclusiv

```
Salut redactia [Ziar],

Sunt creatorul Civia.ro și am observat că [primaria X] are una
dintre cele mai mici rate de răspuns la sesizările cetățenilor din
țară (XX%, vs 50% media națională).

Datele sunt verificabile pe API-ul nostru public:
https://civia.ro/api/v2/clasament

Am pus pentru voi un dataset specific pentru județ [Y] cu:
- Top 10 cele mai vechi sesizări fără răspuns
- Tipuri de probleme cu cele mai multe raportări
- Hot spots pe hartă

Vrei un brief tehnic prin Zoom + dataset CSV?

[Nume]
andrei@civia.ro
```

## 4. Subreddit post (r/bucuresti, r/cluj, r/Romania)

**Title:** API public gratuit pentru date civice România (CC BY 4.0)

```
Salut tuturor,

Am construit Civia.ro — platforma unde cetățenii pot trimite sesizări
formale (gen „groapă în asfalt", „mașini pe trotuar") la primării
generate automat de AI.

Recent am pus toate datele agregate sub licență CC BY 4.0 pentru
jurnaliști, ONG-uri și dataviz enthusiasts:

📊 https://civia.ro/api/v2/sesizari (lista sesizări)
🏆 https://civia.ro/api/v2/clasament (response rate per județ)
📍 https://civia.ro/api/v2/authorities (catalog 200+ autorități)
✅ https://civia.ro/api/v2/rezolvate-saptamana (success stories)

Zero auth required, 60 req/min/IP, cache la edge.

Idei dataviz / research / articole:
- Heat map sesizări nerezolvate
- Comparison București vs Cluj
- Trend lines: cum a evoluat rate-ul de răspuns
- Sentiment analysis pe comentarii publice

Documentație completă pe /dezvoltatori. Dacă faceti ceva tare, dați-mi
DM să share-uiez.

Cod va fi open-source curând. Toate sugestiile binevenite.
```

## 5. Twitter/X thread

**Tweet 1:**
```
Civia.ro tocmai a publicat API public sub CC BY 4.0 cu toate datele
agregate despre sesizări civice în România. 🇷🇴

Free pentru jurnaliști, ONG-uri, devs civic-tech. Zero auth.

Thread cu use cases 👇
```

**Tweet 2-7:**
- Endpoint 1 cu screenshot/curl
- Endpoint 2 idem
- Story: o sesizare care a devenit știre datorită datelor publice
- Comparison vs SeeClickFix (US) — Civia e open data, ei nu
- Call to action: "Construiește ceva. Tagghează-mă"

## 6. LinkedIn (lung, expertise)

**Title:** „De ce am pus toate datele Civia.ro sub licență open"

Articol 600-800 cuvinte. Highlights:
- Problema: jurnaliștii civici nu au date despre administrația locală
- Solutia: open data API simplificat la 5 endpoint-uri
- Câștigul: democratizare a accountabilității
- Provocările tehnice: rate-limit, cache, GDPR pe sesizari
- Call: parteneri (jurnaliști, ONG-uri, primării)

## Target list outreach

### Tier 1 — Investigative
- Recorder.ro (Cătălin Tolontan, Mihai Munteanu)
- PressOne (Andreea Pavel)
- Snoop.ro (Emilia Șercan)
- Inquam Photos (gallery editor)

### Tier 2 — Daily news
- Digi24 (Cosmin Savu)
- G4Media (Dan Tăpălagă)
- HotNews (Andrei Niculescu)
- Libertatea (Alex Doerr)

### Tier 3 — Civic-tech ONGs
- Code for Romania (codeforromania.ro)
- API.ro (Apel pentru Acțiune)
- Geeks for Democracy (geeksfordemocracy.ro)
- Funky Citizens

### Tier 4 — Local press (mai mici, mai entuziaste)
- B365.ro (Bucuresti)
- Stiri de Cluj
- Opinia Timisoarei
- Adevarul de Cluj
- Aradon

## Frequency & cadence

- Săptămâna 1: trimit 3 emailuri Tier 1
- Săptămâna 2: 3 emailuri Tier 2 + post Reddit
- Săptămâna 3: 5 emailuri Tier 3
- Săptămâna 4: 10 emailuri Tier 4 + LinkedIn
- Lunar: follow-up la cei care n-au răspuns

## Tracking

Adaugă UTM la fiecare link trimis:
```
?utm_source=press
&utm_medium=email-cold
&utm_campaign=press-tier1-recorder
```

Verifică pe /admin/analytics > Referrers/UTM source.

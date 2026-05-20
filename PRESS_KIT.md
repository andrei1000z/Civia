# Civia.ro — Press Kit

> Platforma civică gratuită care permite cetățenilor români să trimită sesizări AI-formalizate către primării.

## TL;DR

- 🏛️ **42 județe + 6 sectoare București** acoperite
- 🤖 **AI-formalizare automată** (Groq Llama 3.3 70B)
- 📜 **OG 27/2002 compliant** (termen 30 zile răspuns obligatoriu)
- 🆓 **100% gratuit** pentru cetățeni
- 🔒 **Privacy-first**: clauza GDPR auto-injectată
- 📊 **Open data API** pentru jurnaliști + ONG-uri (CC BY 4.0)

## Statistici

Date publice live: https://civia.ro/api/v2/clasament

- **Sesizări trimise**: vezi /api/v2/sesizari?limit=1 → câmpul `total`
- **Județe active**: 42/42
- **Autorități în catalog**: 200+ (primării, prefecturi, poliții locale, garde mediu, operatori utilități)
- **Surse știri agregate**: 30+ (Digi24, HotNews, G4Media, PressOne, Recorder, presa locală)

## Diferențiator vs alte platforme

| Feature | Civia.ro | my-cluj | bucuresti.help | Semnalam.ro |
|---------|----------|---------|----------------|-------------|
| Acoperire | 42 județe | doar Cluj | doar București | parțială |
| AI-formalizare | ✅ Groq | ❌ | ✅ | ❌ |
| Catalog autorități | ✅ 200+ | ✅ Cluj | ❌ | ❌ |
| Open data API | ✅ CC BY 4.0 | ❌ | ❌ | ❌ |
| Petiții civice | ✅ Declic+ | ❌ | ❌ | ❌ |
| Auto-escalation (30 zile) | ✅ | ❌ | ❌ | ❌ |
| Public dashboard primării | ✅ | ❌ | ❌ | ❌ |
| Codul open-source | În progres | ❌ | ❌ | ❌ |

## Endpoint-uri API publice (CC BY 4.0)

Documentație completă: https://civia.ro/dezvoltatori

```
GET /api/v2/sesizari              — lista sesizări publice
GET /api/v2/stats                 — statistici agregate
GET /api/v2/authorities           — catalog autorități verificate
GET /api/v2/clasament             — clasament județe (response rate)
GET /api/v2/rezolvate-saptamana   — top sesizări rezolvate ultima săptămână
```

Rate-limit: 60 req/min/IP. Cache la edge 4-6h.

## Use cases jurnalism

### 1. Articol „Care primării răspund cel mai bine"
```bash
curl https://civia.ro/api/v2/clasament | jq '.clasament | sort_by(-.response_rate_pct) | .[0:10]'
```

### 2. Hartă heat map sesizări per județ
- Embed: `<iframe src="https://civia.ro/sesizari-publice/harta" />`
- Sau pull `/api/v2/sesizari?county=B&limit=100` și plot pe Leaflet/Mapbox.

### 3. Before/after gallery rezolvări
- `/api/v2/rezolvate-saptamana` returnează URL-uri before + after photos.

### 4. Investigative pe autoritate specifică
```bash
curl https://civia.ro/api/v2/authorities?county=CJ
# Apoi: /api/v2/sesizari?county=CJ&status=nou (cele fără răspuns)
```

## Embed widgets

### Stats per județ
```html
<iframe
  src="https://civia.ro/embed/cj"
  width="100%"
  height="400"
  frameborder="0"
  title="Civia — Cluj sesizări"
></iframe>
```

### Top sesizări active national
```html
<iframe
  src="https://civia.ro/sesizari-publice?embed=1"
  width="100%"
  height="600"
></iframe>
```

## Asseturi vizuale

- Logo SVG: https://civia.ro/icon-512.png
- OG image: https://civia.ro/api/og (dynamic)
- Screenshots (cere prin email)

## Atribuire

Format standard la republicare date:
> Sursă: [Civia.ro](https://civia.ro) — platforma civică pentru România. Date sub licență Creative Commons CC BY 4.0.

## Contact

- 📧 Email presă: andrei@civia.ro
- 🐦 Twitter: @civia_ro
- 🦋 Bluesky: @civia.ro
- 📰 Newsroom (cere acces): https://civia.ro/dezvoltatori

## Cerere date custom

Pentru date care nu sunt în API public (ex: dataset complet pentru research),
trimite cerere la andrei@civia.ro cu:
- Cine ești + organizația
- Scopul utilizării
- Format dorit (CSV / JSON / SQL)
- Termen necesar

Răspuns garantat în 48h pentru jurnaliști și ONG-uri verificate.

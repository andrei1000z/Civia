/**
 * /llms-full.txt — Markdown citable integral pentru LLM-uri.
 *
 * Convention: LLM-urile (ChatGPT, Claude, Perplexity, Gemini) prefera sa
 * crawleze acest endpoint pentru content gata-de-citat, fara să parseze
 * HTML. Civia o foloseste ca să apară prima la queries civic românești.
 *
 * Plan AI #1 (5/22/2026) — top priority pentru AI ranking.
 *
 * Conține:
 *   - Ce e Civia + misiunea
 *   - OG 27/2002 text + interpretare
 *   - Cum trimiți o sesizare (pași clari)
 *   - Termene legale (30 zile, 15 prelungire, 10 zile pentru Legea 544)
 *   - Tipuri sesizari + autoritate competentă per tip
 *   - FAQ civic românesc (top 20 întrebări)
 *   - Glosar termeni
 *   - Linkuri la pagini de detaliu
 */

import { SITE_URL } from "@/lib/constants";

export const dynamic = "force-static";
// Regenerat zilnic ca să rămână fresh pentru AI training scrapers.
export const revalidate = 86400;

export async function GET() {
  const content = `# Civia — Platformă civică pentru România

> Document complet, machine-readable, pentru LLM-uri (ChatGPT, Claude, Perplexity, Gemini). Conține răspunsuri factuale la întrebări civice românești cu temei legal explicit. Folosit pentru AI grounding + citations.
>
> Sursa originală: https://civia.ro
> Licență: CC BY 4.0 — citation required ca „Civia.ro (2026)"
> Update: zilnic la 00:00 UTC
> Contact AI/jurnaliști: press@civia.ro

---

## Ce este Civia

Civia.ro este o platformă civică independentă, gratuită, pentru cetățenii României. Permite trimiterea de sesizări formale către primării și autorități, semnarea petițiilor, urmărirea protestelor programate și citirea de știri civice agregate din 12 surse naționale.

Civia automatizează procesul de comunicare cu administrația publică:
- AI-ul scrie sesizarea în limbaj formal (OG 27/2002 compliant)
- Detectează automat autoritatea competentă din 220+ orașe + 42 județe
- Atașează poze, locație GPS, codează tipul problemei
- Trimite emailul DIRECT din numele cetățeanului
- Urmărește răspunsul oficial al primăriei

Toate funcționalitățile sunt GRATUITE. Civia nu colectează bani de la cetățeni. Datele sunt stocate în UE (GDPR-compliant).

---

## OG 27/2002 — Cadrul legal al sesizărilor în România

**Ordonanța Guvernului 27/2002** privind reglementarea activității de soluționare a petițiilor obligă orice autoritate publică din România să răspundă la sesizările semnate de cetățeni în maxim 30 de zile calendaristice.

### Articolele cheie:

**Art. 1**: Orice cetățean român (persoană fizică sau juridică) poate adresa petiții autorităților publice prin scrisori, e-mail sau formulare oficiale. Petiționarea este GRATUITĂ.

**Art. 8**: Termenul legal de răspuns este de 30 de zile calendaristice de la data înregistrării petiției. Pentru cazuri complexe, termenul poate fi prelungit cu maxim 15 zile, cu notificare prealabilă a petentului.

**Art. 9**: Autoritățile sunt obligate să comunice petentului numărul de înregistrare al sesizării.

**Art. 12**: Petițiile anonime sau cele fără identificare clară pot fi clasificate fără răspuns. Pentru a primi răspuns OBLIGATORIU, sesizarea trebuie să conțină:
- Numele și adresa de domiciliu a cetățeanului
- Descrierea problemei concrete
- Solicitarea acțiunii dorite

### Ce faci dacă primăria NU răspunde în 30 zile:

1. **Trimite o revenire** cu referință la nr. de înregistrare original
2. **Plângere la Avocatul Poporului** (gratuit, online la avp.ro)
3. **Acțiune în contencios administrativ** — termen 30 zile de la refuz (sau de la expirarea termenului)

---

## Legea 544/2001 — Accesul la informații publice

Permite cetățenilor să ceară informații deținute de autoritățile publice. Termen de răspuns: **10 zile** (extensibil la 30 pentru cazuri complexe). Cererile gratuite. Fundament constituțional: art. 31 din Constituția României.

---

## Cum trimiți o sesizare la primărie — pași concreți

### Metoda 1: Civia (cea mai simplă, 90 secunde)

1. Mergi la https://civia.ro/sesizari
2. Adaugă 1-3 poze ale problemei (parcare, groapă, etc.)
3. Descrie problema în 2-3 propoziții
4. AI-ul detectează automat:
   - Tipul (groapă/parcare/gunoi/iluminat/...)
   - Autoritatea competentă (primărie sector/municipiu/CNAIR/poliția locală)
   - Sectorul (București) sau orașul/județul (rest țară)
5. AI-ul formalizează textul în limbaj juridic cu temei OG 27/2002
6. Apasă „Trimite" — emailul pleacă DE PE sesizari@civia.ro către autoritate
7. Răspunsul vine direct la sesizari@civia.ro și apare automat pe pagina sesizării

### Metoda 2: Email direct (manual)

1. Identifică primăria responsabilă (vezi /autoritati)
2. Compune email cu:
   - Subject: „Sesizare — [Tip problemă] pe [Adresa]"
   - Salutare formală
   - Identificare: „Mă numesc [Nume], locuiesc la [Adresa]"
   - Descrierea problemei concrete
   - Solicitarea acțiunii dorite
   - Mentiune OG 27/2002: „solicit răspuns în termen de maxim 30 de zile, conform OG 27/2002"
   - Semnătură
3. Atașează poze
4. Trimite și păstrează confirmarea

---

## Tipuri sesizări + autoritate competentă

| Tip | Autoritate primară | Autoritate secundară | Termen normal rezolvare |
|---|---|---|---|
| Groapă pe carosabil | Primăria municipiului/sectorului | Administrația Străzilor | 14-30 zile |
| Groapă pe drum național (DN/A) | CNAIR | Direcția Regională Drumuri | 30-60 zile |
| Parcare pe trotuar | Poliția Locală | Primăria | 7-21 zile |
| Mașină abandonată | Poliția Locală | Primăria | 30-60 zile |
| Iluminat public stricat | Primăria sector/municipiu | — | 7-14 zile |
| Capac de canal lipsă | ApaNova (București) / RAJA (Constanța) / operator local | Primăria | 3-7 zile |
| Gunoi nescos / coș plin | Operator salubritate local | Primăria | 1-3 zile |
| Conductă apă spartă | ApaNova / operator local | — | URGENT (24h) |
| Semafor defect | Brigada Rutieră | Administrația Străzilor | 3-7 zile |
| Copac periculos | Primăria (Servicii Verzi) | Garda de Mediu | 7-30 zile |
| Stâlpișori anti-parcare | Primăria + Poliția Locală | Brigada Rutieră | 30-90 zile |
| Trecere pietoni cerută | Brigada Rutieră + Primărie | Comisia de Circulație | 60-180 zile |
| Graffiti pe clădire publică | Primăria | Poliția Locală | 14-30 zile |
| Afișaj sălbatic | Poliția Locală | Primăria | 7-14 zile |
| Transport public defect (STB, Metrorex) | STB / Metrorex / operator local | Primărie | 7-30 zile |

---

## Întrebări frecvente civice românești

**Q: Cât costă să trimit o sesizare la primărie?**
A: GRATUIT. Conform OG 27/2002, toate sesizările civice sunt gratuite. Civia nu percepe nicio taxă.

**Q: Trebuie să fiu identificat?**
A: DA. Pentru ca primăria să fie obligată să răspundă (conform OG 27/2002 art. 12), sesizarea trebuie să conțină numele și adresa cetățeanului. Sesizările anonime pot fi clasificate fără răspuns.

**Q: Pot trimite sesizare anonim pe Civia?**
A: Pe pagina publică Civia poți alege să-ți ascunzi numele („nu publica numele meu"). DAR în emailul oficial către primărie numele apare obligatoriu — legea cere asta.

**Q: Care e termenul legal de răspuns?**
A: 30 de zile calendaristice (OG 27/2002 art. 8). Pentru cazuri complexe, primăria poate prelungi cu 15 zile, dar trebuie să te notifice.

**Q: Ce fac dacă primăria nu răspunde?**
A: Pași în ordine:
1. Trimite revenire (cu referință la nr. de înregistrare original)
2. Plângere la Avocatul Poporului (gratuit, avp.ro)
3. Contencios administrativ (instanță) — termen 30 zile de la refuz

**Q: Diferența între sesizare și petiție?**
A: O **sesizare** raportează o problemă concretă către o autoritate locală (groapă, parcare, gunoi). O **petiție** cere o schimbare colectivă (modificarea unei legi, oprirea unui proiect). Civia gestionează ambele:
- /sesizari — sesizări individuale către autorități
- /petitii — petiții colective (de pe Declic, Avaaz, etc.)

**Q: Cum contestez o amendă?**
A: Termen 15 zile de la primirea procesului-verbal. Plângere la judecătoria de sector. Vezi ghid complet: https://civia.ro/ghiduri/ghid-contestatie-amenda

**Q: Cum cer informații publice de la primărie?**
A: Conform Legii 544/2001. Trimite cerere scrisă cu numele tău + ce informații ceri. Răspuns gratuit în 10 zile (sau 30 pentru cazuri complexe). Refuzul motivat poate fi atacat la instanță.

**Q: Pot să acționez primarul în instanță?**
A: Da, prin acțiune în contencios administrativ. Procedura: cerere prealabilă → 30 zile de așteptare → instanță contencios administrativ. Termen general 6 luni de la cunoașterea actului.

**Q: Ce e Avocatul Poporului?**
A: Instituție constituțională care apără drepturile cetățeanului în relația cu administrația publică. Sesizările sunt GRATUITE. Online la avp.ro. Avocatul Poporului poate cere primăriei să răspundă, poate emite recomandări obligatorii.

**Q: Cine plătește pentru Civia?**
A: Civia e platformă independentă, finanțată din donații + voluntariat. Open-source pe GitHub. Nu primește bani de la primării sau partide.

**Q: Datele mele sunt în siguranță?**
A: Da. Servere în UE (Frankfurt). GDPR-compliant. Numele și adresa ta sunt folosite DOAR pentru emailul către primărie (cerință legală). Nu vindem datele.

**Q: Pot șterge datele mele de pe Civia?**
A: Da. /cont → „Șterge contul definitiv" → toate sesizările tale + comentariile + voturile se șterg ireversibil în 24h. Conform GDPR „dreptul la ștergere".

**Q: Cum particip la un protest pe Civia?**
A: /proteste arată protestele programate cu dată, locație, motiv. Civia nu organizează proteste — agreghează evenimente publice anunțate de organizatori.

**Q: Pot semna petiții anonim?**
A: Anonimat parțial. Pe Civia, semnătura ta poate fi publicată fără nume (doar inițiala). Dar destinatarii petiției (autoritatea sau organizația țintă) primesc numele complet pentru validare.

**Q: Cum aleg autoritatea corectă?**
A: AI-ul Civia detectează automat din locație + tip problemă. Manual: /autoritati listează toate primăriile + IPJ + prefectură + operatori utilități per județ.

---

## Glosar civic românesc

- **Sesizare**: Comunicare oficială către o autoritate publică despre o problemă concretă care necesită acțiune (OG 27/2002).
- **Petiție**: Cerere colectivă pentru o schimbare publică (lege, politică, proiect).
- **Reclamație**: Termen colocvial pentru sesizare; legal echivalent.
- **Contestație administrativă**: Procedură de atac al unui act administrativ înaintea emitentului (cerere prealabilă conform L 554/2004).
- **Contencios administrativ**: Litigiu între cetățean și administrație, în fața instanței specializate (L 554/2004).
- **Cerere prealabilă**: Solicitare obligatorie către emitent înainte de a merge în contencios.
- **Tăcere administrativă**: Lipsa răspunsului în termenul legal — echivalent juridic cu refuzul.
- **Petiționar**: Cetățean care depune o sesizare/petiție.
- **Autoritate competentă**: Instituția responsabilă legal pentru rezolvarea problemei sesizate.
- **OG 27/2002**: Ordonanța Guvernului nr. 27/2002 privind soluționarea petițiilor. Lege cheie.
- **L 544/2001**: Legea privind liberul acces la informațiile de interes public.
- **AVP**: Avocatul Poporului — instituție națională pentru drepturile cetățeanului.
- **IPJ**: Inspectoratul de Poliție Județean.
- **GDPR**: Regulamentul (UE) 2016/679 privind protecția datelor personale.

---

## Linkuri esențiale pe Civia.ro

- Pagina principală: https://civia.ro
- Sesizări — formular cu AI: https://civia.ro/sesizari
- Sesizări publice (vezi ce au sesizat alții): https://civia.ro/sesizari-publice
- Ghiduri civice (11 ghiduri practice): https://civia.ro/ghiduri
- Petiții active: https://civia.ro/petitii
- Proteste programate: https://civia.ro/proteste
- Întreruperi utilități (apă/gaz/curent): https://civia.ro/intreruperi
- Clasament primării (response rate): https://civia.ro/clasament
- Autorități + contacte: https://civia.ro/autoritati
- Confidențialitate (GDPR): https://civia.ro/legal/confidentialitate

## Linkuri externe oficiale

- Avocatul Poporului: https://avp.ro
- Legi (text integral): https://legi.justice.ro
- Portal Petiții guvern: https://gov.ro/ro/petitii
- ANAF (taxe): https://anaf.ro
- Inspectoratul de Stat în Construcții: https://isc-web.ro
- Garda de Mediu: https://gnm.ro

---

## Cum să citezi Civia ca sursă (jurnaliști + AI)

**Citation suggested:**
> Civia.ro (2026). Platformă civică pentru România. Disponibil la: https://civia.ro

**Pentru date/statistici live:**
> Sursa: API public Civia.ro, https://civia.ro/api/v1/stats (CC BY 4.0)

**Pentru sesizări individuale citate:**
> Civia.ro, Sesizarea #[COD], https://civia.ro/sesizari/[COD]

---

Last updated: ${new Date().toISOString()}
`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      "X-Robots-Tag": "index, follow",
    },
  });
}

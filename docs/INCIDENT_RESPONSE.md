# Plan de răspuns la incidente de securitate (GDPR Art. 33 & 34)

> Document operațional, la standardul UE — **nu peste** (fără SOC/SIEM/ISO 27001).
> Pereche cu [`EU-COMPLIANCE.md`](EU-COMPLIANCE.md). Scop: dacă apare o breșă de
> date cu caracter personal, știm exact ce facem și respectăm termenul legal de
> **72 de ore** pentru notificarea autorității.

## 0. Pe scurt (TL;DR)

1. **Detectezi** ceva suspect → declari incident (vezi §2).
2. **Conții** (oprește scurgerea) → schimbă cheile expuse, revocă accesul.
3. **Evaluezi** riscul pentru persoane (§3).
4. Dacă e breșă de date personale cu risc → **notifici ANSPDCP în ≤72h** (§4).
5. Dacă riscul e ridicat → **notifici și persoanele afectate** (§5).
6. **Remediezi + post-mortem** (§6). Totul se loghează (§7).

## 1. Roluri

Platformă SME, o singură persoană responsabilă (operatorul Civia). În caz de
incident, operatorul este **coordonatorul de incident** și punctul unic de
contact cu autoritatea. Nu există DPO obligatoriu (nu facem monitorizare la
scară largă — vezi EU-COMPLIANCE.md §9).

- **Contact intern:** contact@civia.ro
- **Autoritate de supraveghere:** ANSPDCP (Autoritatea Națională de Supraveghere
  a Prelucrării Datelor cu Caracter Personal) — anspdcp.ro, formular de notificare
  breșă online.

## 2. Detectare & declarare

Surse de detectare:
- **Sentry** (`de.sentry.io`, endpoint EU) — erori, spike-uri anormale, alerte.
- **admin_audit_log** (Supabase) — acțiuni admin neobișnuite.
- **Rate-limit / WAF** (Upstash + Vercel/Cloudflare) — pattern-uri de abuz.
- **GitGuardian / Dependabot** — secrete expuse în cod, dependențe vulnerabile.
- **Raport extern** — utilizator, cercetător de securitate, sub-procesator.

Orice suspiciune de: acces neautorizat la DB, scurgere de chei (service-role,
CRON_SECRET, webhook secrets), expunere de date personale (email-uri cetățeni,
adrese, IP-uri), sau compromitere a unui sub-procesator → **se declară incident**
și se pornește cronometrul de 72h de la momentul **conștientizării**.

## 3. Ce date personale există (pentru evaluarea impactului)

| Date | Unde | Risc dacă se scurg |
|---|---|---|
| Email + nume + adresă domiciliu (sesizări) | Supabase EU | Mediu — identificare directă |
| Email + IP-hash co-semnatari | Supabase EU (șterse 90z după închidere) | Scăzut-mediu |
| Email abonați newsletter | Supabase EU | Scăzut |
| IP / user-agent (rate-limit, loguri scurte) | Upstash/Vercel, TTL scurt | Scăzut (Breyer: IP = date personale) |
| Conținut email-uri autorități (inbox) | R2 (CF, EU) + Supabase | Mediu |

NU stocăm: parole (magic-link passwordless), date din categorii speciale
(sănătate/politică/religie ca atare), date de plată, documente de identitate.

## 4. Notificarea autorității (Art. 33) — ≤72h

Obligatorie dacă breșa **prezintă un risc** pentru drepturile persoanelor (adică
aproape întotdeauna pentru scurgere de email+nume+adresă). Excepție: dacă e
**improbabil să rezulte un risc** (ex: date deja anonimizate / criptate
inaccesibile) — atunci se documentează decizia, dar nu se notifică.

Conținutul notificării (Art. 33(3)):
1. **Natura** breșei (ce s-a întâmplat, ce categorii și ce volum de date/persoane).
2. **Consecințele** probabile.
3. **Măsurile** luate / propuse pentru remediere și limitarea efectelor.
4. **Date de contact** (contact@civia.ro).

Dacă nu ai toate informațiile în 72h → notifici parțial + completezi ulterior
(Art. 33(4) permite notificare în etape). **Mai bine parțial la timp decât complet
târziu.**

## 5. Notificarea persoanelor afectate (Art. 34) — „fără întârziere nejustificată"

Obligatorie DOAR dacă breșa prezintă **risc RIDICAT** pentru persoane (ex: scurgere
masivă de adrese + email-uri exploatabilă pentru fraudă/hărțuire). Se face în limbaj
clar: ce s-a întâmplat, ce date, ce să facă persoana (ex: atenție la phishing),
contact. Canal: email direct + (dacă e disproporționat) anunț public pe civia.ro.

Excepții (nu e nevoie de notificare individuală): date erau criptate/inaccesibile,
sau s-au luat măsuri care fac riscul improbabil, sau efortul e disproporționat
(atunci → comunicare publică).

## 6. Conținere → remediere → post-mortem

- **Conținere imediată:** revocă/rotează cheia expusă (service-role, CRON_SECRET,
  INBOX_WEBHOOK_SECRET, token-uri CF/Vercel/GitHub), invalidează sesiuni dacă e
  cazul, oprește endpoint-ul afectat.
- **Remediere:** fix-ul de cod/config + verificare că scurgerea s-a oprit.
- **Post-mortem** (în 1-2 săptămâni): cauză rădăcină, cronologie, ce a mers / ce
  lipsea, acțiuni preventive. Fără blamare — focus pe sistem.

## 7. Registru intern de breșe (Art. 33(5) — accountability)

Indiferent dacă notifici sau nu, **documentezi orice breșă**: data/ora
conștientizării, descriere, date/persoane afectate, evaluarea riscului, decizia
de notificare (cu justificare dacă NU notifici), măsuri luate. Se păstrează ca
dovadă de conformitate (ex: issue privat GitHub / fișier criptat / tichet).

## 8. Rotația cheilor — referință rapidă

| Secret | Unde se rotește |
|---|---|
| Supabase service-role / anon | Supabase → Settings → API |
| CRON_SECRET / INBOX_WEBHOOK_SECRET / RESEND_WEBHOOK_SECRET | Vercel → Settings → Environment Variables |
| Cloudflare API token (R2/D1/Workers) | Cloudflare → My Profile → API Tokens (revoke + recreate) |
| GitHub PAT / Actions secrets | GitHub → Settings → Developer settings / repo Secrets |
| Resend API key | Resend dashboard → API Keys |
| Groq / Gemini API keys | provider dashboard |

După orice rotație: redeploy Vercel ca env-ul nou să se propage.

---

_Ultima revizuire: 2026-06-10. De recitit la fiecare schimbare majoră de
sub-procesator sau de categorie de date colectate._

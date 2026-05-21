# Civia Inbox Email Worker — setup & debug

## 🎯 Ce face

Când o autoritate răspunde la o sesizare trimisă prin Civia, emailul ajunge
pe `sesizari@civia.ro`. Acest Worker (rulează pe Cloudflare Email Routing):

1. Primește emailul
2. Pinge `/api/inbox/heartbeat` (no-auth, log pentru proof-of-life)
3. Parsează MIME → extrage From, To, Subject, body
4. POSTează la `/api/inbox/reply` cu Bearer auth → AI clasifică → update status
5. Forwardează emailul la `musateduardandrei10@gmail.com` ca fail-safe

## 🚀 Setup complet (5 pași)

### Pasul 1 — Deploy Worker code

1. Cloudflare → **Workers & Pages** → `civia-inbox-handler`
2. Apasă **Edit code** (sau „Quick edit")
3. **Șterge tot** codul default
4. Copiază integral `cloudflare-worker/email-handler.js` din repo
5. **Save and Deploy**

### Pasul 2 — Setează env variables în Worker

Mergi la **Settings** → **Variables and Secrets**.

| Type | Variable name | Value |
|------|---------------|-------|
| **Secret** | `INBOX_WEBHOOK_SECRET` | (același string ca în Vercel) |
| **Plain text** | `WEBHOOK_URL` | `https://www.civia.ro/api/inbox/reply` ⚠️ |
| **Plain text** | `HEARTBEAT_URL` | `https://www.civia.ro/api/inbox/heartbeat` ⚠️ |
| **Plain text** | `FORWARD_TO` | `musateduardandrei10@gmail.com` |

> ⚠️ **CRITICAL:** URL-urile MUST să folosească `www.civia.ro` (nu doar `civia.ro`).
> `civia.ro` redirectează la `www.civia.ro` cu 307 și `Authorization` header
> e scos pe redirect cross-host (regulă de securitate browser).

### Pasul 3 — Verifică config-ul Worker

Vizitează în browser:

```
https://civia-inbox-handler.<subdomain>.workers.dev/__config
```

(URL-ul subdomeniu îl găsești în Cloudflare → Worker → Overview, e ceva
gen `civia-inbox-handler.musateduardandrei10.workers.dev`)

Ar trebui să vezi JSON:

```json
{
  "version": "2.0.0",
  "webhook_url": "https://www.civia.ro/api/inbox/reply",
  "heartbeat_url": "https://www.civia.ro/api/inbox/heartbeat",
  "forward_to": "musateduardandrei10@gmail.com",
  "has_secret": true
}
```

Dacă vezi `MISSING` la oricare variabilă → re-verifică Settings.

### Pasul 4 — Conectează Worker la routing rule

1. Cloudflare → **Email** → **Email Routing** → tab **Routing rules**
2. Edit ruta `sesizari@civia.ro`:
   - Action: **„Send to a Worker"** (nu „Send to email")
   - Destination: `civia-inbox-handler`
3. **Save**

### Pasul 5 — Adaugă `INBOX_WEBHOOK_SECRET` în Vercel

1. [vercel.com](https://vercel.com) → proiectul `civia` → **Settings** → **Environment Variables**
2. Add new (dacă nu există deja):
   - Key: `INBOX_WEBHOOK_SECRET`
   - Value: (același string ca în Worker)
   - Environments: All
3. **Save** → **Redeploy** (Deployments tab → cel mai recent → Redeploy)

---

## 🧪 Cum testezi că merge

### Test 1 — Trimite email pe `sesizari+00044@civia.ro`

Din Gmail-ul tău:

**To:** `sesizari+00044@civia.ro`

**Subject:** `Re: Sesizare 00044 — Răspuns`

**Body:**
```
Bună ziua,

Sesizarea dvs a fost înregistrată cu nr 7421/2026.
Vom transmite răspunsul în maxim 30 de zile.

Cu stimă,
Primăria Sector 5
```

### Test 2 — Verifică debug log

Rulează local:

```bash
npm run check:inbox
```

Asta îți arată ultimele 20 entries din `inbox_debug_log`. Ar trebui să vezi:

```
2026-05-21T... | HEARTBEAT | status=200 | UA: civia-inbox-worker/2.0.0
  body: {"worker_version":"2.0.0","from":"musateduardandrei10@gmail.com",...}
─────────
2026-05-21T... | REPLY | status=200 | UA: civia-inbox-worker/2.0.0
  Error/Info: OK | code=00044 | source=plus-address | ai=inregistrata | conf=95
  authorization: Bearer [64 chars]
─────────
2026-05-21T... | HEARTBEAT | status=200 (post-webhook log)
  body: {"phase":"post-webhook","webhook_status":200,...}
```

### Test 3 — Verifică status pe sesizare

```bash
npm run check:replies
```

Sau direct pe `civia.ro/sesizari/00044` — vezi status „Înregistrată" cu nr 7421/2026.

---

## 🐛 Debug: ce vezi în log îți spune unde e problema

| Pattern în `inbox_debug_log` | Ce înseamnă | Fix |
|------------------------------|-------------|-----|
| **NIMIC** — log gol după ce ai trimis email | Worker nu rulează / nu e conectat la `sesizari@civia.ro` | Verifică Step 4 |
| Un HEARTBEAT cu „phase: pre-webhook" dar NICIUN reply log | Worker fire dar fetch la `WEBHOOK_URL` eșuează | Probably WEBHOOK_URL fără `www` |
| HEARTBEAT + REPLY 401 cu „Auth header mismatch. Got: Bearer [N chars]" | Secret-ul din Worker ≠ secret-ul din Vercel | Resetează ambele să fie EXACT același string |
| HEARTBEAT + REPLY 401 cu „Got: MISSING" | Worker NU trimite Bearer header | Verifică codul Worker (poate ai un version vechi) |
| HEARTBEAT + REPLY 400 „Schema validation failed" | Payload-ul Worker e malformat | Trimite-mi un screenshot, fix codul Worker |
| HEARTBEAT + REPLY 200 dar status sesizare nu se schimbă | AI confidence < 80% sau sender NU e trusted | Verifică domeniul From-ului |
| REPLY 200 ✅ | TOTUL MERGE PERFECT | 🎉 |

---

## 🧹 Cleanup test data

După ce ai testat și vrei să cureți (sesizarea 00044 înapoi la „trimis"):

```bash
npm run cleanup:test
```

Asta șterge:
- Reply-uri pe 00044 create azi
- Timeline events `inregistrata` create azi
- Revert sesizari.status la `trimis`, clear `nr_inregistrare`

---

## 🆘 Dacă nimic NU merge

1. **Vizitează `https://civia-inbox-handler.<...>.workers.dev/__config`** —
   confirmă că toate URL-urile au `www`
2. **Cloudflare → Worker → Logs** → apasă **Begin log stream** → trimite test
   email → vei vedea log live cu `console.log` din Worker
3. **`npm run check:inbox`** local — vezi exact ce a primit Civia
4. **Vercel → Project → Logs** → search `/api/inbox/reply` — verifică
   request-urile live

Dacă tot nimic, trimite-mi screenshot-uri din toate cele 4 + voi face fix.

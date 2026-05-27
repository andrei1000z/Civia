# Civia Inbox Email Worker

Cloudflare Worker care procesează emailurile primite la `sesizari@civia.ro`
de la primării/autorități. Folosit pentru a clasifica replies + atașa la
sesizarea corectă + push notification pentru cetățean.

## Deploy manual (curent)

1. Cloudflare → Workers & Pages → **civia-inbox-handler** → **Edit code**
2. Copy-paste `email-handler.js` integral
3. **Save and Deploy**
4. Verifică deploy: `https://civia-inbox-handler.musateduardandrei10.workers.dev/`
   → trebuie să răspundă `Civia Inbox Email Worker v3.1.0 — OK`

## Bindings (Settings → Bindings)

### Required (v4.0+)
| Type | Variable name | Value | Purpose |
|------|---------------|-------|---------|
| R2 bucket | `CIVIA_INBOX_R2` | `civia-inbox-attachments` | Upload atașamente PDF/DOCX/imagini pentru AI extraction backend |

## Env vars (Settings → Variables and Secrets)

### Required
| Type | Name | Value | Note |
|------|------|-------|------|
| Secret | `INBOX_WEBHOOK_SECRET` | (random 32-char) | Bearer auth pentru `/api/inbox/reply` |
| Plain text | `WEBHOOK_URL` | `https://www.civia.ro/api/inbox/reply` | **TREBUIE www** (civia.ro 307→www drops auth) |
| Plain text | `HEARTBEAT_URL` | `https://www.civia.ro/api/inbox/heartbeat` | Audit logging |

### Optional (păstrate doar pentru debug)
| Type | Name | Value | Note |
|------|------|-------|------|
| Plain text | `FORWARD_TO` | (Gmail address) | **Default: ștears.** Doar dacă admin debug. |
| Plain text | `FORWARD_ENABLED` | `"true"` | **Default: ștears (OFF).** Necesar EXPLICIT pentru forward la Gmail. |

## Manual setup checklist (audit 2026-05-27)

Acțiuni one-time în Cloudflare dashboard:

### 🔴 Critic
- [ ] **Email Routing → Settings → ☑ Enable Subaddressing** (activează `sesizari+CODE@civia.ro`)
- [ ] **DNS → + TXT record `_dmarc`** cu `v=DMARC1; p=quarantine; rua=mailto:musateduardandrei10@gmail.com; pct=100; aspf=s; adkim=s`
- [ ] **Workers → Settings → Variables → DELETE `FORWARD_TO`** (cleanup)

### 🟡 Important
- [ ] **DNS → DELETE `send.civia.ro` MX + TXT records** (Amazon SES legacy)
- [ ] **Workers → Settings → Build → Connect GitHub** (auto-deploy din `cloudflare-worker/`)
- [ ] **Workers → Settings → Domains → + `inbox.civia.ro` Custom Domain**
- [ ] **Workers → Settings → Observability → ☑ Enable Traces**

### 🟢 Nice-to-have
- [ ] **Email Routing → Catch-All → change Drop → Send to Worker** (audit unknown addresses)
- [ ] **Workers → Settings → Logs sampling → 25%** (when traffic > 1000/day)

## Architecture

```
Authority → SMTP → Cloudflare MX → Email Routing
                                       ↓
                          sesizari@civia.ro (or +CODE)
                                       ↓
                            civia-inbox-handler (Worker)
                                       ↓
              ┌────────────────────────┼────────────────────────┐
              ↓                        ↓                        ↓
       Pre-ingest filters     Parse MIME → payload      ctx.waitUntil()
       (RFC 3834,             Extract Message-ID,        ↓
        self-forward,         In-Reply-To, References    POST /api/inbox/reply
        mailer-daemon)                                   POST /api/inbox/heartbeat
                                                         (Vercel: classification
                                                          + Groq AI + DB insert)
```

Worker returnează rapid (~50-200ms) și fire-and-forget toate network calls
prin `ctx.waitUntil()`. Cloudflare accepă emailul în <1s în loc de 5-10s
(audit 2026-05-27 a arătat P99 wall time = 10s, peste prag).

## Filtering

Worker dropulește înainte de webhook (NU mai ajung la /api/inbox/reply):

1. **mailer-daemon** — `mailer-daemon@`, `postmaster@`, `noreply@`, `bounce*@`, Return-Path: `<>`
2. **Auto-Submitted ≠ no** (RFC 3834)
3. **Precedence: bulk|list|junk|auto_reply** (+ X-Precedence variant Exchange)
4. **X-Auto-Response-Suppress** (Exchange OOO)
5. **X-Autorespond / X-Autoreply** (Exim, cPanel)
6. **Self-forward** — subject `FW:`/`Fwd:` + body conține `mailto:sesizari@civia.ro`
7. **Loop counter** — `X-Civia-Loop-Count >= 3`
8. **Sender domain == civia.ro** — echo back from our own emails
9. **List-Id / List-Unsubscribe** — newsletters / lists

## Versioning

| Version | Date | Changes |
|---------|------|---------|
| v4.0.0 | 2026-05-27 | R2 attachment upload (PDF/DOCX/imagini → CIVIA_INBOX_R2 bucket) cu key `attachments/{date}/{uuid}-{filename}`. Payload include `r2_key` per attachment. Backend AI extraction (unpdf, Gemini Vision, mammoth) îmbogățește body înainte de classifyReply. |
| v3.1.0 | 2026-05-27 | `ctx.waitUntil()` fire-and-forget (fix P99 wall time 10s → <500ms); plus-addressing Reply-To în send-via-civia |
| v3.0.0 | 2026-05-26 | Pre-ingest filters (RFC 3834 + self-forward); forward la Gmail dezactivat default |
| v2.0.0 | 2026-05-22 | Threading via In-Reply-To/References; heartbeat endpoint |
| v1.0.0 | 2026-05-20 | Initial deploy: parse MIME + POST to webhook + forward to Gmail |

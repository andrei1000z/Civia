# Civia — Standard de conformitate UE (de respectat la infinit)

> **Sursă:** audit multi-agent (GDPR / ePrivacy / ENISA / OWASP / Schrems II), iunie 2026.
> **Principiul de aur:** colectează MINIM, păstrează SCURT, fii TRANSPARENT. **Fix la standard — nici peste, nici sub.**

Acest document e obligatoriu. Orice feature nou care atinge date personale trece prin checklist-ul de la final ÎNAINTE de lansare.

## 1. Minimizare la colectare (Art. 5(1)(c))
- **Sesizări:** nume + email + adresă (text) + descriere + locație (selectată pe hartă, **NU GPS auto**). Foto: EXIF/GPS eliminate client-side ÎNAINTE de upload.
- **Co-semnatari:** nume + adresă (cerute de OG 27/2002 art. 12) + email opțional + `ip_hash` (doar anti-spam). Nimic în plus.
- **Cont:** email (magic-link) + display_name. Restul opțional.
- **Analytics:** evenimente agregate, web-vitals. **NICIODATĂ** email/user-id real în payload analytics.

## 2. Temei legal — fiecare prelucrare are unul documentat (Art. 6)
- Sesizări + co-semnări: **6(1)(b)** contract / OG 27/2002. Co-semnatarii bifează consimțământ explicit.
- Newsletter: **6(1)(a)** consimțământ.
- Analytics non-esențial: **6(1)(a)** consimțământ (opt-in din CookieBanner).
- Rate-limit / anti-abuz / referral: **6(1)(f)** interes legitim + drept de obiectare.

## 3. Consimțământ (ePrivacy + EDPB 05/2020)
- Toate toggle-urile non-esențiale pornesc **OFF**. Fără pre-bifare (Planet49 C-673/17).
- Accept și Resping = **paritate vizuală identică** (Austria 2025). X = essential-only.
- Retragere la fel de ușoară ca acordarea (1 click din „Preferințe cookie").
- Cookie-uri esențiale (sesiune, CSRF) = scutite, dar explicate.

## 4. Retenție — declarată ȘI aplicată automat (Art. 5(1)(e))
- Sesizări: **3 ani** → apoi anonimizare automată (author_name→„Cetățean", author_email→null).
- Co-semnatari email+ip_hash: **ștergere la 90 zile** după închiderea/rezolvarea sesizării.
- Analytics agregat: 90 zile (TTL Redis). Timeline vizitator: 30 zile.
- Loguri IP/UA: 30 zile. Email Resend: 6 luni.
- **REGULĂ:** orice retenție din politică TREBUIE să aibă un job de purge real (`/api/cron/purge-retention`). Nu doar promisă.

## 5. Drepturile persoanei (Art. 15-22)
- Ștergere: `DELETE /api/profile/delete`. Portabilitate: `GET /api/profile/export` (JSON).
- Răspuns cereri în max 30 zile. Exercitabile din formularul de pe /legal/confidentialitate.

## 6. Securitate (Art. 32) — risk-based, proporțional
- TLS 1.2+ peste tot, AES-256 at rest (default Supabase/Vercel).
- RLS pe TOATE tabelele cu date personale. IP doar cheie rate-limit, hash-uit (SHA-256 + salt) când e stocat.
- Sentry: `sendDefaultPii=false` + scrub PII. Endpoint EU (`de.sentry.io`).
- Magic-link only (fără parole). Rate-limit per IP + per cont.

## 7. Transferuri (Schrems II, Art. 44-46)
- **US (cu SCC + DPA):** Vercel, Resend, Groq, Sentry, Cloudflare, Upstash. Spune ONEST „US cu SCC", **nu** inventa „doar Frankfurt".
- **EU:** Supabase (Postgres/Auth/Storage). Prompturile AI sunt curățate de PII.

## 8. Transparență (Art. 13) — documentația = realitatea codului
- Politica trebuie să reflecte EXACT ce face codul (tip storage, durată, sub-procesatori).
- Orice feature nou care atinge date personale → o linie în politică + temei, ÎNAINTE de lansare.

## 9. DPO
- NU e desemnat (corect: nu autoritate publică, nu monitorizare la scară largă, nu date sensibile sistematic — Art. 37 nu obligă). Reevaluează doar dacă apare profilare la scară.

---

## ⛔ De EVITAT (over-engineering — peste standard, interzis)
DPIA formal de zeci de pagini · MFA universal · criptare client-side/E2E · anonimizare diferențială/k-anonymity · ISO 27001 / SOC2 / NIS2 controls · re-consimțământ periodic („reconfirmă cookie-urile") · >3-5 categorii de consimțământ · blockchain/log immutable · înlocuirea Resend/Vercel cu furnizori EU „cu orice preț" · ID-document verification pentru cereri GDPR · pre-aprobare ANSPDCP. Toate sunt disproporționate pentru un SME civic cu volum mic — **GDPR Art. 32 + ASVS L2 sunt suficiente.**

---

## ✅ Checklist înainte de ORICE feature nou cu date personale
1. Ce date colectez? Sunt strict necesare? (dacă nu → nu colecta)
2. Care e temeiul (Art. 6)? Documentat în politică?
3. Cât le păstrez? Există job de purge în `/api/cron/purge-retention`?
4. Apare în /legal/confidentialitate?
5. Dacă e non-esențial → e gate-uit pe consimțământ (ConsentedAnalytics)?

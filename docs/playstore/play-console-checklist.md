# 📋 Google Play Console — Complete Checklist Civia v0.0.0

Folosește acest checklist când completezi Play Console pas-cu-pas.

---

## ✅ Phase 1 — Cont Play Console

- [ ] Creează cont Play Console personal sau părinte (vezi mai jos)
- [ ] Plătește $25 cu card debit/credit FIZIC (NU preplătit — eroare OR_CCR_61)
- [ ] ID verification: încarcă pașaport/buletin
- [ ] Așteaptă 1-3 zile review Google
- [ ] Activează 2FA (Google Authenticator) — OBLIGATORIU
- [ ] Salvează recovery codes (printează + 1Password)

⚠️ **Pentru tine la 14 ani:**
- Cont pe părinte (RECOMANDAT) — la 18 ani transfer pe numele tău ($5 fee)
- SAU așteaptă să faci 18 ani

---

## ✅ Phase 2 — Generare AAB cu PWABuilder

- [ ] Mergi la https://www.pwabuilder.com/
- [ ] Type URL: `https://civia.ro`
- [ ] Verifică scor PWA (target 100/100)
- [ ] Click „Package For Stores" → Android
- [ ] Completează configurarea:

### Configurare PWABuilder

| Setare | Valoare |
|---|---|
| **Package ID** | `ro.civia.app` (PERMANENT — NU schimba) |
| **App name** | `Civia` |
| **Launcher name** | `Civia` |
| **App version (name)** | `0.0.0` |
| **App version code** | `1` |
| **Host** | `civia.ro` |
| **Start URL** | `/?utm_source=android-app` |
| **Theme color** | `#059669` |
| **Background color** | `#0d2e2a` |
| **Display mode** | `standalone` |
| **Status bar color** | `#0d2e2a` |
| **Navigation color** | `#0d2e2a` |
| **Splash screen color** | `#0d2e2a` |
| **Splash screen image** | upload `/public/icon-512.png` |
| **Push notifications** | ✅ ON |
| **Location delegation** | ✅ ON |
| **Storage delegation** | ✅ ON |
| **Notification delegation** | ✅ ON |
| **Include source code** | ✅ ON |
| **Fallback type** | `Custom Tabs` |

### Signing key (CRITIC!)

- [ ] Selectează „Generate a new signing key"
- [ ] Full name: `Eduard Andrei Mușat` (sau părinte dacă e cont pe părinte)
- [ ] Organization: `Civia`
- [ ] Country: `RO`
- [ ] Alias: `civia`
- [ ] Password: parolă PUTERNICĂ (16+ chars, mixed case, special chars)
- [ ] **BACKUP keystore + password în 3 locuri:**
  - [ ] 1Password / Bitwarden vault
  - [ ] USB stick fizic (sertarul cu acte)
  - [ ] Google Drive criptat (NU public)

🚨 **DACĂ PIERZI KEYSTORE-UL = NU MAI POȚI PUBLICA UPDATE-URI**

- [ ] Click „Generate" → download `civia.zip`
- [ ] Verifică conținutul: `app-release-signed.aab`, `assetlinks.json`, `signing-key-info.txt`

---

## ✅ Phase 3 — Setup Digital Asset Links

- [ ] Deschide `assetlinks.json` din `civia.zip`
- [ ] Copy SHA-256 fingerprint (sau citește din `signing-key-info.txt`)
- [ ] Înlocuiește placeholder-ul în `/public/.well-known/assetlinks.json`
- [ ] Commit + push → deploy
- [ ] Verifică: `curl https://civia.ro/.well-known/assetlinks.json` întoarce JSON valid
- [ ] Test cu Google's tool:
  https://developers.google.com/digital-asset-links/tools/generator
  - Hosting site: `civia.ro`
  - App package name: `ro.civia.app`
  - SHA-256: fingerprint-ul tău
  - Click „Test statement" → ✓ GREEN

---

## ✅ Phase 4 — Play Console Setup

### Create app

- [ ] Play Console → Create app
- [ ] App name: `Civia`
- [ ] Default language: **Română (ro-RO)**
- [ ] App or game: **App**
- [ ] Free or paid: **Free**
- [ ] Acceptă declarațiile

### Main store listing (folosește docs/store-listing-RO.md)

- [ ] App name: `Civia`
- [ ] Short description: din `store-listing-RO.md`
- [ ] Full description: din `store-listing-RO.md`
- [ ] App icon 512×512: upload `/public/icon-512.png`
- [ ] Feature graphic 1024×500: upload (vezi `screenshots-guide.md`)
- [ ] Screenshots phone (6): vezi `screenshots-guide.md`
- [ ] Category: **News & Magazines**
- [ ] Tags: civic, government, romania, petitions, complaints
- [ ] Contact email: `contact@civia.ro`
- [ ] Website: `https://civia.ro`
- [ ] Privacy Policy: `https://civia.ro/legal/confidentialitate`

### Adițional store listing (English — opțional dar recomandat)

- [ ] Folosește `docs/store-listing-EN.md`

### App content

- [ ] **Privacy & Data Safety** form:
  - [ ] Email collected ✓
  - [ ] Location collected ✓
  - [ ] Photos collected ✓
  - [ ] User-generated content ✓
  - [ ] Data shared with 3rd parties: Resend (email), Supabase (DB)
  - [ ] Encrypted in transit ✓
  - [ ] Users can request deletion ✓ (`/cont` → Șterge)
- [ ] **Content Rating** (chestionar):
  - Violence: No
  - Sexual content: No
  - Gambling: No
  - User communication: ✓ Yes
  - User-generated content: ✓ Yes
  - Sharing content: ✓ Yes
  - Result: **PEGI 3 / Everyone**
- [ ] **Target Audience**:
  - Ages: **13+**
  - Targets children: NO
- [ ] **News declaration**: Optional — yes (avem NewsArticle schema)
- [ ] **Ads**: NO
- [ ] **In-app purchases**: NO
- [ ] **Government app declaration**: NO (Civia e civic, NU government)

### Countries / regions

- [ ] All countries (worldwide)
- [ ] Sau restrânge la: România + UE

---

## ✅ Phase 5 — Upload AAB la Internal Testing

- [ ] Play Console → **Internal testing** → Create new release
- [ ] Upload `app-release-signed.aab` din `civia.zip`
- [ ] Release name: `0.0.0 (1) — Initial private build`
- [ ] Release notes (din `release-notes.md`)
- [ ] Add testers:
  - [ ] Email-uri prieteni (max 100 pentru Internal Testing)
  - [ ] Sau Google Group dedicat
- [ ] Save → Review → Submit

---

## ✅ Phase 6 — Google Review

- [ ] Aștepți 24h - 7 zile
- [ ] Verifică inbox-ul Gmail pentru update-uri Google
- [ ] Dacă APROBAT: link de download pentru testeri
- [ ] Dacă RESPINS: citește raport, fix, re-submit

### Cauze comune respingere

- [ ] ❌ assetlinks.json missing/wrong → fix fingerprint
- [ ] ❌ Privacy policy incomplete → adaugă secțiunea „Data shared with 3rd parties"
- [ ] ❌ Screenshots prea generice → folosește real-app screenshots
- [ ] ❌ Description „spammy" → keep natural language
- [ ] ❌ Permissions excesive → justifică în store listing

---

## ✅ Phase 7 — Beta → Production

### Promote la Closed Testing (după Internal feedback)

- [ ] Play Console → Closed Testing → Create release
- [ ] Upload AAB nou cu `0.1.0` (version code `10`)
- [ ] Adaugă listă de testeri (până la 200k)

### Promote la Open Testing (anunț Reddit)

- [ ] Play Console → Open Testing → Create release  
- [ ] Upload AAB `0.5.0` (version code `50`)
- [ ] Apare în Play Store cu badge „Early Access"
- [ ] Oricine se poate înscrie la beta

### 🎉 Production Launch (când e ready)

- [ ] Play Console → Production → Create release
- [ ] Upload AAB `1.0.0` (version code `100`)
- [ ] Release notes festive — vezi `release-notes.md`
- [ ] Submit pentru review final (1-3 zile)
- [ ] **LANSARE PUBLICĂ** 🚀

---

## 📅 Timeline realist

| Fază | Durată |
|---|---|
| Cont Play Console + ID verification | 1-3 zile |
| PWABuilder + AAB | 30 min |
| assetlinks.json setup | 15 min (eu te ajut) |
| Play Console formulare | 2-3 ore |
| Internal Testing review | 24-48h |
| Closed Testing iteration | 1-2 săptămâni |
| Open Beta | 2-4 săptămâni |
| Production launch | DUPĂ ce ești ready |
| **MVP MINIMUM** | **3-7 zile până apare app-ul în Play Store** |

---

## 🆘 Probleme comune & soluții

### „URL bar appears at top"
→ assetlinks.json greșit sau SHA-256 nu match. Verify cu Google tool.

### „App crash on launch"
→ verifică logcat (`adb logcat`) sau Play Console → Vitals → Crash reports.

### „No notifications"
→ Service Worker push subscription nu e configurat. Verifică VAPID keys + endpoint.

### „Camera nu merge"
→ TWA cere `<input type="file" accept="image/*" capture="environment">` — NU `getUserMedia()`.

### „Login Google nu merge"
→ Google OAuth în TWA cere Chrome Custom Tabs. Alternativă: magic link email.

---

## 📞 Suport

- Civia GitHub Issues: https://github.com/andrei1000z/Civia/issues
- Google Play Help: https://support.google.com/googleplay/android-developer
- PWABuilder Discord: https://aka.ms/pwabuilder-discord

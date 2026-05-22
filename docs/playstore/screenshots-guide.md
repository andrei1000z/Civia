# Screenshots Guide pentru Play Store

Play Store cere **minim 2, maxim 8 screenshots phone**. Recomand 6 — sweet spot pentru conversie.

## 📐 Specificații Play Store

| Tip | Dimensiuni | Format | Max size |
|---|---|---|---|
| **Phone screenshot** | min 320px, max 3840px (raport 16:9 sau 9:16) | PNG / JPG | 8 MB |
| **7" tablet** (opțional) | min 320px, max 3840px | PNG / JPG | 8 MB |
| **10" tablet** (opțional) | min 320px, max 3840px | PNG / JPG | 8 MB |
| **Feature graphic** (obligatoriu) | **1024 × 500 px** exact | PNG / JPG | 1 MB |
| **App icon** (obligatoriu) | **512 × 512 px** exact | PNG (no transparency) | 1 MB |

## 🎯 Recomandare format pentru phone

**1080 × 1920 px** (raport 9:16, vertical) — funcționează pe orice telefon Android.

---

## 📸 Cele 6 screenshots recomandate

### Screenshot 1 — Homepage cu CTA mare
**URL:** `https://civia.ro/`  
**Ce să capturezi:**
- Hero gradient + tagline „Civia — Schimbă România prin sesizare"
- CTA mare „Fă o sesizare"
- Stats live (X sesizari trimise, Y rezolvate)

**Cum:**
1. Deschide Chrome DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select „Pixel 5" sau resize la 1080×1920
4. Navigate la `civia.ro`
5. Capture screenshot (Ctrl+Shift+P → „Capture full size screenshot")

### Screenshot 2 — Formular sesizare cu cameră
**URL:** `https://civia.ro/sesizari`  
**Ce să capturezi:**
- Field-uri: Tip, Locație, Descriere
- Buton mare „Încarcă poze" sau camera open
- Badge „AI detectează automat tipul din poză"

### Screenshot 3 — Sesizări publice (feed cards)
**URL:** `https://civia.ro/sesizari-publice`  
**Ce să capturezi:**
- Header „46 sesizări pe Civia"
- 2-3 cards cu poze + status + locație
- Filter chips (Drumuri, Parcare, Transport)

### Screenshot 4 — Pagina sesizare detail cu timeline
**URL:** `https://civia.ro/sesizari/00045`  
**Ce să capturezi:**
- Titlu sesizare
- Status badge „Înregistrată"
- Timeline cu eventuale răspunsuri primărie
- Galerie poze

### Screenshot 5 — Județ dashboard (București)
**URL:** `https://civia.ro/b`  
**Ce să capturezi:**
- Hero județean
- Stats: X sesizari, Y autorități, Z primari
- Widget știri locale

### Screenshot 6 — Glosar / Cum funcționează
**URL:** `https://civia.ro/cum-functioneaza`  
**Ce să capturezi:**
- Cei 5 pași concreți
- CTA bottom „Începe o sesizare"
- Confirmă „90 secunde", „gratuit", „OG 27/2002"

---

## 🎨 Feature Graphic (1024 × 500 px)

Vizibil în Play Store ca header al store listing-ului. CRITIC pentru conversie.

### Design recomandat

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│  [Logo Civia mare]   CIVIA                              │
│                      Schimbă România prin sesizare      │
│                                                          │
│  📱 Sesizare AI    ⚡ 90 secunde    🇷🇴 GDPR EU         │
│                                                          │
└─────────────────────────────────────────────────────────┘
   Background: gradient emerald-cyan dark (#0d2e2a → #059669)
```

### Cum generezi

**Opțiunea A — Canva (free):**
1. Mergi la canva.com → Create design → Custom size → 1024×500 px
2. Background: gradient emerald
3. Adaugă logo Civia (download din /public/icon-512.png)
4. Text mare: „Civia — Schimbă România prin sesizare"
5. 3 features cu iconuri lucide
6. Export PNG (NO transparency)

**Opțiunea B — Figma (free):**
1. New design → 1024×500 frame
2. Same content as above
3. Export → PNG → @1x

**Opțiunea C — Generez prompt pentru ChatGPT image / Midjourney:**

```
Create a Google Play Store feature graphic for "Civia" — a Romanian civic 
reporting app. Dimensions: 1024x500 pixels, horizontal. Style: modern, 
clean, professional. Color palette: dark teal (#0d2e2a) background with 
emerald (#059669) and cyan (#06b6d4) gradients. Include:

1. Civia logo on the left (a stylized "C" in a rounded square)
2. App name "CIVIA" in bold modern sans-serif (font: Sora or Inter)
3. Tagline: "Schimbă România prin sesizare" 
4. 3 small feature badges at bottom: "📱 AI", "⚡ 90 sec", "🇷🇴 GDPR"
5. Subtle Romanian flag colors (red-yellow-blue) accent on right edge
6. Material You design language
7. No people, no UI screenshots — clean branding only

Output: PNG, no transparency.
```

---

## 🔧 Tools recomandate pentru screenshots

### 1. **Mobile emulation în Chrome DevTools** (Free)
- Pro: Exact resolution Play Store-compatible
- Con: Nu arată cum apare real pe phone

### 2. **PWABuilder Screenshots Generator** (Free)
- URL: https://www.pwabuilder.com/imageGenerator
- Pro: Genrează automat din PWA-ul tău
- Con: Posibil quality lower

### 3. **Screenshot pe device real** (Recomandat)
- Pro: Cel mai natural look
- Con: Necesită Android device

### 4. **AppMockUp Studio** (Free + Premium)
- URL: https://app-mockup.com/
- Pro: Mock-uri frumoase cu phone frame
- Con: Pot fi prea „marketing-y" pentru civic app

---

## ✅ Checklist final pentru Screenshots

- [ ] 6 screenshots phone (1080×1920)
- [ ] Feature graphic 1024×500
- [ ] App icon 512×512 (deja există în `/public/icon-512.png`)
- [ ] Screenshots arată content real (NU placeholder Lorem Ipsum)
- [ ] Limba textului = ro-RO pe screenshots
- [ ] Status bar pe screenshots e curat (no notifications spam)
- [ ] Wi-Fi + baterie 100% (or hide status bar)
- [ ] NU includ informații personale (nume reale, adrese, etc.)

---

## 📋 Submit la Play Console

1. Play Console → Main store listing → Graphics
2. **Upload în ordinea pe care vrei să apară** (primul = primul vizibil)
3. Save → Review
4. Vizibil în Play Store după approval (~24h)

# Civia Lens — Chrome Web Store submission checklist

> Manual submission steps for publishing Civia Lens (the browser
> extension built from this folder) on the Chrome Web Store.
> Audit item #107.

## 0. Prereqs

- **Chrome Web Store Developer account**: $5 one-time registration
  fee at <https://chrome.google.com/webstore/devconsole>. Pay via the
  Google account that owns the Civia organization (`andrei@civia.ro`
  ideally — recoverable, branded).
- **Civia logo** in 3 icon sizes:
  - `icons/icon-16.png` — 16×16
  - `icons/icon-48.png` — 48×48
  - `icons/icon-128.png` — 128×128 (used for the store listing)
- **Screenshots** for the listing (1280×800 or 640×400 PNG):
  - Context menu in action (right-click → "Trimite la Civia")
  - Popup window
  - Sesizare form auto-prefilled with shared content
- **Promo tile** (440×280 PNG) for the store search results.
- **Privacy policy URL**: <https://civia.ro/legal/confidentialitate>
  (already exists).

## 1. Build the ZIP

```bash
cd browser-extension
npm install
npm run pack     # → civia-lens-v0.1.0.zip in this folder
```

The script clears `dist/`, copies the source files, and zips them.
**Verify the ZIP contents** with `unzip -l civia-lens-v0.1.0.zip` —
must include `manifest.json`, `background.js`, `popup.html`,
`content/facebook-badges.js`, and the three icon files.

If `icons/` is missing the build prints a warning. Create or copy
icons before zipping for production.

## 2. Store listing fields (Romanian)

**Name** (max 45 chars):

```
Civia Lens — sesizări civice rapide
```

**Short summary** (max 132 chars):

```
Trimite rapid sesizări la primării din orice site — context menu, AI-formalizare, OG 27/2002 compliant.
```

**Detailed description** (max 16k chars, Markdown not supported — use
plain text + line breaks):

```
Civia Lens este extensia oficială Civia.ro pentru România.

CE FACE
• Click dreapta pe orice fotografie sau text dintr-un site → "Trimite la Civia"
• Conținutul preluat ajunge auto-prefilled în formularul de sesizare
• AI-ul Civia formalizează textul în limbaj de cerere oficială (OG 27/2002)
• Identifică autoritatea competentă (primărie, prefectură, poliția locală, garda mediu, CNAIR, salubritate, apa nova)
• Tu doar verifici și trimiți — Civia generează email-ul în numele tău

PE FACEBOOK
• Badge automat lângă posturile cu probleme civice raportate deja pe Civia
• Vezi câți cetățeni au co-semnat o sesizare similară din comunitatea ta

GDPR-CLEAN
• Zero tracking — extensia nu colectează date personale
• Toate fișierele sunt urcate pe Civia.ro doar când apeși "trimite"
• Cod sursă deschis: github.com/musatandrei/civia (în lucru)

REQUIRE
• Un cont Civia gratuit (creat în 30 secunde cu Google sign-in)
• Conectare la internet pentru AI și submit

CIVIA.RO
Platformă civică gratuită pentru toți cetățenii României.
42 județe + 6 sectoare București. 200+ autorități în catalog.
Sesizările tale sunt urmărite cu un cod de 6 cifre — răspunsul oficial
vine în max 30 zile (legea OG 27/2002).

Site: https://civia.ro
Contact: contact@civia.ro
```

**Category**: Productivity → Civic / Government
**Language**: Română (ro)

## 3. Privacy practices

Mark these answers in the Chrome Web Store Developer Console:

| Question | Answer |
|----------|--------|
| Single purpose | "Sesizări civice rapide din orice site la primării din România." |
| Permissions: `contextMenus` | "Pentru opțiunea 'Trimite la Civia' la click dreapta." |
| Permissions: `storage` | "Pentru a salva ultimul site folosit + setări utilizator." |
| Permissions: `activeTab` | "Pentru a citi conținutul paginii curente DOAR când userul apasă pe extensie." |
| Host permissions: `https://civia.ro/*` | "Pentru a trimite sesizările la civia.ro și a primi confirmare." |
| Collected data | "None — extensia nu colectează date personale." |
| Sold to 3rd parties | "No" |
| Used for unrelated purposes | "No" |
| Privacy policy URL | <https://civia.ro/legal/confidentialitate> |

## 4. Submission flow

1. Open <https://chrome.google.com/webstore/devconsole>.
2. Click **"New item"** → upload `civia-lens-v0.1.0.zip`.
3. Fill all fields above. Upload 1+ screenshots + promo tile.
4. Set **distribution**: Public, all regions (or Romania only if you
   want geographic gating — recommend Public for discoverability).
5. Click **"Submit for review"**.

Review typically takes **3-7 business days**. The first submission
sometimes gets flagged for additional info; respond within 7 days or
the submission is auto-rejected and you re-submit.

## 5. Post-launch — update flow

Every new version:

1. Bump `version` in `manifest.json` (semver: 0.1.0 → 0.1.1 patch,
   0.2.0 minor, 1.0.0 major).
2. `npm run pack` → new ZIP.
3. In the Dev Console, open the existing item → **"Package"** tab →
   upload new ZIP → fill **"What's new"** field → submit.

Updates take ~24h to roll out to users.

## 6. Firefox / Mozilla Add-ons (optional second target)

Firefox Add-ons (<https://addons.mozilla.org/developers/>) accepts the
same ZIP with minor manifest tweaks (some Firefox-specific keys).
Account is **free** (no $5 fee).

If you publish to Firefox too, mirror the listing fields. The two
stores are completely independent — updating one doesn't update the
other.

## 7. Maintenance schedule

- **Quarterly**: refresh screenshots if UI changes significantly.
- **On Civia API breaking changes**: bump extension minor version,
  test on Chrome stable + dev, push update.
- **Annually**: review permissions — remove anything unused (Chrome
  flags extensions that hold permissions they don't actively use).

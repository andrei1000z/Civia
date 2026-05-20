# Civia Lens — Browser Extension

> Chrome / Firefox extension pentru sesizari rapide din Facebook / Instagram / orice imagine pe web.

## Concept

Click dreapta pe orice imagine de pe web → **„Sesizează pe Civia"** in
context menu → tab nou cu `/sesizari?from=lens&img=...` pre-completed cu
poza + URL sursă.

Plus: marchează paginile Facebook ale primăriilor cu badge **„Răspunde la
X% din sesizări"** (data din `/api/v2/clasament`).

## Status

🚧 **În dezvoltare** — codebase separat (Manifest V3).

## Roadmap

### MVP (v0.1)
- Context menu „Sesizează pe Civia" la click dreapta pe imagini
- Auto-extract EXIF GPS daca disponibil
- Tab nou cu form pre-completed
- Sign-in unificat cu Civia.ro (cookie share)

### v0.2 — Authority badges
- Detect paginii Facebook primării (regex URL + match cu /api/v2/authorities)
- Inject badge cu rate de răspuns
- Click pe badge → /autoritati/[id]

### v0.3 — Power features
- Quick-share button în Reddit / Twitter / Instagram cu link Civia
- Background sync pentru sesizări trimise offline
- Stats dashboard în popup

## Tech

- Manifest V3
- WebExtensions API (cross-browser)
- TypeScript
- Build: esbuild (one-shot bundle, no bundler maintenance)

## Repository

Cod fizic în `/browser-extension` (acest folder).
La build → `dist/` cu Chrome `.crx` + Firefox `.xpi`.

## Distribuție

- Chrome Web Store (necesită $5 developer fee)
- Mozilla Add-ons (free)
- GitHub Releases pentru sideload power users

## Open Source

Va fi MIT licensed când iese din alpha. Repository public separat:
`civia-ro/civia-lens`.

## Resurse

- API public: https://civia.ro/api/v2/
- Documentație API: https://civia.ro/dezvoltatori
- Issue tracker: ____ (când e public)

## Contact

Pentru beta testers: andrei@civia.ro

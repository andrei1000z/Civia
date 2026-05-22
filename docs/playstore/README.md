# 📱 Civia pe Google Play Store — Documentație Completă

Toate documentele necesare pentru publicarea Civia pe Google Play Store
via Trusted Web Activity (TWA).

## 📂 Fișiere

| Fișier | Conține |
|---|---|
| [play-console-checklist.md](./play-console-checklist.md) | Checklist complet pas-cu-pas |
| [store-listing-RO.md](./store-listing-RO.md) | Descriere RO pentru Play Store |
| [store-listing-EN.md](./store-listing-EN.md) | Descriere EN pentru Play Store |
| [release-notes.md](./release-notes.md) | Release notes templates (0.0.0 → 1.0.0) |
| [screenshots-guide.md](./screenshots-guide.md) | Cum capturezi cele 6 screenshots + feature graphic |

## 🚀 Quick Start

1. Citește [play-console-checklist.md](./play-console-checklist.md) integral
2. Creează cont Play Console + plătește $25
3. Generează AAB cu PWABuilder (https://pwabuilder.com)
4. Updatează `public/.well-known/assetlinks.json` cu SHA-256 real
5. Completează Play Console folosind documentele din folder-ul ăsta
6. Upload AAB → Internal Testing → așteaptă review
7. 🎉

## 🔑 Versiuni planificate

```
0.0.0  → Internal Testing (tu + 2-5 prieteni)
0.1.0  → Closed Testing (20-50 utilizatori)
0.5.0  → Open Beta (oricine)
1.0.0  → Production launch
```

## ⚠️ Date critice

- **Package ID**: `ro.civia.app` (PERMANENT — niciodată schimbat)
- **App icon**: `/public/icon-512.png` (512×512 PNG no transparency)
- **Privacy Policy**: `https://civia.ro/legal/confidentialitate`
- **Signing keystore**: BACKUP în 3 locuri (1Password + USB + Drive criptat)

## 📞 Contact

- Email: contact@civia.ro
- GitHub: https://github.com/andrei1000z/Civia

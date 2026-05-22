# Digital Asset Links — Civia Android TWA

Acest folder conține `assetlinks.json` necesar pentru Trusted Web Activity
(TWA) pe Google Play Store. Folosit pentru a confirma că `civia.ro` și
aplicația Android `ro.civia.app` aparțin aceluiași proprietar.

## Cum să updatezi cu fingerprint-ul real (după PWABuilder)

1. După ce generezi AAB cu **PWABuilder**, deschizi fișierul
   `signing-key-info.txt` din zip-ul descărcat.
2. Caută linia `SHA-256: AA:BB:CC:...` — copy-paste tot string-ul.
3. În `assetlinks.json`, înlocuiește placeholder-ul
   `AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99`
   cu fingerprint-ul real.
4. Commit + push → deploy.
5. Verifică: `https://civia.ro/.well-known/assetlinks.json` întoarce JSON-ul corect.
6. Test cu Google's tool:
   https://developers.google.com/digital-asset-links/tools/generator
   - Hosting site: `civia.ro`
   - App package name: `ro.civia.app`
   - SHA-256: fingerprint-ul tău
   - Click „Test statement" → trebuie GREEN ✓

## Verificare

```bash
curl https://civia.ro/.well-known/assetlinks.json
```

Trebuie să întoarcă JSON-ul, NU 404.

## De ce e necesar

Fără `assetlinks.json`:
- TWA arată URL bar în partea de sus a app-ului (Chrome custom tab style)
- NU se simte ca app nativă
- Deep links `https://civia.ro/sesizari/00045` nu deschid app-ul direct, ci browserul

Cu `assetlinks.json` corect:
- App fullscreen fără URL bar ✓
- Deep links deschid app direct ✓
- Notificările push pot face deep linking ✓

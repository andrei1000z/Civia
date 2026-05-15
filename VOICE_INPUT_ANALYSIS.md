# VoiceInput Permission Issue Analysis

**Symptom:** User sees "Permisiunea microfonului a fost refuzată" (Permission Denied) on first mic button tap with no native prompt shown

**File locations:**
- Component: `src/components/sesizari/VoiceInput.tsx` (lines 1-136)
- Usage: `src/components/sesizari/SesizareForm.tsx` (line 1118)
- Config: `next.config.ts` (lines 88-106)

---

## KEY FINDING: Permissions-Policy Header Blocks Microphone

In `next.config.ts` lines 88-106, the response header includes:

```
Permissions-Policy: microphone=()
```

This is an **explicit deny** on microphone access for the entire origin. The comment at line 83-87 states:

> "Permissions-Policy mai strict (5/8/2026): explicit deny pe payment, USB, serial, bluetooth, MIDI, accelerometer, gyroscope, magnetometer, autoplay non-self. Civia n-are nevoie de niciuna dintre ele"

**Problem:** This policy header denies microphone (`microphone=()`) to all scripts, including the Web Speech API. When the user clicks the mic button, `rec.start()` fails immediately with error code `"service-not-allowed"` instead of showing the native permission prompt.

---

## A) Current Implementation

**API Used:** Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`)

**Language:** Romanian (`rec.lang = "ro-RO"` at line 79)

**Event Handlers:**
- `onresult` (lines 80-87): Captures final transcripts, appends them via `onTranscript(text)` callback
- `onerror` (lines 89-101): Catches error codes and translates to user messages
- `onend` (line 102): Resets listening state

**Settings:**
- `continuous: true` — listens for multiple utterances in one session
- `interimResults: false` — only returns final results, no interim text while user speaks
- No use of `navigator.mediaDevices.getUserMedia()` — relies purely on Web Speech API

---

## B) Permission Flow Analysis

**How Web Speech API requests mic access:**

1. User clicks toggle button → `rec.start()` is called (line 104)
2. Browser checks Permissions-Policy header
3. **BLOCKS HERE** because header says `microphone=()`
4. Instead of showing native permission prompt, `rec.onerror` fires with error code `"service-not-allowed"`
5. Component catches this at line 94 and displays the error message

**Error handling (lines 89-101):**
- Checks error code: `not-allowed` | `service-not-allowed` → Shows "Permisiunea microfonului a fost refuzată. Activează-o din setările browser-ului."
- `no-speech` → "Nu te-am auzit..."
- `network` → "Fără conexiune..."

The code does NOT pre-check permissions with `navigator.permissions.query({ name: 'microphone' })` — it relies on the API to fail and report the error.

---

## C) Root Cause: Permissions-Policy Header

**The culprit:**

```typescript
// next.config.ts line 93
"microphone=()";
```

This HTTP response header directive tells the browser:

- `microphone=()` = no origin (not even self) can access microphone
- This blocks Web Speech API before it can even request user permission
- The browser never shows the permission prompt because the site is policy-blocked, not permission-denied

**Why this is happening:**

1. `next.config.ts` was updated at 5/8/2026 with stricter Permissions-Policy
2. Comment says "Civia n-are nevoie" (Civia doesn't need) these permissions
3. But VoiceInput **does** need microphone access
4. The policy was set to deny all to prevent analytics/third-party scripts from silently requesting mic
5. **Oversight:** VoiceInput wasn't in scope when the policy was locked down

**Browser behavior (Chrome 132+):**

- When Permissions-Policy denies a feature, the browser raises `service-not-allowed` error
- This is not the same as user denying permission
- User never gets a chance to grant permission because the site itself says "no microphone allowed"

**Difference from previous denials:**

- If a user had previously denied microphone, error code is `"not-allowed"` and re-prompting after they change browser settings works
- If Permissions-Policy blocks it, error is `"service-not-allowed"` and changing browser settings won't help
- Either way, the message shown is the same (lines 94-95 catches both), so user sees no difference

---

## D) Error Handling & Robustness

**Handled error codes:**
- ✓ `not-allowed` → Permission denied by user
- ✓ `service-not-allowed` → Permission blocked by policy/browser
- ✓ `no-speech` → Silence detected
- ✓ `network` → Connection lost
- ✗ `aborted`, `audio-capture`, `bad-grammar` → No handling (silent fail)

**Graceful degradation:**
- ✓ Component hides itself if Web Speech API unsupported (line 65)
- ✓ Catches `rec.start()` throwing on double-click (line 107)
- ✓ Stops any in-progress recording on unmount (lines 59-63)

**Recovery flow:**
- When user sees error, message says "Activează-o din setările browser-ului"
- But if cause is `service-not-allowed` from Permissions-Policy, changing browser settings won't fix it
- Need to remove/change the header or use a policy like `microphone=(self)` instead of `microphone=()`

**Missing features:**
- No "Try again" button to retry after permission grant
- No link to browser settings
- No way to distinguish `not-allowed` (user denied) from `service-not-allowed` (policy blocked)
- Continuous mode (`continuous: true`) means once user says something, it keeps listening until they click Stop — can be unexpected

---

## E) Features Missing

- No filler word removal (Romanian: "ăăă", "deci", "păi")
- No stutter detection
- No auto-punctuation
- No sentence boundary detection (relies on user to stop talking)
- No interim transcript display (user can't see what's being heard while speaking)
- Append-only behavior — no option to replace text instead of append

---

## Summary

**Why user sees "Permisiunea microfonului a fost refuzată" on first tap:**

The `Permissions-Policy: microphone=()` HTTP header in `next.config.ts` prevents **any** script on the origin from accessing microphone, including the Web Speech API. When the user clicks the mic button, the browser rejects the request with error code `service-not-allowed` before showing the native permission prompt. This is not a browser bug or a double-denial from Chrome — it's an intentional site-level policy that blocks the feature.

**The fix would require:**

Changing line 93 of `next.config.ts` from `"microphone=()"` to `"microphone=(self)"` to allow scripts on the same origin (Civia) to request microphone access, while still blocking third-party analytics/scripts. But that's not the scope of this analysis.

---

**Technical references:**
- Web Speech API spec: https://wicg.github.io/speech-api/
- Permissions-Policy: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy
- Chrome permission deprecation: Chrome >= 130 requires explicit Permissions-Policy for sensitive features

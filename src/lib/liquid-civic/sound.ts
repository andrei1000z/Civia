/**
 * Liquid Civic — sound design opt-in system.
 *
 * Discrete UI sounds (toggle, send, success). Default OFF — user opts in
 * via /cont settings. Web Audio API for inline generation (no file
 * downloads needed for short blips).
 *
 * Pattern: import `playSound("send")` din componente, gata. Sistemul
 * verifica intern daca user-ul are enabled in localStorage.
 */

const ENABLED_KEY = "civia:sounds-enabled";

export type SoundKind = "toggle" | "send" | "success" | "tap" | "error";

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  try {
    const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
  } catch {
    return null;
  }
}

/** Returneaza true daca user-ul are sounds activate. */
export function soundsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Toggle global on/off. Apelat din /cont/setari. */
export function setSoundsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) {
      localStorage.setItem(ENABLED_KEY, "1");
    } else {
      localStorage.removeItem(ENABLED_KEY);
    }
  } catch { /* noop */ }
}

/**
 * Genereaza un blip discret folosing Web Audio API. Fără fișiere — totul
 * sintetizat in browser. ~50ms per sunet, max 2kHz envelopes.
 */
export function playSound(kind: SoundKind): void {
  if (!soundsEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  // Resume on user gesture if suspended (autoplay policy)
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => { /* noop */ });
  }

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Profile per kind — small envelopes, max -20dB
    switch (kind) {
      case "tap":
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.06);
        break;
      case "toggle":
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.linearRampToValueAtTime(660, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.10);
        osc.start(now);
        osc.stop(now + 0.11);
        break;
      case "send": {
        osc.type = "sine";
        osc.frequency.setValueAtTime(523, now);    // C5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
        gain.gain.setValueAtTime(0.10, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.19);
        break;
      }
      case "success": {
        // Two-note chime (E5 → G5)
        osc.type = "sine";
        osc.frequency.setValueAtTime(659, now);
        gain.gain.setValueAtTime(0.10, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.16);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(784, now + 0.1);
        gain2.gain.setValueAtTime(0.10, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.30);
        osc2.start(now + 0.1);
        osc2.stop(now + 0.31);
        break;
      }
      case "error":
        osc.type = "square";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(165, now + 0.10);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.13);
        break;
    }
  } catch {
    // Silent fail — audio API not supported or blocked
  }
}

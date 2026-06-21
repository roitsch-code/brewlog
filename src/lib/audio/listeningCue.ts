"use client";

/**
 * "BTTS is listening now" earcon — two soft ASCENDING sine notes (a rising
 * fifth, E5 → B5: open / go-ahead). Deliberately distinct from the brew timer's
 * DESCENDING 880→660 step cue (LightStepBrew) so the two are never confused.
 *
 * Played the instant the mic actually starts capturing (useVoiceCapture), so
 * the user knows they may speak. This is the cue that bridges the Siri-launch
 * → app-open → mic-hot handoff gap (and equally confirms a plain mic tap).
 *
 * Web Audio playback needs an unlocked AudioContext. A user gesture (the mic
 * tap) unlocks it, so the in-app case is reliable. A gesture-less launch
 * (future Siri auto-listen) may leave the context suspended on iOS — resume()
 * is attempted but not guaranteed; the recording itself never depends on it.
 */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

export function playListeningCue(): void {
  const audio = getCtx();
  if (!audio) return;
  // A suspended context (no recent gesture) — try to resume; harmless if it fails.
  if (audio.state === "suspended") audio.resume().catch(() => { /* ignore */ });
  try {
    const now = audio.currentTime;
    // [frequency, startOffset, duration] — a gentle rising fifth.
    const notes: [number, number, number][] = [
      [659.25, 0, 0.16],   // E5
      [987.77, 0.11, 0.2], // B5
    ];
    for (const [freq, offset, dur] of notes) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(audio.destination);
      const t0 = now + offset;
      // Soft ~8ms attack so there's no click, then a gentle exponential decay.
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }
  } catch {
    /* audio unavailable — must never block recording */
  }
}

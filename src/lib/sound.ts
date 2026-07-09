let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function playNotes(notes: { freq: number; at: number; dur: number; vol: number; type?: OscillatorType }[]): void {
  try {
    const audio = getCtx();
    const now = audio.currentTime;
    for (const n of notes) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = n.type ?? 'sine';
      osc.frequency.value = n.freq;
      const start = now + n.at;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(n.vol, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(start);
      osc.stop(start + n.dur + 0.1);
    }
  } catch {
    // audio not available — silently skip
  }
}

/** Friendly three-note rise for the hourly check-in popup (A4 → C#5 → E5). */
export function playCheckinChime(): void {
  playNotes([
    { freq: 440, at: 0, dur: 0.5, vol: 0.06 },
    { freq: 554.37, at: 0.14, dur: 0.5, vol: 0.06 },
    { freq: 659.25, at: 0.28, dur: 0.7, vol: 0.07 },
  ]);
}

/** Two short low pings for the anti-procrastination nudge. */
export function playNudgeSound(): void {
  playNotes([
    { freq: 311.13, at: 0, dur: 0.35, vol: 0.08, type: 'triangle' },
    { freq: 233.08, at: 0.22, dur: 0.5, vol: 0.08, type: 'triangle' },
  ]);
}

/** Soft two-note chime (C5 -> G5), short envelope, low volume. */
export function playChime(): void {
  try {
    const audio = getCtx();
    const now = audio.currentTime;
    const notes = [523.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + i * 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.07, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.7);
    });
  } catch {
    // audio not available — silently skip, sound is a nice-to-have
  }
}

// Tiny synthesised move / capture sounds via the Web Audio API — no asset
// files. Everything is guarded so it is a harmless no-op where Web Audio is
// unavailable (SSR, jsdom, locked-down browsers).

const STORAGE_KEY = 'mavens_sound';

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = ctx ?? new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

export function isSoundOn(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
}

export function playMoveSound(kind: 'move' | 'capture' = 'move'): void {
  if (!isSoundOn()) return;
  const ac = audioContext();
  if (!ac) return;
  if (ac.state === 'suspended') void ac.resume().catch(() => undefined);

  const now = ac.currentTime;
  const gain = ac.createGain();
  gain.connect(ac.destination);

  if (kind === 'capture') {
    const dur = 0.16;
    const buffer = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * dur)), ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const band = ac.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 340;
    src.connect(band).connect(gain);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.start(now);
    src.stop(now + dur);
  } else {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(230, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);
    osc.connect(gain);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.13);
  }
}

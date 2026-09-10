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

export type MoveSound = 'move' | 'capture' | 'castle' | 'check' | 'promote';

/** Pick the sound for a move from its SAN (e.g. "O-O", "exd8=Q+", "Nxe5"). */
export function soundForSan(san: string): MoveSound {
  if (!san) return 'move';
  if (san.startsWith('O-O')) return 'castle';
  if (san.includes('=')) return 'promote';
  if (san.includes('x')) return 'capture';
  if (/[+#]/.test(san)) return 'check';
  return 'move';
}

// A short sine "thock" — the building block for the non-noise sounds.
function blip(
  ac: AudioContext,
  at: number,
  fromHz: number,
  toHz: number,
  peak: number,
  len: number
): void {
  const gain = ac.createGain();
  gain.connect(ac.destination);
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(fromHz, at);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, toHz), at + len);
  osc.connect(gain);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + len);
  osc.start(at);
  osc.stop(at + len + 0.02);
}

/** A short three-note flourish for the end of a game. */
export function playGameOverSound(): void {
  if (!isSoundOn()) return;
  const ac = audioContext();
  if (!ac) return;
  if (ac.state === 'suspended') void ac.resume().catch(() => undefined);
  const now = ac.currentTime;
  blip(ac, now, 330, 320, 0.15, 0.14);
  blip(ac, now + 0.13, 262, 258, 0.15, 0.16);
  blip(ac, now + 0.29, 196, 190, 0.16, 0.3);
}

export function playMoveSound(kind: MoveSound = 'move'): void {
  if (!isSoundOn()) return;
  const ac = audioContext();
  if (!ac) return;
  if (ac.state === 'suspended') void ac.resume().catch(() => undefined);

  const now = ac.currentTime;

  switch (kind) {
    case 'capture': {
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
      const gain = ac.createGain();
      src.connect(band).connect(gain);
      gain.connect(ac.destination);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.start(now);
      src.stop(now + dur);
      break;
    }
    case 'castle':
      // two quick descending thocks — king then rook
      blip(ac, now, 240, 150, 0.15, 0.09);
      blip(ac, now + 0.11, 200, 130, 0.15, 0.1);
      break;
    case 'promote':
      // rising two-tone flourish
      blip(ac, now, 200, 300, 0.14, 0.09);
      blip(ac, now + 0.09, 320, 520, 0.14, 0.12);
      break;
    case 'check':
      // short bright ping
      blip(ac, now, 700, 640, 0.13, 0.14);
      break;
    default:
      blip(ac, now, 230, 140, 0.16, 0.12);
  }
}

import { describe, it, expect, beforeEach } from 'vitest';
import { isSoundOn, playMoveSound, setSoundOn, soundForSan } from './chess-sound';

describe('soundForSan', () => {
  it('maps SAN to the right sound', () => {
    expect(soundForSan('e4')).toBe('move');
    expect(soundForSan('Nxe5')).toBe('capture');
    expect(soundForSan('O-O')).toBe('castle');
    expect(soundForSan('O-O-O')).toBe('castle');
    expect(soundForSan('exd8=Q+')).toBe('promote');
    expect(soundForSan('Qh5+')).toBe('check');
    expect(soundForSan('')).toBe('move');
  });
});

describe('chess-sound', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });

  it('is on by default and respects the toggle', () => {
    expect(isSoundOn()).toBe(true);
    setSoundOn(false);
    expect(isSoundOn()).toBe(false);
    setSoundOn(true);
    expect(isSoundOn()).toBe(true);
  });

  it('never throws even where Web Audio is unavailable (jsdom)', () => {
    expect(() => playMoveSound('move')).not.toThrow();
    expect(() => playMoveSound('capture')).not.toThrow();
    setSoundOn(false);
    expect(() => playMoveSound('move')).not.toThrow();
  });
});

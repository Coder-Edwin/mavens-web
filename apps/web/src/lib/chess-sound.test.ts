import { describe, it, expect, beforeEach } from 'vitest';
import { isSoundOn, playMoveSound, setSoundOn } from './chess-sound';

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

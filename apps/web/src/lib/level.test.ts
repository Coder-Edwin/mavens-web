import { describe, it, expect } from 'vitest';
import { levelForRating } from './level';

describe('levelForRating', () => {
  it('classifies per Amwai’s bands: <1200 Novice, 1200-1700 Intermediate, >1700 Advanced', () => {
    expect(levelForRating(800)).toBe('NOVICE');
    expect(levelForRating(1199)).toBe('NOVICE');
    expect(levelForRating(1200)).toBe('INTERMEDIATE');
    expect(levelForRating(1700)).toBe('INTERMEDIATE');
    expect(levelForRating(1701)).toBe('ADVANCED');
    expect(levelForRating(2400)).toBe('ADVANCED');
  });
});

import type { StudentLevel } from './enrollments';

/// Mirrors apps/api/src/common/level.ts — Amwai's rating bands (Sept 2026):
/// Novice below 1200, Intermediate 1200-1700, Advanced above 1700. Used only
/// to suggest a level in the UI as a rating is typed; the server derives the
/// authoritative level itself from the same bands.
export function levelForRating(rating: number): StudentLevel {
  if (rating < 1200) return 'NOVICE';
  if (rating <= 1700) return 'INTERMEDIATE';
  return 'ADVANCED';
}

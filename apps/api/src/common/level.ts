import type { StudentLevel } from '@prisma/client';

/// Amwai's rating bands (Sept 2026): Novice below 1200, Intermediate
/// 1200–1700, Advanced above 1700. Used to turn a placement rating into a
/// level automatically instead of relying on the assessor's judgement call.
export function levelForRating(rating: number): StudentLevel {
  if (rating < 1200) return 'NOVICE';
  if (rating <= 1700) return 'INTERMEDIATE';
  return 'ADVANCED';
}

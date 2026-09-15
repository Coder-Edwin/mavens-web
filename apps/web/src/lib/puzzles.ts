import { api } from './api-client';

export interface PuzzleSet {
  id: string;
  coachId: string;
  title: string;
  description: string | null;
  difficulty: string | null;
  createdAt: string;
}

export interface PuzzleSetInput {
  title: string;
  description?: string;
  difficulty?: string;
}

export type PuzzleStatus = 'NEW' | 'SUBMITTED' | 'GRADED';

export interface PuzzleSubmission {
  id: string;
  assignmentId: string;
  submittedAt: string;
  score: number | null;
  feedback: string | null;
  gradedById: string | null;
  gradedAt: string | null;
}

export interface PuzzleAssignment {
  id: string;
  puzzleSetId: string;
  studentId: string;
  status: PuzzleStatus;
  dueDate: string | null;
  assignedAt: string;
  puzzleSet?: PuzzleSet;
  submission?: PuzzleSubmission | null;
  student?: { firstName: string; lastName: string };
}

export const puzzlesApi = {
  listSets: () => api.get<PuzzleSet[]>('/puzzle-sets'),
  createSet: (input: PuzzleSetInput) => api.post<PuzzleSet>('/puzzle-sets', input),
  listAssignments: (scope?: 'own') =>
    api.get<PuzzleAssignment[]>(`/puzzle-assignments${scope ? `?scope=${scope}` : ''}`),
  assign: (input: { puzzleSetId: string; studentIds: string[]; dueDate?: string }) =>
    api.post<PuzzleAssignment[]>('/puzzle-assignments', input),
  grade: (id: string, body: { score: number; feedback?: string }) =>
    api.patch<PuzzleSubmission>(`/puzzle-assignments/${id}/grade`, body)
};

export const PUZZLE_STATUS_LABEL: Record<PuzzleStatus, string> = {
  NEW: 'New',
  SUBMITTED: 'Submitted',
  GRADED: 'Graded'
};

export function puzzleStatusChip(s: PuzzleStatus): { cls: 'paid' | 'overdue' | 'pending'; label: string } {
  if (s === 'GRADED') return { cls: 'paid', label: 'Graded' };
  if (s === 'SUBMITTED') return { cls: 'pending', label: 'Submitted' };
  return { cls: 'overdue', label: 'New' };
}

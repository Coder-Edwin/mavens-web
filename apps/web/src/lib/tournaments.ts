import { api } from './api-client';

export type RoundStatus = 'PENDING' | 'PAIRED' | 'COMPLETED';
export type PairingResult = 'WHITE_WIN' | 'BLACK_WIN' | 'DRAW' | 'BYE';

export interface TournamentSummary {
  id: string;
  name: string;
  date: string;
  venue: string;
  feeAmount: string;
  capacity: number | null;
  totalRounds: number | null;
  registrationDeadline: string | null;
  registeredCount: number;
  isFull: boolean;
}

export interface TournamentRegistration {
  id: string;
  studentId: string;
  registeredAt: string;
  result: string | null;
  seed: number | null;
  withdrawn: boolean;
  student?: { firstName: string; lastName: string };
}

// The raw Tournament row as joined onto GET /tournaments/mine — narrower
// than TournamentSummary (no registeredCount/isFull, those are only
// computed on the plain list endpoint).
export interface TournamentBase {
  id: string;
  name: string;
  date: string;
  venue: string;
  feeAmount: string;
  capacity: number | null;
  totalRounds: number | null;
  registrationDeadline: string | null;
}

export interface MyTournamentRegistration extends TournamentRegistration {
  tournament: TournamentBase;
}

export interface Tournament {
  id: string;
  name: string;
  date: string;
  venue: string;
  feeAmount: string;
  capacity: number | null;
  totalRounds: number | null;
  registrationDeadline: string | null;
  registrations: TournamentRegistration[];
}

export interface PairingPlayerRef {
  id: string;
  student: { firstName: string; lastName: string };
}

export interface Pairing {
  id: string;
  board: number;
  whiteRegistrationId: string;
  blackRegistrationId: string | null;
  result: PairingResult | null;
  white: PairingPlayerRef;
  black: PairingPlayerRef | null;
}

export interface TournamentRound {
  id: string;
  number: number;
  status: RoundStatus;
  pairings: Pairing[];
}

export interface StandingRow {
  rank: number;
  registrationId: string;
  name: string;
  withdrawn: boolean;
  score: number;
  buchholz: number;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  byes: number;
  seed: number | null;
}

export interface TournamentInput {
  name: string;
  date: string;
  venue: string;
  feeAmount: number;
  capacity?: number;
  totalRounds?: number;
  registrationDeadline?: string;
}

export const tournamentsApi = {
  list: () => api.get<TournamentSummary[]>('/tournaments'),
  get: (id: string) => api.get<Tournament>(`/tournaments/${id}`),
  create: (input: TournamentInput) => api.post<TournamentSummary>('/tournaments', input),
  update: (id: string, patch: Partial<TournamentInput>) =>
    api.patch<TournamentSummary>(`/tournaments/${id}`, patch),
  register: (id: string, studentId: string) =>
    api.post<TournamentRegistration>(`/tournaments/${id}/register`, { studentId }),
  // For a STUDENT caller — the server resolves "which student" from the
  // token, so no studentId is sent (or needed).
  registerSelf: (id: string) => api.post<TournamentRegistration>(`/tournaments/${id}/register`, {}),
  mine: () => api.get<MyTournamentRegistration[]>('/tournaments/mine'),
  updateRegistration: (
    id: string,
    registrationId: string,
    patch: { withdrawn?: boolean; seed?: number }
  ) => api.patch<TournamentRegistration>(`/tournaments/${id}/registrations/${registrationId}`, patch),

  rounds: (id: string) => api.get<TournamentRound[]>(`/tournaments/${id}/rounds`),
  pairNextRound: (id: string) => api.post<TournamentRound>(`/tournaments/${id}/rounds`),
  deleteRound: (id: string, roundId: string) =>
    api.del<{ id: string }>(`/tournaments/${id}/rounds/${roundId}`),
  recordPairingResult: (id: string, pairingId: string, result: 'WHITE_WIN' | 'BLACK_WIN' | 'DRAW') =>
    api.patch<TournamentRound>(`/tournaments/${id}/pairings/${pairingId}`, { result }),
  standings: (id: string) => api.get<StandingRow[]>(`/tournaments/${id}/standings`)
};

export const RESULT_LABEL: Record<PairingResult, string> = {
  WHITE_WIN: '1–0',
  BLACK_WIN: '0–1',
  DRAW: '½–½',
  BYE: 'bye'
};

export function formatTournamentDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

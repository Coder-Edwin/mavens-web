import { api } from './api-client';
import type { StudentLevel } from './enrollments';

export interface StudentRecord {
  id: string;
  firstName: string;
  lastName: string;
  level: StudentLevel | null;
  dateOfBirth: string | null;
  homeAddress: string | null;
  priorExperience: string | null;
  joinedAt: string;
  user?: { email: string; isActive: boolean };
}

export interface StudentInput {
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  coachId?: string;
  homeAddress?: string;
  priorExperience?: string;
}

export interface CreateStudentResult {
  student: StudentRecord;
  tempPassword: string;
}

export const studentsApi = {
  list: (scope?: 'own') => api.get<StudentRecord[]>(`/students${scope ? `?scope=${scope}` : ''}`),
  get: (id: string) => api.get<StudentRecord>(`/students/${id}`),
  create: (input: StudentInput) => api.post<CreateStudentResult>('/students', input),
  update: (
    id: string,
    patch: Partial<Omit<StudentInput, 'email' | 'coachId'>> & { currentRating?: number }
  ) => api.patch<StudentRecord>(`/students/${id}`, patch)
};

export function studentName(s: { firstName: string; lastName: string }): string {
  return `${s.firstName} ${s.lastName}`.trim();
}

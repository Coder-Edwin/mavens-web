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
}

export const studentsApi = {
  list: () => api.get<StudentRecord[]>('/students'),
  get: (id: string) => api.get<StudentRecord>(`/students/${id}`)
};

export function studentName(s: { firstName: string; lastName: string }): string {
  return `${s.firstName} ${s.lastName}`.trim();
}

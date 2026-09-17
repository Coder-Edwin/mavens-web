import { api } from './api-client';

export interface Badge {
  id: string;
  name: string;
  icon: string;
  criteria: string | null;
}

export interface BadgeInput {
  name: string;
  icon: string;
  criteria?: string;
}

export interface StudentBadge {
  studentId: string;
  badgeId: string;
  earnedAt: string;
  badge: Badge;
}

export const badgesApi = {
  list: () => api.get<Badge[]>('/badges'),
  create: (input: BadgeInput) => api.post<Badge>('/badges', input),
  update: (id: string, patch: Partial<BadgeInput>) => api.patch<Badge>(`/badges/${id}`, patch),
  remove: (id: string) => api.del<{ id: string }>(`/badges/${id}`),
  award: (studentId: string, badgeId: string) =>
    api.post<StudentBadge>('/badges/award', { studentId, badgeId }),
  revoke: (badgeId: string, studentId: string) =>
    api.del<{ studentId: string; badgeId: string }>(`/badges/${badgeId}/students/${studentId}`),
  forStudent: (studentId: string) => api.get<StudentBadge[]>(`/badges/students/${studentId}`),
  mine: () => api.get<StudentBadge[]>('/badges/mine')
};

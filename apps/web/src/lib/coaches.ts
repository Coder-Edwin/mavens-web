import { api } from './api-client';

export type EmploymentType = 'STAFF' | 'CONSULTANT';
export const EMPLOYMENT_TYPES: EmploymentType[] = ['STAFF', 'CONSULTANT'];
export const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  STAFF: 'Staff',
  CONSULTANT: 'Consultant'
};

export interface Coach {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  bio: string | null;
  specialty: string | null;
  skills: string | null;
  employmentType: EmploymentType;
  createdAt: string;
  user?: { email: string; isActive: boolean };
}

export interface CoachInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  specialty?: string;
  bio?: string;
  skills?: string;
  employmentType?: EmploymentType;
}

export interface CreateCoachResult {
  coach: Coach;
  tempPassword: string;
}

export const coachesApi = {
  list: () => api.get<Coach[]>('/coaches'),
  get: (id: string) => api.get<Coach>(`/coaches/${id}`),
  create: (input: CoachInput) => api.post<CreateCoachResult>('/coaches', input),
  update: (id: string, patch: Partial<Omit<CoachInput, 'email'>>) =>
    api.patch<Coach>(`/coaches/${id}`, patch)
};

// A coach's display name: "First Last" when we have it, otherwise the login email.
export function coachName(c: {
  firstName: string | null;
  lastName: string | null;
  user?: { email: string };
}): string {
  const full = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  return full || c.user?.email || 'Unnamed coach';
}

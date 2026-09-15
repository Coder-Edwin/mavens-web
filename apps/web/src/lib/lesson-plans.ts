import { api } from './api-client';

export interface LessonPlan {
  id: string;
  coachId: string;
  title: string;
  objectives: string | null;
  materialUrl: string | null;
  difficulty: string | null;
  createdAt: string;
  coach?: { firstName: string | null; lastName: string | null };
}

export interface LessonPlanInput {
  title: string;
  objectives?: string;
  materialUrl?: string;
  difficulty?: string;
}

export const lessonPlansApi = {
  list: () => api.get<LessonPlan[]>('/lesson-plans'),
  get: (id: string) => api.get<LessonPlan>(`/lesson-plans/${id}`),
  create: (input: LessonPlanInput) => api.post<LessonPlan>('/lesson-plans', input),
  update: (id: string, patch: Partial<LessonPlanInput>) =>
    api.patch<LessonPlan>(`/lesson-plans/${id}`, patch),
  remove: (id: string) => api.del<{ id: string }>(`/lesson-plans/${id}`)
};

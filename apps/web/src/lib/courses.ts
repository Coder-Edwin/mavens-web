import { api } from './api-client';
import type { StudentLevel } from './enrollments';

export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export const COURSE_STATUSES: CourseStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived'
};

export function courseStatusChip(
  s: CourseStatus
): { cls: 'paid' | 'overdue' | 'pending'; label: string } {
  if (s === 'PUBLISHED') return { cls: 'paid', label: 'Published' };
  if (s === 'ARCHIVED') return { cls: 'overdue', label: 'Archived' };
  return { cls: 'pending', label: 'Draft' };
}

export type CourseAssignmentStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';
export const ASSIGNMENT_STATUS_LABEL: Record<CourseAssignmentStatus, string> = {
  ASSIGNED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed'
};

export interface CourseLesson {
  id: string;
  moduleId: string;
  title: string;
  body: string;
  fen: string | null;
  videoUrl: string | null;
  estimatedMinutes: number | null;
  position: number;
}

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  summary: string | null;
  position: number;
  lessons: CourseLesson[];
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  level: StudentLevel | null;
  status: CourseStatus;
  coverImageUrl: string | null;
  estimatedHours: number | null;
  createdAt: string;
  updatedAt: string;
  modules?: CourseModule[];
  _count?: { modules: number; assignments: number };
}

export interface CourseInput {
  title: string;
  summary?: string;
  level?: StudentLevel | null;
  status?: CourseStatus;
  coverImageUrl?: string;
  estimatedHours?: number;
}

export interface CourseAssignment {
  id: string;
  courseId: string;
  studentId: string;
  status: CourseAssignmentStatus;
  assignedAt: string;
  dueAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  course?: { id: string; title: string; level: StudentLevel | null; summary?: string | null; coverImageUrl?: string | null; _count?: { modules: number } };
  student?: { id: string; firstName: string; lastName: string };
  progress?: { total: number; done: number };
}

export interface MyCourseDetail {
  assignment: CourseAssignment;
  course: Course;
  completedLessonIds: string[];
}

export const coursesApi = {
  list: (filters: { status?: CourseStatus; level?: StudentLevel } = {}) => {
    const p = new URLSearchParams();
    if (filters.status) p.set('status', filters.status);
    if (filters.level) p.set('level', filters.level);
    const s = p.toString();
    return api.get<Course[]>(`/courses${s ? `?${s}` : ''}`);
  },
  get: (id: string) => api.get<Course>(`/courses/${id}`),
  create: (input: CourseInput) => api.post<Course>('/courses', input),
  update: (id: string, patch: Partial<CourseInput>) => api.patch<Course>(`/courses/${id}`, patch),
  remove: (id: string) => api.del<{ id: string }>(`/courses/${id}`),

  addModule: (courseId: string, body: { title: string; summary?: string }) =>
    api.post<CourseModule>(`/courses/${courseId}/modules`, body),
  updateModule: (id: string, body: { title?: string; summary?: string; position?: number }) =>
    api.patch<CourseModule>(`/course-modules/${id}`, body),
  removeModule: (id: string) => api.del<{ id: string }>(`/course-modules/${id}`),

  addLesson: (
    moduleId: string,
    body: { title: string; body: string; fen?: string; videoUrl?: string; estimatedMinutes?: number }
  ) => api.post<CourseLesson>(`/course-modules/${moduleId}/lessons`, body),
  updateLesson: (
    id: string,
    body: {
      title?: string;
      body?: string;
      fen?: string;
      videoUrl?: string;
      estimatedMinutes?: number;
      position?: number;
    }
  ) => api.patch<CourseLesson>(`/course-lessons/${id}`, body),
  removeLesson: (id: string) => api.del<{ id: string }>(`/course-lessons/${id}`),

  assign: (courseId: string, body: { studentIds: string[]; dueAt?: string }) =>
    api.post<{ assigned: number; skipped: number }>(`/courses/${courseId}/assign`, body),
  listAssignments: (filters: { courseId?: string; studentId?: string; status?: CourseAssignmentStatus } = {}) => {
    const p = new URLSearchParams();
    if (filters.courseId) p.set('courseId', filters.courseId);
    if (filters.studentId) p.set('studentId', filters.studentId);
    if (filters.status) p.set('status', filters.status);
    const s = p.toString();
    return api.get<CourseAssignment[]>(`/course-assignments${s ? `?${s}` : ''}`);
  },
  removeAssignment: (id: string) => api.del<{ id: string }>(`/course-assignments/${id}`),

  // student portal
  mine: () => api.get<CourseAssignment[]>('/courses/mine'),
  myCourse: (courseId: string) => api.get<MyCourseDetail>(`/courses/mine/${courseId}`),
  completeLesson: (lessonId: string) => api.post<CourseAssignment>(`/course-lessons/${lessonId}/complete`),
  uncompleteLesson: (lessonId: string) => api.del<CourseAssignment>(`/course-lessons/${lessonId}/complete`)
};

export function coursePercent(a: Pick<CourseAssignment, 'progress'>): number {
  const p = a.progress;
  if (!p || p.total === 0) return 0;
  return Math.round((p.done / p.total) * 100);
}

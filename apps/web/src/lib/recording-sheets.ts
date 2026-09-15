import { api } from './api-client';

export interface RecordingSheet {
  id: string;
  studentId: string;
  imageUrl: string;
  uploadedAt: string;
  coachComment: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewedBy?: { firstName: string | null; lastName: string | null };
}

export const recordingSheetsApi = {
  listForStudent: (studentId: string) =>
    api.get<RecordingSheet[]>(`/recording-sheets?studentId=${encodeURIComponent(studentId)}`),
  create: (input: { studentId: string; imageUrl: string; coachComment?: string }) =>
    api.post<RecordingSheet>('/recording-sheets', input),
  setComment: (id: string, coachComment: string) =>
    api.patch<RecordingSheet>(`/recording-sheets/${id}`, { coachComment }),
  remove: (id: string) => api.del<{ id: string }>(`/recording-sheets/${id}`)
};

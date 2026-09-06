import { api } from './api-client';

export type Audience = 'ALL' | 'PARENTS' | 'STUDENTS' | 'COACHES';
export const AUDIENCES: Audience[] = ['ALL', 'PARENTS', 'STUDENTS', 'COACHES'];

export const AUDIENCE_LABEL: Record<Audience, string> = {
  ALL: 'Everyone',
  PARENTS: 'Parents',
  STUDENTS: 'Students',
  COACHES: 'Coaches'
};

/** What a recipient sees in their dashboard feed. */
export interface FeedAnnouncement {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  createdAt: string;
}

/** Admin history row — adds the author. */
export interface AdminAnnouncement extends FeedAnnouncement {
  updatedAt: string;
  author: { email: string } | null;
}

export interface AnnouncementInput {
  title: string;
  body: string;
  audience?: Audience;
}

export const announcementsApi = {
  feed: () => api.get<FeedAnnouncement[]>('/announcements/feed'),
  listAdmin: () => api.get<AdminAnnouncement[]>('/announcements'),
  create: (input: AnnouncementInput) => api.post<AdminAnnouncement>('/announcements', input),
  update: (id: string, patch: Partial<AnnouncementInput>) =>
    api.patch<AdminAnnouncement>(`/announcements/${id}`, patch),
  remove: (id: string) => api.del<{ id: string }>(`/announcements/${id}`)
};

export function formatAnnouncementDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

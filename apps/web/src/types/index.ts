export type Role = 'admin' | 'coach' | 'student' | 'parent';

export type PaymentStatus = 'paid' | 'overdue' | 'pending';

export interface Kpi {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: 'up' | 'warn' | 'neutral';
}

export interface ActivityItem {
  id: string;
  text: string;
  time: string;
}

export interface PaymentRow {
  id: string;
  studentName: string;
  coachName: string;
  amount: string;
  status: PaymentStatus;
}

export interface StudentSummary {
  id: string;
  name: string;
  initials: string;
  lastSession: string;
  puzzlesThisMonth: number;
  progressPercent: number;
}

export interface SessionSlot {
  id: string;
  time: string;
  label: string;
}

export interface GradingItem {
  id: string;
  text: string;
}

export type PuzzleStatus = 'new' | 'review' | 'graded';

export interface PuzzleAssignment {
  id: string;
  title: string;
  tag: string;
  status: PuzzleStatus;
}

export interface Badge {
  id: string;
  icon: string;
  name: string;
}

export interface ChildProfile {
  id: string;
  name: string;
  age: number;
  subscriptionAmount: string;
  dueDate: string;
  daysRemaining: number;
  progressNotes: ActivityItem[];
  upcoming: ActivityItem[];
}

export interface StoreItem {
  id: string;
  name: string;
  price: string;
}

export interface AlertItem {
  id: string;
  label: string;
  detail: string;
}

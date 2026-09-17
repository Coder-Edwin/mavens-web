import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ParentProgress } from './ParentProgress';
import type { StudentRecord } from '@/lib/students';
import type { Enrollment } from '@/lib/enrollments';

let rosterImpl: () => Promise<StudentRecord[]>;
let mineImpl: () => Promise<Enrollment[]>;

vi.mock('@/lib/students', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/students')>();
  return {
    ...actual,
    studentsApi: { list: () => rosterImpl(), get: vi.fn() }
  };
});

vi.mock('@/lib/enrollments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/enrollments')>();
  return {
    ...actual,
    enrollmentsApi: { ...actual.enrollmentsApi, mine: () => mineImpl() }
  };
});

const student = (over: Partial<StudentRecord> = {}): StudentRecord => ({
  id: 'stu-1',
  firstName: 'Faith',
  lastName: 'Wambui',
  level: 'INTERMEDIATE',
  currentRating: 1350,
  dateOfBirth: null,
  homeAddress: null,
  priorExperience: null,
  joinedAt: '2026-01-15T00:00:00Z',
  ...over
});

beforeEach(() => {
  rosterImpl = async () => [student()];
  mineImpl = async () => [];
});

describe('ParentProgress', () => {
  it('gives the Progress nav item a real page showing level and rating', async () => {
    render(<ParentProgress />);
    expect(await screen.findByText('Intermediate')).toBeInTheDocument();
    expect(screen.getByText('1350')).toBeInTheDocument();
  });

  it('shows "not yet placed" when a child has no level', async () => {
    rosterImpl = async () => [student({ level: null, currentRating: null })];
    render(<ParentProgress />);
    expect(await screen.findByText(/not yet placed/i)).toBeInTheDocument();
  });

  it('shows a message when no children are linked', async () => {
    rosterImpl = async () => [];
    render(<ParentProgress />);
    expect(await screen.findByText(/no children linked yet/i)).toBeInTheDocument();
  });
});

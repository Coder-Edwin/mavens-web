import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RecordingSheets } from './RecordingSheets';
import type { RecordingSheet } from '@/lib/recording-sheets';
import type { StudentRecord } from '@/lib/students';

const createCalls: unknown[] = [];
const commentCalls: { id: string; comment: string }[] = [];
let rosterImpl: () => Promise<StudentRecord[]>;
let listImpl: (studentId: string) => Promise<RecordingSheet[]>;

vi.mock('@/lib/students', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/students')>();
  return {
    ...actual,
    studentsApi: { list: () => rosterImpl(), get: vi.fn() }
  };
});

vi.mock('@/lib/recording-sheets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/recording-sheets')>();
  return {
    ...actual,
    recordingSheetsApi: {
      listForStudent: (id: string) => listImpl(id),
      create: (input: unknown) => {
        createCalls.push(input);
        return Promise.resolve({} as RecordingSheet);
      },
      setComment: (id: string, comment: string) => {
        commentCalls.push({ id, comment });
        return Promise.resolve({} as RecordingSheet);
      },
      remove: vi.fn()
    }
  };
});

const student = (over: Partial<StudentRecord> = {}): StudentRecord => ({
  id: 'stu-1',
  firstName: 'Faith',
  lastName: 'Wambui',
  level: 'NOVICE',
  dateOfBirth: null,
  homeAddress: null,
  priorExperience: null,
  joinedAt: '2026-01-01T00:00:00Z',
  ...over
});

const sheet = (over: Partial<RecordingSheet> = {}): RecordingSheet => ({
  id: 'rs-1',
  studentId: 'stu-1',
  imageUrl: 'https://example.com/sheet.jpg',
  uploadedAt: '2026-09-01T00:00:00Z',
  coachComment: null,
  reviewedById: null,
  reviewedAt: null,
  ...over
});

beforeEach(() => {
  createCalls.length = 0;
  commentCalls.length = 0;
  rosterImpl = async () => [student()];
  listImpl = async () => [];
});

describe('RecordingSheets', () => {
  it('loads the roster and shows sheets for the selected student', async () => {
    listImpl = async () => [sheet()];
    render(<MemoryRouter><RecordingSheets /></MemoryRouter>);
    expect(await screen.findByAltText('Recording sheet')).toBeInTheDocument();
  });

  it('shows an empty state when a student has no sheets yet', async () => {
    render(<MemoryRouter><RecordingSheets /></MemoryRouter>);
    await screen.findByLabelText('Student');
    expect(await screen.findByText(/no recording sheets uploaded yet/i)).toBeInTheDocument();
  });

  it('uploads a new sheet for the selected student', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><RecordingSheets /></MemoryRouter>);
    await screen.findByLabelText('Student');

    await user.type(screen.getByLabelText(/photo url/i), 'https://x.com/photo.jpg');
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    expect(createCalls).toHaveLength(1);
    expect(createCalls[0]).toMatchObject({ studentId: 'stu-1', imageUrl: 'https://x.com/photo.jpg' });
  });

  it('saves a comment on an existing sheet', async () => {
    listImpl = async () => [sheet()];
    const user = userEvent.setup();
    render(<MemoryRouter><RecordingSheets /></MemoryRouter>);
    await screen.findByAltText('Recording sheet');

    await user.type(screen.getByPlaceholderText('Leave a comment…'), 'Great tactics here');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(commentCalls).toEqual([{ id: 'rs-1', comment: 'Great tactics here' }]);
  });

  it('shows who reviewed a sheet once it has a comment', async () => {
    listImpl = async () => [
      sheet({ coachComment: 'Well played', reviewedBy: { firstName: 'Brian', lastName: 'Otieno' } })
    ];
    render(<MemoryRouter><RecordingSheets /></MemoryRouter>);
    expect(await screen.findByText(/well played/i)).toBeInTheDocument();
    expect(screen.getByText(/Brian Otieno/)).toBeInTheDocument();
  });
});

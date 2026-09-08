import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { InvoicesAdmin } from './InvoicesAdmin';
import type { Invoice } from '@/lib/invoices';

const listCalls: unknown[] = [];
const genEnrollmentCalls: unknown[] = [];
const issueCalls: string[] = [];
const paymentCalls: { id: string; body: unknown }[] = [];
let listImpl: () => Promise<Invoice[]>;
let getImpl: (id: string) => Promise<Invoice>;

vi.mock('@/lib/invoices', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/invoices')>();
  return {
    ...actual,
    invoicesApi: {
      list: (f: unknown) => {
        listCalls.push(f);
        return listImpl();
      },
      get: (id: string) => getImpl(id),
      generateForEnrollment: (b: unknown) => {
        genEnrollmentCalls.push(b);
        return Promise.resolve({ id: 'new' } as Invoice);
      },
      generateForSchoolGroup: vi.fn(),
      issue: (id: string) => {
        issueCalls.push(id);
        return Promise.resolve({ id } as Invoice);
      },
      update: vi.fn(),
      recordPayment: (id: string, body: unknown) => {
        paymentCalls.push({ id, body });
        return Promise.resolve({ id } as Invoice);
      },
      voidInvoice: vi.fn(),
      remove: vi.fn(),
      exportCsv: vi.fn()
    }
  };
});

vi.mock('@/lib/enrollments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/enrollments')>();
  return {
    ...actual,
    enrollmentsApi: {
      ...actual.enrollmentsApi,
      list: () =>
        Promise.resolve([
          { id: 'enr-1', studentId: 'stu-1', deliveryType: 'CENTER', status: 'ACTIVE', student: { id: 'stu-1', firstName: 'Faith', lastName: 'Wambui' } }
        ])
    }
  };
});

vi.mock('@/lib/school-groups', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/school-groups')>();
  return {
    ...actual,
    schoolGroupsApi: { list: () => Promise.resolve([]), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }
  };
});

const invoice = (over: Partial<Invoice>): Invoice => ({
  id: 'inv1',
  number: 'INV-2026-0001',
  enrollmentId: 'enr-1',
  schoolGroupId: null,
  billToUserId: 'u1',
  periodStart: '2026-06-01T00:00:00Z',
  periodEnd: '2026-06-30T00:00:00Z',
  status: 'DRAFT',
  currency: 'KES',
  subtotal: '4500',
  total: '4500',
  amountPaid: '0',
  issuedAt: null,
  dueAt: null,
  notes: null,
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-01T00:00:00Z',
  enrollment: { id: 'enr-1', deliveryType: 'CENTER', level: 'NOVICE', student: { id: 'stu-1', firstName: 'Faith', lastName: 'Wambui' } },
  lines: [
    { id: 'l1', description: 'Session — Pins (2026-06-06)', quantity: 1, unitAmount: '1500', amount: '1500', rateCardId: 'rc', sessionId: 's1' }
  ],
  payments: [],
  ...over
});

beforeEach(() => {
  listCalls.length = 0;
  genEnrollmentCalls.length = 0;
  issueCalls.length = 0;
  paymentCalls.length = 0;
  listImpl = async () => [invoice({ id: 'inv1' })];
  getImpl = async (id) => invoice({ id });
});

function renderAdmin() {
  return render(
    <MemoryRouter>
      <InvoicesAdmin />
    </MemoryRouter>
  );
}

describe('InvoicesAdmin', () => {
  it('lists invoices with number, billed-to and total', async () => {
    renderAdmin();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('INV-2026-0001')).toBeInTheDocument();
    expect(within(table).getByText('Faith Wambui')).toBeInTheDocument();
  });

  it('generates an invoice for an enrollment', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Generate invoice' }));
    await user.selectOptions(screen.getByLabelText('Enrollment'), 'enr-1');
    await user.click(screen.getByRole('button', { name: 'Generate' }));

    expect(genEnrollmentCalls).toHaveLength(1);
    expect(genEnrollmentCalls[0]).toMatchObject({ enrollmentId: 'enr-1' });
  });

  it('issues a draft and records a payment from the detail panel', async () => {
    const user = userEvent.setup();
    renderAdmin();
    const table = await screen.findByRole('table');

    await user.click(within(table).getByRole('button', { name: 'Open' }));
    await user.click(await screen.findByRole('button', { name: 'Issue' }));
    expect(issueCalls).toEqual(['inv1']);

    await user.type(screen.getByLabelText('Record payment'), '2000');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(paymentCalls[0]).toMatchObject({ id: 'inv1', body: { amount: 2000, method: 'MPESA' } });
  });
});

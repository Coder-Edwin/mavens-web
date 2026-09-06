import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { JoinPage } from './JoinPage';
import { ApiError } from '@/lib/api-client';
import type { Lead, LeadInput } from '@/lib/leads';

// Plain stub (not vi.fn) so a rejecting impl isn't flagged as an unhandled
// rejection by vitest's mock-result tracking.
const calls: LeadInput[] = [];
let impl: (input: LeadInput) => Promise<Lead>;

vi.mock('@/lib/leads', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/leads')>();
  return {
    ...actual,
    leadsApi: {
      ...actual.leadsApi,
      submit: (input: LeadInput) => {
        calls.push(input);
        return impl(input);
      }
    }
  };
});

function renderJoin() {
  return render(
    <MemoryRouter>
      <JoinPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  calls.length = 0;
  impl = async (input) => ({
    id: 'lead-1',
    parentName: input.parentName,
    email: input.email,
    phone: input.phone,
    childName: input.childName ?? null,
    childAge: input.childAge ?? null,
    message: input.message ?? null,
    status: 'NEW',
    notes: null,
    createdAt: '2026-09-06T00:00:00Z',
    updatedAt: '2026-09-06T00:00:00Z'
  });
});

describe('JoinPage', () => {
  it('submits the trimmed form and shows a confirmation', async () => {
    const user = userEvent.setup();
    renderJoin();
    const form = screen.getByRole('form', { name: /register your interest/i });

    await user.type(within(form).getByLabelText(/your name/i), '  Grace Wambui  ');
    await user.type(within(form).getByLabelText(/^email/i), 'grace@example.com');
    await user.type(within(form).getByLabelText(/^phone/i), '254712345678');
    await user.type(within(form).getByLabelText(/child’s name/i), 'Faith');
    await user.type(within(form).getByLabelText(/child’s age/i), '9');
    await user.type(within(form).getByLabelText(/anything else/i), 'Weekend classes please');
    await user.click(within(form).getByRole('button', { name: /send my details/i }));

    expect(calls[0]).toEqual({
      parentName: 'Grace Wambui',
      email: 'grace@example.com',
      phone: '254712345678',
      childName: 'Faith',
      childAge: 9,
      message: 'Weekend classes please'
    });
    expect(await screen.findByText(/we’ve got your details/i)).toBeInTheDocument();
  });

  it('omits empty optional fields from the payload', async () => {
    const user = userEvent.setup();
    renderJoin();
    const form = screen.getByRole('form', { name: /register your interest/i });

    await user.type(within(form).getByLabelText(/your name/i), 'A Parent');
    await user.type(within(form).getByLabelText(/^email/i), 'a@b.com');
    await user.type(within(form).getByLabelText(/^phone/i), '0712000000');
    await user.click(within(form).getByRole('button', { name: /send my details/i }));

    expect(calls[0]).toEqual({ parentName: 'A Parent', email: 'a@b.com', phone: '0712000000' });
  });

  it('keeps the form and shows the error message when the API rejects', async () => {
    impl = async () => {
      throw new ApiError(400, 'phone must be valid');
    };
    const user = userEvent.setup();
    renderJoin();
    const form = screen.getByRole('form', { name: /register your interest/i });

    await user.type(within(form).getByLabelText(/your name/i), 'A Parent');
    await user.type(within(form).getByLabelText(/^email/i), 'a@b.com');
    await user.type(within(form).getByLabelText(/^phone/i), 'x');
    await user.click(within(form).getByRole('button', { name: /send my details/i }));

    expect(await screen.findByText('phone must be valid')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send my details/i })).toBeInTheDocument();
  });
});

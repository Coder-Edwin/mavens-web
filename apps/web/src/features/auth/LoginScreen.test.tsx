import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LoginScreen } from './LoginScreen';
import { ApiError } from '@/lib/api-client';

const login = vi.fn();
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ login, user: null, isLoading: false, logout: vi.fn() })
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/app" element={<div>APP HOME</div>} />
        <Route path="/" element={<div>PUBLIC SITE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('LoginScreen', () => {
  it('signs in and navigates to /app on success', async () => {
    login.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'amwai@mavenschessclub.com');
    await user.type(screen.getByLabelText('Password'), 'changeme123');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(login).toHaveBeenCalledWith('amwai@mavenschessclub.com', 'changeme123');
    expect(await screen.findByText('APP HOME')).toBeInTheDocument();
  });

  it('shows the API error message and stays on the login screen on failure', async () => {
    login.mockRejectedValueOnce(new ApiError(401, 'Invalid email or password'));
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'wrong@example.com');
    await user.type(screen.getByLabelText('Password'), 'nope');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(screen.queryByText('APP HOME')).not.toBeInTheDocument();
  });

  it('offers a route back to the public site', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: /back to site/i })).toHaveAttribute('href', '/');
  });
});

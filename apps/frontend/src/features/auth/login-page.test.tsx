import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LoginPage } from './login-page';
import { useAuth } from './auth-context';
import { toast } from '@/components/ui/use-toast';

vi.mock('./auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  const login = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      status: 'unauthenticated',
      user: null,
      login,
      register: vi.fn(),
      logout: vi.fn(),
    });
  });

  it('shows validation errors when submitted empty', async () => {
    const user = userEvent.setup();
    const { container } = renderLoginPage();
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(container.querySelectorAll('.text-destructive').length).toBeGreaterThan(0));
    expect(login).not.toHaveBeenCalled();
  });

  it('calls login with the entered credentials on submit', async () => {
    login.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderLoginPage();
    await user.type(screen.getByLabelText('Email'), 'writer@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery-staple');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({ email: 'writer@example.com', password: 'correct-horse-battery-staple' }),
    );
  });

  it('shows a toast when login fails', async () => {
    login.mockRejectedValue(new Error('invalid credentials'));
    const user = userEvent.setup();
    renderLoginPage();
    await user.type(screen.getByLabelText('Email'), 'writer@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', title: 'Sign in failed' })),
    );
  });
});

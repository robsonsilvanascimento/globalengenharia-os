import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { LoginPage } from './LoginPage';

vi.mock('./useAuth', () => ({
  useAuth: () => ({ login: vi.fn(), logout: vi.fn(), usuario: null, papel: null, isAuthenticated: false }),
}));

describe('LoginPage', () => {
  it('renders email and password fields plus the submit button', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(document.getElementById('login-senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('toggles the password input between hidden and visible when the eye button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    const senhaInput = document.getElementById('login-senha') as HTMLInputElement;
    expect(senhaInput.type).toBe('password');

    const toggleButton = screen.getByRole('button', { name: /mostrar senha/i });
    await user.click(toggleButton);
    expect(senhaInput.type).toBe('text');

    const hideButton = screen.getByRole('button', { name: /ocultar senha/i });
    await user.click(hideButton);
    expect(senhaInput.type).toBe('password');
  });
});

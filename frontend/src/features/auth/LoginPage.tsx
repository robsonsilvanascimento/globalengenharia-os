import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FormField } from '../../components/ui/FormField';
import { ApiError } from '../../lib/api/httpClient';
import { useAuth } from './useAuth';
import './LoginPage.css';

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, senha);
      const redirectTo = (location.state as LocationState | null)?.from?.pathname ?? '/';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setError(err.message);
      } else {
        setError('Não foi possível fazer login. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-page-form" onSubmit={handleSubmit}>
        <img
          src="/brand/logo.png"
          alt="Global Engenharia"
          className="login-page-logo"
        />
        <h1 className="login-page-title">Entrar</h1>

        <FormField label="Email" htmlFor="login-email" required>
          <input
            id="login-email"
            type="email"
            className="login-page-input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
          />
        </FormField>

        <FormField label="Senha" htmlFor="login-senha" required>
          <div className="login-page-password-wrapper">
            <input
              id="login-senha"
              type={mostrarSenha ? 'text' : 'password'}
              className="login-page-input"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="login-page-toggle-senha"
              onClick={() => setMostrarSenha((atual) => !atual)}
              aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              tabIndex={-1}
            >
              {mostrarSenha ? '🙈' : '👁️'}
            </button>
          </div>
        </FormField>

        <div className="login-page-forgot-row">
          <Link to="/esqueci-senha" className="login-page-forgot-link">
            Esqueci minha senha
          </Link>
        </div>

        {error && <span className="login-page-error">{error}</span>}

        <button type="submit" className="login-page-submit" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

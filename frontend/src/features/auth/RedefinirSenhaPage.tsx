import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FormField } from '../../components/ui/FormField';
import { ApiError, httpClient } from '../../lib/api/httpClient';
import './RedefinirSenhaPage.css';

const SENHA_MIN_LENGTH = 6;

export function RedefinirSenhaPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  function validar(): string | null {
    if (novaSenha.length < SENHA_MIN_LENGTH) {
      return `A nova senha deve ter no mínimo ${SENHA_MIN_LENGTH} caracteres.`;
    }
    if (novaSenha !== confirmarSenha) {
      return 'As senhas não coincidem.';
    }
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    const validacao = validar();
    if (validacao) {
      setError(validacao);
      return;
    }

    setIsSubmitting(true);

    try {
      await httpClient.post('/auth/redefinir-senha', { token, nova_senha: novaSenha });
      setSucesso(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError(err.message);
      } else {
        setError('Não foi possível redefinir sua senha agora. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sucesso) {
    return (
      <div className="auth-page">
        <div className="auth-page-form">
          <h1 className="auth-page-title">Senha redefinida com sucesso!</h1>
          <Link to="/login" className="auth-page-back-link">
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-page-form" onSubmit={handleSubmit}>
        <h1 className="auth-page-title">Redefinir senha</h1>
        <p className="auth-page-subtitle">Escolha uma nova senha para sua conta.</p>

        <FormField label="Nova senha" htmlFor="redefinir-senha-nova" required>
          <div className="auth-page-password-wrapper">
            <input
              id="redefinir-senha-nova"
              type={mostrarSenha ? 'text' : 'password'}
              className="auth-page-input"
              value={novaSenha}
              onChange={(event) => setNovaSenha(event.target.value)}
              autoComplete="new-password"
              minLength={SENHA_MIN_LENGTH}
              required
            />
            <button
              type="button"
              className="auth-page-toggle-senha"
              onClick={() => setMostrarSenha((atual) => !atual)}
              aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              tabIndex={-1}
            >
              {mostrarSenha ? '🙈' : '👁️'}
            </button>
          </div>
        </FormField>

        <FormField label="Confirmar nova senha" htmlFor="redefinir-senha-confirmar" required>
          <div className="auth-page-password-wrapper">
            <input
              id="redefinir-senha-confirmar"
              type={mostrarConfirmarSenha ? 'text' : 'password'}
              className="auth-page-input"
              value={confirmarSenha}
              onChange={(event) => setConfirmarSenha(event.target.value)}
              autoComplete="new-password"
              minLength={SENHA_MIN_LENGTH}
              required
            />
            <button
              type="button"
              className="auth-page-toggle-senha"
              onClick={() => setMostrarConfirmarSenha((atual) => !atual)}
              aria-label={mostrarConfirmarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              tabIndex={-1}
            >
              {mostrarConfirmarSenha ? '🙈' : '👁️'}
            </button>
          </div>
        </FormField>

        {error && (
          <span className="auth-page-error">
            {error}
            {' '}
            <Link to="/esqueci-senha">Solicitar novo link</Link>
          </span>
        )}

        <button type="submit" className="auth-page-submit" disabled={isSubmitting}>
          {isSubmitting ? 'Redefinindo...' : 'Redefinir senha'}
        </button>
      </form>
    </div>
  );
}

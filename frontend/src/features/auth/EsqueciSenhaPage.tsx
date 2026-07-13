import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { FormField } from '../../components/ui/FormField';
import { httpClient } from '../../lib/api/httpClient';
import './EsqueciSenhaPage.css';

export function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await httpClient.post('/auth/esqueci-senha', { email });
      setEnviado(true);
    } catch {
      setError('Não foi possível enviar as instruções agora. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (enviado) {
    return (
      <div className="auth-page">
        <div className="auth-page-form">
          <h1 className="auth-page-title">Verifique seu e-mail</h1>
          <span className="auth-page-success">
            Se esse e-mail estiver cadastrado, você vai receber um link para redefinir sua senha.
          </span>
          <Link to="/login" className="auth-page-back-link">
            Voltar para o login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-page-form" onSubmit={handleSubmit}>
        <h1 className="auth-page-title">Esqueci minha senha</h1>
        <p className="auth-page-subtitle">
          Informe seu e-mail de cadastro e enviaremos instruções para redefinir sua senha.
        </p>

        <FormField label="Email" htmlFor="esqueci-senha-email" required>
          <input
            id="esqueci-senha-email"
            type="email"
            className="auth-page-input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
          />
        </FormField>

        {error && <span className="auth-page-error">{error}</span>}

        <button type="submit" className="auth-page-submit" disabled={isSubmitting}>
          {isSubmitting ? 'Enviando...' : 'Enviar instruções'}
        </button>

        <Link to="/login" className="auth-page-back-link">
          Voltar para o login
        </Link>
      </form>
    </div>
  );
}

import { useState } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '../../../components/ui/FormField';
import { Select } from '../../../components/ui/Select';
import type { SelectOption } from '../../../components/ui/Select';
import { useSalvarConfigRelatorio } from '../hooks/useSalvarConfigRelatorio';
import type { ConfigRelatorio } from '../hooks/useSalvarConfigRelatorio';

const FREQUENCIA_OPTIONS: SelectOption[] = [
  { value: 'semanal', label: 'Semanal — toda segunda às 7h' },
  { value: 'mensal', label: 'Mensal — dia 1 de cada mês às 7h' },
];

export default function RelatorioConfigPage() {
  const [frequencia, setFrequencia] = useState<ConfigRelatorio['frequencia']>('semanal');
  const [emailDestino, setEmailDestino] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useSalvarConfigRelatorio();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    mutation.mutate(
      { frequencia, email_destino: emailDestino },
      {
        onSuccess: () => setSuccessMessage('Configuração salva com sucesso!'),
        onError: () => setErrorMessage('Não foi possível salvar a configuração. Tente novamente.'),
      },
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.25rem' }}>
        Relatório Gerencial Automático
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem', fontSize: '0.95rem' }}>
        Configure o envio automático do relatório executivo por e-mail.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <FormField label="Frequência" htmlFor="relatorio-frequencia" required>
          <Select
            id="relatorio-frequencia"
            name="frequencia"
            options={FREQUENCIA_OPTIONS}
            value={frequencia}
            onChange={(value) => setFrequencia(value as ConfigRelatorio['frequencia'])}
            disabled={mutation.isPending}
          />
        </FormField>

        <FormField label="E-mail destino" htmlFor="relatorio-email" required>
          <input
            id="relatorio-email"
            type="email"
            value={emailDestino}
            onChange={(event) => setEmailDestino(event.target.value)}
            placeholder="admin@empresa.com"
            required
            disabled={mutation.isPending}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </FormField>

        {successMessage && (
          <span style={{ color: '#16a34a', fontSize: '0.9rem' }}>{successMessage}</span>
        )}
        {errorMessage && (
          <span style={{ color: '#dc2626', fontSize: '0.9rem' }}>{errorMessage}</span>
        )}

        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Salvando...' : 'Salvar configuração'}
        </button>
      </form>
    </div>
  );
}

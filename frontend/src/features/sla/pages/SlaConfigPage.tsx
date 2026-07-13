import { useState, useEffect, type FormEvent } from 'react';
import type { SlaConfig } from '../../../types/sla';
import { useSlaConfig } from '../hooks/useSlaConfig';
import { useUpdateSlaConfig } from '../hooks/useUpdateSlaConfig';
import './SlaConfigPage.css';

const PRIORIDADES: SlaConfig['prioridade'][] = ['urgente', 'alta', 'normal', 'baixa'];

export default function SlaConfigPage() {
  const { data, isLoading } = useSlaConfig();
  const updateMutation = useUpdateSlaConfig();

  const [values, setValues] = useState<Record<string, number>>({});
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      const initial: Record<string, number> = {};
      for (const item of data) {
        initial[item.prioridade] = item.prazo_horas;
      }
      setValues(initial);
    }
  }, [data]);

  function handleChange(prioridade: string, raw: string): void {
    setFieldError(null);
    setSuccessMessage(null);
    setValues((prev) => ({ ...prev, [prioridade]: Number(raw) }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFieldError(null);
    setSuccessMessage(null);

    for (const prioridade of PRIORIDADES) {
      const val = values[prioridade];
      if (!val || val <= 0) {
        setFieldError(`O prazo para "${prioridade}" deve ser maior que 0.`);
        return;
      }
    }

    const mutations = PRIORIDADES.map((prioridade) =>
      updateMutation.mutateAsync({ prioridade, prazo_horas: values[prioridade] }),
    );

    Promise.all(mutations)
      .then(() => {
        setSuccessMessage('Configurações salvas com sucesso.');
      })
      .catch(() => {
        setFieldError('Não foi possível salvar as configurações. Tente novamente.');
      });
  }

  if (isLoading) {
    return <p>Carregando configuração...</p>;
  }

  return (
    <div className="sla-config-page">
      <h1 className="sla-config-title">Configuração de SLA</h1>

      <form className="sla-config-form" onSubmit={handleSubmit}>
        {PRIORIDADES.map((prioridade) => (
          <div key={prioridade} className="sla-config-field">
            <label className="sla-config-label" htmlFor={`sla-${prioridade}`}>
              {prioridade} (horas)
            </label>
            <input
              id={`sla-${prioridade}`}
              type="number"
              className="sla-config-input"
              min={1}
              value={values[prioridade] ?? ''}
              onChange={(event) => handleChange(prioridade, event.target.value)}
              required
            />
          </div>
        ))}

        {fieldError && <span className="sla-config-error">{fieldError}</span>}
        {successMessage && <span className="sla-config-success">{successMessage}</span>}

        <div className="sla-config-actions">
          <button type="submit" className="sla-config-submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}

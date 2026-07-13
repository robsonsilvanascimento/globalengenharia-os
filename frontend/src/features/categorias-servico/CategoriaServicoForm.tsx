import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormField } from '../../components/ui/FormField';
import { Select } from '../../components/ui/Select';
import type { SelectOption } from '../../components/ui/Select';
import { httpClient, ApiError } from '../../lib/api/httpClient';
import type { AreaCategoriaServico, CategoriaServico } from '../../types/api';
import { CATEGORIAS_SERVICO_QUERY_KEY } from './useCategoriasServicoQuery';
import './CategoriaServicoForm.css';

const AREA_OPTIONS: SelectOption[] = [
  { value: 'eletrica', label: 'Elétrica' },
  { value: 'automacao', label: 'Automação' },
  { value: 'energia_solar', label: 'Energia Solar' },
  { value: 'outro', label: 'Outro' },
];

export interface CategoriaServicoFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function CategoriaServicoForm({ onSuccess, onCancel }: CategoriaServicoFormProps) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState('');
  const [area, setArea] = useState<AreaCategoriaServico>('eletrica');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      httpClient.post<CategoriaServico>('/categorias-servico', { nome: nome.trim(), area, ativo: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIAS_SERVICO_QUERY_KEY });
      onSuccess();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar a categoria.');
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);

    if (!nome.trim()) {
      setError('Informe o nome da categoria.');
      return;
    }

    createMutation.mutate();
  }

  return (
    <form className="categoria-servico-form" onSubmit={handleSubmit}>
      <FormField label="Nome" htmlFor="categoria-nome" required>
        <input
          id="categoria-nome"
          type="text"
          className="categoria-servico-form-input"
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          required
        />
      </FormField>

      <FormField label="Área" htmlFor="categoria-area" required>
        <Select
          id="categoria-area"
          name="area"
          options={AREA_OPTIONS}
          value={area}
          onChange={(value) => setArea(value as AreaCategoriaServico)}
        />
      </FormField>

      {error && <span className="categoria-servico-form-error">{error}</span>}

      <div className="categoria-servico-form-actions">
        <button
          type="button"
          className="categoria-servico-form-cancel"
          onClick={onCancel}
          disabled={createMutation.isPending}
        >
          Cancelar
        </button>
        <button type="submit" className="categoria-servico-form-submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormField } from '../../components/ui/FormField';
import { httpClient, ApiError } from '../../lib/api/httpClient';
import type { FaqEntry } from '../../types/api';
import { FAQ_QUERY_KEY } from './useFaqQuery';
import './FaqForm.css';

export interface FaqFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function FaqForm({ onSuccess, onCancel }: FaqFormProps) {
  const queryClient = useQueryClient();
  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      httpClient.post<FaqEntry>('/faq', {
        pergunta: pergunta.trim(),
        resposta: resposta.trim(),
        tags: tags.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FAQ_QUERY_KEY });
      onSuccess();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar a pergunta.');
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);

    if (!pergunta.trim() || !resposta.trim()) {
      setError('Informe a pergunta e a resposta.');
      return;
    }

    createMutation.mutate();
  }

  return (
    <form className="faq-form" onSubmit={handleSubmit}>
      <FormField label="Pergunta" htmlFor="faq-pergunta" required>
        <input
          id="faq-pergunta"
          type="text"
          className="faq-form-input"
          value={pergunta}
          onChange={(event) => setPergunta(event.target.value)}
          required
        />
      </FormField>

      <FormField label="Resposta" htmlFor="faq-resposta" required>
        <textarea
          id="faq-resposta"
          className="faq-form-textarea"
          rows={4}
          value={resposta}
          onChange={(event) => setResposta(event.target.value)}
          required
        />
      </FormField>

      <FormField label="Tags (separadas por vírgula)" htmlFor="faq-tags">
        <input
          id="faq-tags"
          type="text"
          className="faq-form-input"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="ex.: energia solar, instalação"
        />
      </FormField>

      {error && <span className="faq-form-error">{error}</span>}

      <div className="faq-form-actions">
        <button
          type="button"
          className="faq-form-cancel"
          onClick={onCancel}
          disabled={createMutation.isPending}
        >
          Cancelar
        </button>
        <button type="submit" className="faq-form-submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}

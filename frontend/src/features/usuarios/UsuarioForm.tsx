import { useState } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '../../components/ui/FormField';
import { Select } from '../../components/ui/Select';
import type { SelectOption } from '../../components/ui/Select';
import { httpClient, ApiError } from '../../lib/api/httpClient';
import type { PapelUsuario, Usuario } from '../../types/api';
import './UsuarioForm.css';

const PAPEIS_COM_COMISSAO: PapelUsuario[] = ['tecnico', 'ajudante'];

const PAPEL_OPTIONS: SelectOption[] = [
  { value: 'atendente', label: 'Atendente' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'admin', label: 'Admin' },
  { value: 'ajudante', label: 'Ajudante' },
];

export interface UsuarioFormProps {
  onSuccess: (usuario: Usuario) => void;
  onCancel: () => void;
}

interface FormErrors {
  nome?: string;
  email?: string;
  senha?: string;
  papel?: string;
}

/**
 * Creation form for a Usuario. Only the "create" flow is implemented:
 * `senha` is required here because there is no edit mode yet (an edit form
 * would omit it).
 */
export function UsuarioForm({ onSuccess, onCancel }: UsuarioFormProps) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [papel, setPapel] = useState<PapelUsuario>('atendente');
  const [telefone, setTelefone] = useState('');
  const [valorHora, setValorHora] = useState('');
  const [comissaoAtiva, setComissaoAtiva] = useState(false);
  const [comissaoPct, setComissaoPct] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): boolean {
    const nextErrors: FormErrors = {};

    if (!nome.trim()) {
      nextErrors.nome = 'Nome é obrigatório.';
    }
    if (!email.trim()) {
      nextErrors.email = 'Email é obrigatório.';
    }
    if (!senha.trim()) {
      nextErrors.senha = 'Senha é obrigatória.';
    }
    if (!papel) {
      nextErrors.papel = 'Papel é obrigatório.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const usuario = await httpClient.post<Usuario>('/usuarios', {
        nome: nome.trim(),
        email: email.trim(),
        senha,
        papel,
        ativo: true,
        telefone: telefone.trim() || undefined,
        valorHora: valorHora.trim() ? Number(valorHora) : undefined,
      });

      if (PAPEIS_COM_COMISSAO.includes(papel) && comissaoAtiva) {
        await httpClient.patch(`/usuarios/${usuario.id}/comissao`, {
          comissao_ativa: comissaoAtiva,
          comissao_pct: comissaoPct.trim() ? Number(comissaoPct) : 0,
        });
      }

      onSuccess(usuario);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Não foi possível criar o usuário.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="usuario-form" onSubmit={handleSubmit}>
      <FormField label="Nome" htmlFor="usuario-nome" error={errors.nome} required>
        <input
          id="usuario-nome"
          type="text"
          className="usuario-form-input"
          value={nome}
          onChange={(event) => setNome(event.target.value)}
        />
      </FormField>

      <FormField label="Email" htmlFor="usuario-email" error={errors.email} required>
        <input
          id="usuario-email"
          type="email"
          className="usuario-form-input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </FormField>

      <FormField label="Senha" htmlFor="usuario-senha" error={errors.senha} required>
        <input
          id="usuario-senha"
          type="password"
          className="usuario-form-input"
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
          autoComplete="new-password"
        />
      </FormField>

      <FormField label="Papel" htmlFor="usuario-papel" error={errors.papel} required>
        <Select id="usuario-papel" value={papel} onChange={(value) => setPapel(value as PapelUsuario)} options={PAPEL_OPTIONS} />
      </FormField>

      <FormField label="Telefone (WhatsApp)" htmlFor="usuario-telefone">
        <input
          id="usuario-telefone"
          type="text"
          className="usuario-form-input"
          value={telefone}
          onChange={(event) => setTelefone(event.target.value)}
          placeholder="+5511999998888"
        />
      </FormField>

      <FormField label="Valor da Hora (R$)" htmlFor="usuario-valor-hora">
        <input
          id="usuario-valor-hora"
          type="number"
          min="0"
          step="0.01"
          className="usuario-form-input"
          value={valorHora}
          onChange={(event) => setValorHora(event.target.value)}
          placeholder="Ex.: 50.00"
        />
      </FormField>

      {PAPEIS_COM_COMISSAO.includes(papel) && (
        <>
          <FormField label="Recebe comissão" htmlFor="usuario-comissao-ativa">
            <label className="usuario-form-checkbox-label">
              <input
                id="usuario-comissao-ativa"
                type="checkbox"
                checked={comissaoAtiva}
                onChange={(event) => setComissaoAtiva(event.target.checked)}
              />
              Ativo
            </label>
          </FormField>

          {comissaoAtiva && (
            <FormField label="Percentual de comissão (%)" htmlFor="usuario-comissao-pct">
              <input
                id="usuario-comissao-pct"
                type="number"
                min="0"
                max="100"
                step="0.01"
                className="usuario-form-input"
                value={comissaoPct}
                onChange={(event) => setComissaoPct(event.target.value)}
                placeholder="Ex.: 10"
              />
            </FormField>
          )}
        </>
      )}

      {submitError && <span className="usuario-form-error">{submitError}</span>}

      <div className="usuario-form-actions">
        <button type="button" className="usuario-form-cancel" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </button>
        <button type="submit" className="usuario-form-submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}

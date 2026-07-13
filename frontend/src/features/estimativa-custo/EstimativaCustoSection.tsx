import { useEffect, useState } from 'react';
import { ApiError } from '../../lib/api/httpClient';
import type { EstimativaCustoOS, EstimativaCustoOSRequest, TurnoEstimativaCusto } from '../../types/api';
import { useAuth } from '../auth/useAuth';
import { FormField } from '../../components/ui/FormField';
import { Select } from '../../components/ui/Select';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { useEstimativaCustoQuery, useSalvarEstimativaCustoMutation } from './useEstimativaCustoQuery';
import { calcularCustoTotalCliente, toNumber } from './calcularCustoTotal';
import './EstimativaCustoSection.css';

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const TURNO_OPTIONS = [
  { value: 'diurno', label: 'Diurno' },
  { value: 'noturno', label: 'Noturno' },
];

interface FormState {
  horasEstimadasTecnico: string;
  horasEstimadasAjudante: string;
  custoCombustivel: string;
  custoPedagio: string;
  custoDesgasteVeiculo: string;
  custoAlmoco: string;
  custoJanta: string;
  custoEstadia: string;
  turno: TurnoEstimativaCusto;
  custoAdicionalNoturno: string;
  outrosCustos: string;
}

const EMPTY_FORM: FormState = {
  horasEstimadasTecnico: '',
  horasEstimadasAjudante: '',
  custoCombustivel: '',
  custoPedagio: '',
  custoDesgasteVeiculo: '',
  custoAlmoco: '',
  custoJanta: '',
  custoEstadia: '',
  turno: 'diurno',
  custoAdicionalNoturno: '',
  outrosCustos: '',
};

function formStateFromEstimativa(estimativa: EstimativaCustoOS): FormState {
  return {
    horasEstimadasTecnico: String(estimativa.horas_estimadas_tecnico),
    horasEstimadasAjudante:
      estimativa.horas_estimadas_ajudante != null ? String(estimativa.horas_estimadas_ajudante) : '',
    custoCombustivel: String(estimativa.custo_combustivel),
    custoPedagio: String(estimativa.custo_pedagio),
    custoDesgasteVeiculo: String(estimativa.custo_desgaste_veiculo),
    custoAlmoco: String(estimativa.custo_almoco),
    custoJanta: String(estimativa.custo_janta),
    custoEstadia: String(estimativa.custo_estadia),
    turno: estimativa.turno,
    custoAdicionalNoturno: String(estimativa.custo_adicional_noturno),
    outrosCustos: String(estimativa.outros_custos),
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  return 'Ocorreu um erro inesperado. Tente novamente.';
}

export interface EstimativaCustoSectionProps {
  ordemServicoId: string;
}

/** Admin-only section to view/edit the cost estimate of an OS, with a live client-side total. */
export function EstimativaCustoSection({ ordemServicoId }: EstimativaCustoSectionProps) {
  const { papel } = useAuth();
  const estimativaQuery = useEstimativaCustoQuery(ordemServicoId);
  const salvarMutation = useSalvarEstimativaCustoMutation(ordemServicoId);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (estimativaQuery.data) {
      setForm(formStateFromEstimativa(estimativaQuery.data));
    }
  }, [estimativaQuery.data]);

  if (papel !== 'admin') {
    return null;
  }

  if (estimativaQuery.isLoading) {
    return (
      <section className="estimativa-custo-card">
        <h2 className="estimativa-custo-title">Estimativa de custo</h2>
        <LoadingState message="Carregando estimativa de custo..." />
      </section>
    );
  }

  if (estimativaQuery.isError) {
    return (
      <section className="estimativa-custo-card">
        <h2 className="estimativa-custo-title">Estimativa de custo</h2>
        <ErrorState message={errorMessage(estimativaQuery.error)} onRetry={() => estimativaQuery.refetch()} />
      </section>
    );
  }

  const estimativaSalva = estimativaQuery.data ?? null;
  const valorHoraTecnico = estimativaSalva?.valor_hora_tecnico ?? 0;
  const valorHoraAjudante = estimativaSalva?.valor_hora_ajudante ?? 0;
  const custoTotalCliente = calcularCustoTotalCliente(form, valorHoraTecnico, valorHoraAjudante);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSalvar() {
    setValidationError(null);

    if (!form.horasEstimadasTecnico || toNumber(form.horasEstimadasTecnico) < 0) {
      setValidationError('Informe as horas estimadas do técnico.');
      return;
    }

    const body: EstimativaCustoOSRequest = {
      horas_estimadas_tecnico: toNumber(form.horasEstimadasTecnico),
      horas_estimadas_ajudante: form.horasEstimadasAjudante ? toNumber(form.horasEstimadasAjudante) : undefined,
      custo_combustivel: toNumber(form.custoCombustivel),
      custo_pedagio: toNumber(form.custoPedagio),
      custo_desgaste_veiculo: toNumber(form.custoDesgasteVeiculo),
      custo_almoco: toNumber(form.custoAlmoco),
      custo_janta: toNumber(form.custoJanta),
      custo_estadia: toNumber(form.custoEstadia),
      turno: form.turno,
      custo_adicional_noturno: toNumber(form.custoAdicionalNoturno),
      outros_custos: toNumber(form.outrosCustos),
    };

    salvarMutation.mutate(body);
  }

  return (
    <section className="estimativa-custo-card">
      <h2 className="estimativa-custo-title">Estimativa de custo</h2>

      <div className="estimativa-custo-grid">
        <FormField label="Horas estimadas (técnico)" htmlFor="estimativa-horas-tecnico" required>
          <input
            id="estimativa-horas-tecnico"
            type="number"
            min="0"
            step="0.5"
            value={form.horasEstimadasTecnico}
            onChange={(event) => updateField('horasEstimadasTecnico', event.target.value)}
          />
        </FormField>

        <FormField label="Horas estimadas (ajudante)" htmlFor="estimativa-horas-ajudante">
          <input
            id="estimativa-horas-ajudante"
            type="number"
            min="0"
            step="0.5"
            value={form.horasEstimadasAjudante}
            onChange={(event) => updateField('horasEstimadasAjudante', event.target.value)}
          />
        </FormField>

        <FormField label="Combustível (R$)" htmlFor="estimativa-combustivel">
          <input
            id="estimativa-combustivel"
            type="number"
            min="0"
            step="0.01"
            value={form.custoCombustivel}
            onChange={(event) => updateField('custoCombustivel', event.target.value)}
          />
        </FormField>

        <FormField label="Pedágio (R$)" htmlFor="estimativa-pedagio">
          <input
            id="estimativa-pedagio"
            type="number"
            min="0"
            step="0.01"
            value={form.custoPedagio}
            onChange={(event) => updateField('custoPedagio', event.target.value)}
          />
        </FormField>

        <FormField label="Desgaste do veículo (R$)" htmlFor="estimativa-desgaste-veiculo">
          <input
            id="estimativa-desgaste-veiculo"
            type="number"
            min="0"
            step="0.01"
            value={form.custoDesgasteVeiculo}
            onChange={(event) => updateField('custoDesgasteVeiculo', event.target.value)}
          />
        </FormField>

        <FormField label="Almoço (R$)" htmlFor="estimativa-almoco">
          <input
            id="estimativa-almoco"
            type="number"
            min="0"
            step="0.01"
            value={form.custoAlmoco}
            onChange={(event) => updateField('custoAlmoco', event.target.value)}
          />
        </FormField>

        <FormField label="Janta (R$)" htmlFor="estimativa-janta">
          <input
            id="estimativa-janta"
            type="number"
            min="0"
            step="0.01"
            value={form.custoJanta}
            onChange={(event) => updateField('custoJanta', event.target.value)}
          />
        </FormField>

        <FormField label="Estadia (R$)" htmlFor="estimativa-estadia">
          <input
            id="estimativa-estadia"
            type="number"
            min="0"
            step="0.01"
            value={form.custoEstadia}
            onChange={(event) => updateField('custoEstadia', event.target.value)}
          />
        </FormField>

        <FormField label="Turno" htmlFor="estimativa-turno">
          <Select
            id="estimativa-turno"
            options={TURNO_OPTIONS}
            value={form.turno}
            onChange={(value) => updateField('turno', value as TurnoEstimativaCusto)}
          />
        </FormField>

        <FormField label="Adicional noturno (R$)" htmlFor="estimativa-adicional-noturno">
          <input
            id="estimativa-adicional-noturno"
            type="number"
            min="0"
            step="0.01"
            value={form.custoAdicionalNoturno}
            onChange={(event) => updateField('custoAdicionalNoturno', event.target.value)}
          />
        </FormField>

        <FormField label="Outros custos (R$)" htmlFor="estimativa-outros-custos">
          <input
            id="estimativa-outros-custos"
            type="number"
            min="0"
            step="0.01"
            value={form.outrosCustos}
            onChange={(event) => updateField('outrosCustos', event.target.value)}
          />
        </FormField>
      </div>

      <div className="estimativa-custo-total">
        <span className="estimativa-custo-total-label">Custo total (prévia)</span>
        <span className="estimativa-custo-total-valor">{currencyFormatter.format(custoTotalCliente)}</span>
      </div>

      {estimativaSalva && (
        <p className="estimativa-custo-salvo">
          Última estimativa salva: {currencyFormatter.format(estimativaSalva.custo_total)}
        </p>
      )}

      {(validationError || salvarMutation.isError) && (
        <p className="estimativa-custo-error">
          {validationError ?? errorMessage(salvarMutation.error)}
        </p>
      )}

      <button
        type="button"
        className="estimativa-custo-button"
        onClick={handleSalvar}
        disabled={salvarMutation.isPending}
      >
        {salvarMutation.isPending ? 'Salvando...' : 'Salvar estimativa'}
      </button>
    </section>
  );
}

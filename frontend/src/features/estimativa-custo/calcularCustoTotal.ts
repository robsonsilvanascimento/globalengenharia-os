import type { TurnoEstimativaCusto } from '../../types/api';

/** Subset of the form fields needed to compute the client-side cost preview. */
export interface CustoTotalInput {
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

/** Parses a form-field string (accepting comma as decimal separator) into a finite number, defaulting to 0. */
export function toNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Replicates the backend formula for `custo_total`, for instant client-side feedback. */
export function calcularCustoTotalCliente(
  form: CustoTotalInput,
  valorHoraTecnico: number,
  valorHoraAjudante: number,
): number {
  const horasTecnico = toNumber(form.horasEstimadasTecnico);
  const horasAjudante = toNumber(form.horasEstimadasAjudante);

  return (
    horasTecnico * valorHoraTecnico +
    horasAjudante * valorHoraAjudante +
    toNumber(form.custoCombustivel) +
    toNumber(form.custoPedagio) +
    toNumber(form.custoDesgasteVeiculo) +
    toNumber(form.custoAlmoco) +
    toNumber(form.custoJanta) +
    toNumber(form.custoEstadia) +
    toNumber(form.outrosCustos) +
    (form.turno === 'noturno' ? toNumber(form.custoAdicionalNoturno) : 0)
  );
}

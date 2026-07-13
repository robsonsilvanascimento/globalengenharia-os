/**
 * Entidade de dominio pura da Estimativa de Custo de uma Ordem de Servico.
 * Nao depende do Prisma nem de qualquer detalhe de infraestrutura.
 *
 * Os valores de valor/hora sao snapshots tirados no momento do calculo e nao
 * acompanham alteracoes posteriores no cadastro do Usuario.
 */
export interface EstimativaCustoOS {
  id: string;
  ordemServicoId: string;
  horasEstimadasTecnico: number;
  valorHoraTecnico: number;
  horasEstimadasAjudante?: number;
  valorHoraAjudante?: number;
  custoCombustivel: number;
  custoPedagio: number;
  custoDesgasteVeiculo: number;
  custoAlmoco: number;
  custoJanta: number;
  custoEstadia: number;
  turno: 'diurno' | 'noturno';
  custoAdicionalNoturno: number;
  outrosCustos: number;
  custoTotal: number;
  criadoPorUsuarioId: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

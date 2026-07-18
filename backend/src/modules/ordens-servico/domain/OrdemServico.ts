/**
 * Entidade de dominio pura da Ordem de Servico.
 * Nao depende do Prisma nem de qualquer detalhe de infraestrutura.
 */

export type PrioridadeOS = 'baixa' | 'normal' | 'alta' | 'urgente';

export type StatusOS =
  | 'aberta'
  | 'triagem'
  | 'atribuida'
  | 'em_andamento'
  | 'aguardando_peca'
  | 'concluida'
  | 'cancelada';

export type OrigemCriacaoOS = 'whatsapp' | 'painel';

/**
 * Tipo do chamado. Em `emergencia` o orcamento aprovado e obrigatorio antes
 * de iniciar a execucao; em `servico` o atendente decide se envia orcamento.
 */
export type TipoChamado = 'emergencia' | 'servico';

export interface OrdemServico {
  id: string;
  numero: string;
  clienteId: string;
  categoriaServicoId: string;
  descricaoProblema: string;
  enderecoAtendimento?: string;
  prioridade: PrioridadeOS;
  status: StatusOS;
  tipoChamado: TipoChamado;
  tecnicoId?: string;
  ajudanteId?: string;
  criadoPorUsuarioId?: string;
  criadoVia: OrigemCriacaoOS;
  dataAgendada?: Date;
  criadoEm: Date;
  atualizadoEm: Date;
  fechadoEm?: Date;
  valorCobrado?: number;
  isPendente?: boolean;
  slaVencido?: boolean;
}

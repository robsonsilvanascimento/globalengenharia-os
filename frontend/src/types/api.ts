export type PapelUsuario = 'atendente' | 'tecnico' | 'admin' | 'ajudante';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  ativo: boolean;
  telefone?: string;
  valorHora?: number | null;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone_whatsapp: string;
  email?: string;
  documento?: string;
  criado_em: string;
}

/** Same shape as `Cliente`, returned by `GET /clientes/{id}`. */
export type ClienteDetalhe = Cliente;

export type AreaCategoriaServico = 'eletrica' | 'automacao' | 'energia_solar' | 'outro';

export interface CategoriaServico {
  id: string;
  nome: string;
  area: AreaCategoriaServico;
  ativo: boolean;
}

export interface FaqEntry {
  id: string;
  pergunta: string;
  resposta: string;
  tags?: string;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export type StatusOrdemServico =
  | 'aberta'
  | 'triagem'
  | 'atribuida'
  | 'em_andamento'
  | 'aguardando_peca'
  | 'concluida'
  | 'cancelada';

export type PrioridadeOrdemServico = 'baixa' | 'normal' | 'alta' | 'urgente';

export interface OrdemServico {
  id: string;
  numero: string;
  cliente_id: string;
  cliente_nome: string;
  categoria_servico_id: string;
  descricao_problema: string;
  endereco_atendimento?: string;
  status: StatusOrdemServico;
  prioridade: PrioridadeOrdemServico;
  tecnico_id?: string;
  tecnico_nome?: string;
  ajudante_id?: string | null;
  valor_cobrado?: number | null;
  data_agendada?: string | null;
  criado_em: string;
  atualizado_em: string;
  sla_vencido?: boolean;
}

/** Item retornado por `GET /ordens-servico/{id}/disponibilidade`. */
export interface DisponibilidadeOrdemServico {
  tecnicos_disponiveis: Array<{ id: string; nome: string }>;
  ajudantes_disponiveis: Array<{ id: string; nome: string }>;
  sem_data_agendada?: boolean;
}

export interface ClienteResumoOrdemServico {
  id: string;
  numero: string;
  categoria_nome: string;
  descricao_problema: string;
  status: StatusOrdemServico;
  prioridade: PrioridadeOrdemServico;
  valor_cobrado: number | null;
  criado_em: string;
}

/** Response of `GET /clientes/{id}/resumo`. */
export interface ClienteResumo {
  total_ordens_servico: number;
  total_valor_cobrado: number;
  ordens_servico: ClienteResumoOrdemServico[];
}

export interface HistoricoStatusOS {
  id: string;
  ordem_servico_id: string;
  status_anterior: StatusOrdemServico;
  status_novo: StatusOrdemServico;
  alterado_por_usuario_id?: string;
  alterado_por_bot: boolean;
  observacao?: string;
  criado_em: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface AuthLoginRequest {
  email: string;
  senha: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthLoginResponse extends AuthTokens {
  usuario: Usuario;
}

export interface AuthRefreshRequest {
  refreshToken: string;
}

export type AuthRefreshResponse = AuthTokens;

export type TipoMidiaOrdemServico = 'video';

/** Item retornado por `GET /ordens-servico/{id}/midias`. Acesso restrito a `admin` e `tecnico`. */
export interface MidiaOrdemServico {
  id: string;
  tipo: TipoMidiaOrdemServico;
  mime_type: string;
  tamanho_bytes: number;
  criado_em: string;
}

export type TurnoEstimativaCusto = 'diurno' | 'noturno';

/**
 * Estimativa de custo de uma ordem de serviço. Retornada por
 * `GET /ordens-servico/{id}/estimativa-custo` (ou `null` se ainda não calculada)
 * e por `PUT /ordens-servico/{id}/estimativa-custo`. Acesso restrito a `admin`.
 */
export interface EstimativaCustoOS {
  id: string;
  ordem_servico_id: string;
  horas_estimadas_tecnico: number;
  valor_hora_tecnico: number;
  horas_estimadas_ajudante?: number;
  valor_hora_ajudante?: number;
  custo_combustivel: number;
  custo_pedagio: number;
  custo_desgaste_veiculo: number;
  custo_almoco: number;
  custo_janta: number;
  custo_estadia: number;
  turno: TurnoEstimativaCusto;
  custo_adicional_noturno: number;
  outros_custos: number;
  custo_total: number;
  criado_em: string;
  atualizado_em: string;
}

/** Body de `PUT /ordens-servico/{id}/estimativa-custo`. */
export interface EstimativaCustoOSRequest {
  horas_estimadas_tecnico: number;
  horas_estimadas_ajudante?: number;
  custo_combustivel?: number;
  custo_pedagio?: number;
  custo_desgaste_veiculo?: number;
  custo_almoco?: number;
  custo_janta?: number;
  custo_estadia?: number;
  turno?: TurnoEstimativaCusto;
  custo_adicional_noturno?: number;
  outros_custos?: number;
}

// ---- Rastreabilidade --------------------------------------------------------

export type TipoDocumentoOS =
  | 'certificado_garantia'
  | 'manual'
  | 'laudo_tecnico'
  | 'nota_fiscal'
  | 'foto'
  | 'outro';

export interface DocumentoOS {
  id: string;
  ordem_servico_id: string;
  componente_instalado_id?: string | null;
  nome: string;
  tipo_documento: TipoDocumentoOS;
  mime_type: string;
  tamanho_bytes: number;
  ativo: boolean;
  carregado_por_usuario_id?: string | null;
  criado_em: string;
}

export interface ComponenteInstalado {
  id: string;
  ordem_servico_id: string;
  nome: string;
  fabricante?: string | null;
  modelo?: string | null;
  numero_serie?: string | null;
  codigo_barras?: string | null;
  garantia_meses?: number | null;
  garantia_expira_em?: string | null;
  observacoes?: string | null;
  criado_em: string;
  documentos: DocumentoOS[];
}

export interface RastreabilidadeOS {
  componentes: ComponenteInstalado[];
  documentos_sem_componente: DocumentoOS[];
}

export type StatusSolicitacaoAtendimento = 'pendente' | 'respondida';

export interface SolicitacaoAtendimento {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  mensagem_cliente: string;
  status: StatusSolicitacaoAtendimento;
  resposta_texto?: string;
  criado_em: string;
  respondido_em?: string;
}

// ---- Pendências com Fotos ---------------------------------------------------

export interface FotoPendencia {
  id: string;
  pendencia_id: string;
  mime_type: string;
  base64: string;
  criado_em: string;
}

export interface PendenciaOS {
  id: string;
  ordem_servico_id: string;
  observacao: string;
  criado_por_id?: string | null;
  criado_por_nome?: string | null;
  criado_em: string;
  fotos: FotoPendencia[];
}

// ---- Checklist de Serviço ---------------------------------------------------

export interface ItemChecklist {
  id: string;
  template_id: string;
  descricao: string;
  ordem: number;
}

export interface TemplateChecklist {
  id: string;
  categoria_servico_id: string;
  titulo: string;
  itens: ItemChecklist[];
}

export interface RespostaChecklist {
  item_id: string;
  marcado: boolean;
}

export interface ChecklistOS {
  template: TemplateChecklist | null;
  respostas: RespostaChecklist[];
}

// ---- Histórico de OS por Cliente -------------------------------------------

export interface HistoricoOSItem {
  id: string;
  numero: string;
  status: StatusOrdemServico;
  prioridade: PrioridadeOrdemServico;
  descricao_problema: string;
  categoria_nome: string;
  tecnico_nome?: string | null;
  valor_cobrado?: number | null;
  criado_em: string;
  fechado_em?: string | null;
}

export interface HistoricoOSClienteResponse {
  items: HistoricoOSItem[];
}

// ---- Fotos de Evidência do Serviço -----------------------------------------

export interface FotoEvidencia {
  id: string;
  ordem_servico_id: string;
  mime_type: string;
  base64: string;
  legenda?: string | null;
  enviado_por_nome?: string | null;
  criado_em: string;
}

export interface FotosEvidenciaResponse {
  fotos: FotoEvidencia[];
}

export type StatusPagamento = 'pendente' | 'pago' | 'cancelado';
export type TipoPagamento = 'pix_automatico' | 'manual';

export interface PagamentoOS {
  id: string;
  ordem_servico_id: string;
  tipo: TipoPagamento;
  valor: number;
  status_pagamento: StatusPagamento;
  pix_qr_code?: string | null;
  pix_copia_e_cola?: string | null;
  mercado_pago_id?: string | null;
  observacao?: string | null;
  pago_em?: string | null;
  criado_em: string;
}

export interface FluxoMensal {
  mes: string;
  receita: number;
  quantidade: number;
}

export interface ResumoFinanceiro {
  receita_total: number;
  receita_paga: number;
  receita_pendente: number;
  total_os_pagas: number;
  total_os_pendentes: number;
  total_inadimplentes: number;
  fluxo_mensal: FluxoMensal[];
}

export interface OSInadimplente {
  id: string;
  numero: string;
  cliente_nome: string;
  valor_cobrado: number;
  dias_em_atraso: number;
  tecnico_nome?: string | null;
}

export interface RankingTecnico {
  tecnico_id: string;
  tecnico_nome: string;
  total_gerado: number;
  total_os: number;
  comissao_total: number;
}

export interface ComissaoTecnico {
  id: string;
  tecnico_nome: string;
  os_numero: string;
  valor_pago: number;
  percentual: number;
  valor_comissao: number;
  criado_em: string;
}

export interface PortalOS {
  id: string;
  numero: string;
  status: StatusOrdemServico;
  prioridade: PrioridadeOrdemServico;
  descricao_problema: string;
  criado_em: string;
  valor_cobrado?: number | null;
}

export interface PortalOSDetalhe extends PortalOS {
  historico_status: HistoricoStatusOS[];
  fotos_servico: FotoEvidencia[];
}

export interface FotoBase64Upload {
  mime_type: string;
  base64: string;
  legenda?: string;
}

export interface RespostaNPS {
  nota: number;
  comentario?: string | null;
  criado_em: string;
  ordem_servico_numero: string;
  cliente_nome: string;
}

export interface ResultadosNPS {
  total: number;
  promotores: number;
  neutros: number;
  detratores: number;
  score_nps: number;
  respostas: RespostaNPS[];
}

export type TipoMovimentacao = 'entrada' | 'saida';

export interface Peca {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  unidade: string;
  preco_unitario: number;
  estoque_atual: number;
  estoque_minimo: number;
  ativo: boolean;
  criado_em: string;
}

export interface MovimentacaoEstoque {
  id: string;
  peca_id: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  preco_unitario: number;
  ordem_servico_id?: string | null;
  observacao?: string | null;
  criado_em: string;
}

export interface ConsumoOSPeca {
  id: string;
  peca_id: string;
  ordem_servico_id: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  criado_em: string;
  peca?: { nome: string; codigo: string; unidade: string };
}

export interface ConsumoOSPecaResponse {
  consumos: ConsumoOSPeca[];
  custo_total: number;
}

export interface ManutencaoPreventiva {
  id: string;
  componente_instalado_id: string;
  intervalo_dias: number;
  ultima_realizada_em?: string | null;
  proxima_em: string;
  notificado_em?: string | null;
  criado_em: string;
}

export interface ManutencaoPreventivaComDetalhe extends ManutencaoPreventiva {
  componente_instalado?: {
    nome: string;
    ordem_servico?: { numero: string; cliente?: { nome: string } } | null;
  } | null;
}

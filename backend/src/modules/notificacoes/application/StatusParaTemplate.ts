/**
 * Mapa de `statusNovo` (StatusOS da OS) para o nome do template aprovado na
 * Meta WhatsApp Cloud API usado para notificar o cliente sobre a mudanca.
 *
 * Status que nao aparecem aqui (ex.: `aberta`, `triagem`) nao geram
 * notificacao ao cliente.
 */
export const STATUS_PARA_TEMPLATE: Record<string, string> = {
  atribuida: 'status_atribuida',
  em_andamento: 'status_em_andamento',
  aguardando_peca: 'status_aguardando_peca',
  concluida: 'status_concluida',
  cancelada: 'status_cancelada',
};

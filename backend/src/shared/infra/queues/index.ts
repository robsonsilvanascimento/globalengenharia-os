import { Queue, type JobsOptions } from 'bullmq';
import { redisConnection } from '../RedisConnection';

export const QUEUE_NAMES = {
  WHATSAPP_CONVERSA: 'whatsapp-conversa',
  NOTIFICACOES_WHATSAPP: 'notificacoes-whatsapp',
  ENTREGA_PDF_OS: 'entrega-pdf-os',
  NOTIFICACAO_TECNICO: 'notificacao-tecnico',
  CALCULAR_COMISSAO: 'calcular-comissao',
  PIX_WHATSAPP: 'pix-whatsapp',
} as const;

export interface WhatsappConversaJobData {
  telefoneCliente: string;
  waMessageId: string;
  recebidoEm: string;
  /**
   * Tipo e conteudo textual da mensagem recebida. Opcionais por
   * retrocompatibilidade com quem enfileira apenas os 3 campos acima — ver
   * observacao no worker (`whatsapp/infrastructure/queues/whatsapp-conversa-worker.ts`)
   * sobre a necessidade de `enfileirar-mensagem.ts` passar estes campos para
   * que o processamento do fluxo guiado funcione de ponta a ponta.
   */
  tipo?: string;
  conteudo?: string;
}

export interface NotificacaoWhatsappJobData {
  ordemServicoId: string;
  clienteId: string;
  statusNovo: string;
  templateNome: string;
}

export interface EntregaPdfOSJobData {
  ordemServicoId: string;
}

export interface NotificacaoTecnicoJobData {
  ordemServicoId: string;
  tecnicoId: string;
  /** Presente quando um ajudante tambem foi atribuido junto com o tecnico. */
  ajudanteId?: string;
}

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

/**
 * Fila responsavel por processar mensagens recebidas do webhook do WhatsApp.
 *
 * Concorrencia por conversa: o jobId e derivado do telefone do cliente
 * (ver `buildConversaJobId`). Como o BullMQ nao enfileira novamente um job
 * cujo id ja existe em espera/ativo, mensagens que chegam em rajada para o
 * mesmo telefone sao deduplicadas em um unico job pendente, garantindo que
 * no maximo 1 job por conversa esteja em processamento por vez.
 *
 * IMPORTANTE para quem implementar o worker: por causa dessa deduplicacao,
 * o processor NAO deve confiar apenas em `job.data` como a mensagem a ser
 * tratada — ele deve reler o estado/mensagens pendentes da conversa a partir
 * da fonte de verdade (banco/buffer da conversa) no momento do processamento,
 * para nao perder mensagens que chegaram enquanto um job anterior do mesmo
 * telefone ainda estava na fila.
 */
export const whatsappConversaQueue = new Queue<WhatsappConversaJobData>(
  QUEUE_NAMES.WHATSAPP_CONVERSA,
  {
    connection: redisConnection,
    defaultJobOptions,
  },
);

/**
 * Fila responsavel por enviar notificacoes de mudanca de status de OS
 * para o cliente via WhatsApp.
 */
export const notificacoesWhatsappQueue = new Queue<NotificacaoWhatsappJobData>(
  QUEUE_NAMES.NOTIFICACOES_WHATSAPP,
  {
    connection: redisConnection,
    defaultJobOptions,
  },
);

/**
 * Fila responsavel por gerar o PDF da Ordem de Servico e entrega-lo ao
 * cliente (WhatsApp e, quando disponivel, e-mail) apos a criacao da OS.
 */
export const entregaPdfOSQueue = new Queue<EntregaPdfOSJobData>(
  QUEUE_NAMES.ENTREGA_PDF_OS,
  {
    connection: redisConnection,
    defaultJobOptions,
  },
);

/**
 * Fila responsavel por notificar o tecnico via WhatsApp quando ele e
 * atribuido a uma Ordem de Servico.
 */
export const notificacaoTecnicoQueue = new Queue<NotificacaoTecnicoJobData>(
  QUEUE_NAMES.NOTIFICACAO_TECNICO,
  {
    connection: redisConnection,
    defaultJobOptions,
  },
);

/** Gera o jobId deterministico usado para deduplicar por conversa/telefone. */
export function buildConversaJobId(telefoneCliente: string): string {
  return `conversa:${telefoneCliente}`;
}

export async function enqueueWhatsappConversaJob(
  telefoneCliente: string,
  data: WhatsappConversaJobData,
): Promise<void> {
  await whatsappConversaQueue.add('processar-mensagem', data, {
    jobId: buildConversaJobId(telefoneCliente),
  });
}

export async function enqueueNotificacaoWhatsapp(
  data: NotificacaoWhatsappJobData,
): Promise<void> {
  await notificacoesWhatsappQueue.add('notificar-status', data);
}

export async function enqueueEntregaPdfOS(data: EntregaPdfOSJobData): Promise<void> {
  await entregaPdfOSQueue.add('entregar-pdf', data);
}

export async function enqueueNotificacaoTecnico(data: NotificacaoTecnicoJobData): Promise<void> {
  await notificacaoTecnicoQueue.add('notificar-tecnico', data);
}

export interface CalcularComissaoJobData {
  pagamentoOSId: string;
}

export const calcularComissaoQueue = new Queue<CalcularComissaoJobData>(
  QUEUE_NAMES.CALCULAR_COMISSAO,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  },
);

export async function enqueueCalcularComissao(data: CalcularComissaoJobData): Promise<void> {
  await calcularComissaoQueue.add('calcular-comissao', data);
}

export interface PixWhatsappJobData {
  ordemServicoId: string;
}

/**
 * Fila responsavel por gerar o Pix (Mercado Pago) de uma OS concluida e
 * enviar o codigo ao cliente via WhatsApp.
 */
export const pixWhatsappQueue = new Queue<PixWhatsappJobData>(
  QUEUE_NAMES.PIX_WHATSAPP,
  {
    connection: redisConnection,
    defaultJobOptions,
  },
);

export async function enqueuePixWhatsapp(data: PixWhatsappJobData): Promise<void> {
  await pixWhatsappQueue.add('gerar-pix-whatsapp', data);
}

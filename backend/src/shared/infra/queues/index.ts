import { Queue, type JobsOptions } from 'bullmq';
import { redisConnection } from '../RedisConnection';

export const QUEUE_NAMES = {
  WHATSAPP_CONVERSA: 'whatsapp-conversa',
  NOTIFICACOES_WHATSAPP: 'notificacoes-whatsapp',
  ENTREGA_PDF_OS: 'entrega-pdf-os',
  NOTIFICACAO_TECNICO: 'notificacao-tecnico',
  CALCULAR_COMISSAO: 'calcular-comissao',
  PIX_WHATSAPP: 'pix-whatsapp',
  ENTREGA_RECIBO: 'entrega-recibo',
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
 * (ver `buildConversaJobId`). Como o BullMQ nao enfileira novamente (nem
 * atualiza `data`) um job cujo id ja existe em espera/ativo, mensagens que
 * chegam em rajada para o mesmo telefone colapsariam em um unico job — se o
 * processor confiasse apenas em `job.data`, a segunda mensagem seria
 * silenciosamente perdida (o `add()` com jobId duplicado e um no-op).
 *
 * Por isso toda mensagem recebida e tambem empilhada num buffer no Redis por
 * telefone (`pushMensagemPendente`/`drainMensagensPendentes`) antes do
 * `add()`: o worker drena e processa TODAS as mensagens pendentes daquele
 * telefone a cada execucao, nao so a de `job.data`, entao nenhuma mensagem
 * chegada durante a deduplicacao fica sem tratamento.
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

function buildMensagensPendentesKey(telefoneCliente: string): string {
  return `whatsapp:pendentes:${telefoneCliente}`;
}

/** Tempo maximo que uma mensagem pode ficar bufferizada (rede de seguranca contra chave orfa). */
const TTL_BUFFER_MENSAGENS_SEGUNDOS = 3600;

async function pushMensagemPendente(
  telefoneCliente: string,
  data: WhatsappConversaJobData,
): Promise<void> {
  const key = buildMensagensPendentesKey(telefoneCliente);
  await redisConnection
    .multi()
    .rpush(key, JSON.stringify(data))
    .expire(key, TTL_BUFFER_MENSAGENS_SEGUNDOS)
    .exec();
}

/**
 * Le e limpa atomicamente (via MULTI/EXEC) o buffer de mensagens pendentes de
 * um telefone. Atomico porque o Redis executa os comandos de um MULTI como
 * uma unica unidade — nenhum `pushMensagemPendente` concorrente pode se
 * intercalar entre o LRANGE e o DEL.
 */
export async function drainMensagensPendentes(
  telefoneCliente: string,
): Promise<WhatsappConversaJobData[]> {
  const key = buildMensagensPendentesKey(telefoneCliente);
  const resultado = await redisConnection.multi().lrange(key, 0, -1).del(key).exec();
  const itens = (resultado?.[0]?.[1] as string[] | null) ?? [];
  return itens.map((item) => JSON.parse(item) as WhatsappConversaJobData);
}

export async function enqueueWhatsappConversaJob(
  telefoneCliente: string,
  data: WhatsappConversaJobData,
): Promise<void> {
  // Empilha antes de enfileirar o job: se o jobId ja existir (deduplicacao),
  // o `add()` abaixo e um no-op, mas a mensagem ja esta no buffer para o
  // worker drenar.
  await pushMensagemPendente(telefoneCliente, data);

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

export interface EntregaReciboJobData {
  pagamentoOSId: string;
}

/**
 * Fila responsavel por gerar o PDF do recibo de pagamento e entrega-lo ao
 * cliente via WhatsApp assim que um pagamento e confirmado (Pix automatico
 * ou manual).
 */
export const entregaReciboQueue = new Queue<EntregaReciboJobData>(
  QUEUE_NAMES.ENTREGA_RECIBO,
  {
    connection: redisConnection,
    defaultJobOptions,
  },
);

export async function enqueueEntregaRecibo(data: EntregaReciboJobData): Promise<void> {
  await entregaReciboQueue.add('entregar-recibo', data);
}

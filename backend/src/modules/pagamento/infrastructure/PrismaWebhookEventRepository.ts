import type { PrismaClient, WebhookEventoPagamento as WebhookEventoPrisma } from '@prisma/client';
import type {
  RegistrarWebhookEventoDados,
  StatusWebhookEvento,
  WebhookEventoRegistrado,
  WebhookEventRepository,
} from '../domain/WebhookEventRepository';

function paraEntidade(r: WebhookEventoPrisma): WebhookEventoRegistrado {
  return {
    id: r.id,
    provedor: r.provedor,
    tipoEvento: r.tipoEvento,
    idExterno: r.idExterno,
    status: r.status as StatusWebhookEvento,
    criadoEm: r.criadoEm,
  };
}

export class PrismaWebhookEventRepository implements WebhookEventRepository {
  constructor(private readonly client: PrismaClient) {}

  async registrar(dados: RegistrarWebhookEventoDados): Promise<WebhookEventoRegistrado> {
    const registro = await this.client.webhookEventoPagamento.create({
      data: {
        provedor: dados.provedor,
        tipoEvento: dados.tipoEvento,
        idExterno: dados.idExterno,
        payloadBruto: dados.payloadBruto,
      },
    });
    return paraEntidade(registro);
  }

  async buscarPorId(id: string): Promise<WebhookEventoRegistrado | null> {
    const registro = await this.client.webhookEventoPagamento.findUnique({ where: { id } });
    return registro ? paraEntidade(registro) : null;
  }

  async marcarProcessado(id: string): Promise<void> {
    await this.client.webhookEventoPagamento.update({
      where: { id },
      data: { status: 'processado', processadoEm: new Date() },
    });
  }

  async marcarFalhou(id: string, erro: string): Promise<void> {
    await this.client.webhookEventoPagamento.update({
      where: { id },
      data: { status: 'falhou', erro, processadoEm: new Date() },
    });
  }

  async marcarIgnorado(id: string, motivo: string): Promise<void> {
    await this.client.webhookEventoPagamento.update({
      where: { id },
      data: { status: 'ignorado', erro: motivo, processadoEm: new Date() },
    });
  }
}

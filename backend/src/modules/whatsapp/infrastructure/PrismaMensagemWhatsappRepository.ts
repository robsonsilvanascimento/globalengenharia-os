import type { MensagemWhatsapp as MensagemWhatsappPrisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../../shared/infra/PrismaClient';
import type { MensagemWhatsapp } from '../domain/MensagemWhatsapp';
import type { CriarMensagemWhatsappDados, MensagemWhatsappRepository } from '../domain/MensagemWhatsappRepository';

/** Converte o registro do Prisma (campos opcionais como `null`) para a entidade de dominio. */
function paraEntidade(registro: MensagemWhatsappPrisma): MensagemWhatsapp {
  return {
    id: registro.id,
    conversaId: registro.conversaId,
    direcao: registro.direcao,
    tipoConteudo: registro.tipoConteudo,
    conteudo: registro.conteudo,
    whatsappMessageId: registro.whatsappMessageId,
    statusEntrega: registro.statusEntrega ?? undefined,
    criadoEm: registro.criadoEm,
  };
}

/** Implementacao de MensagemWhatsappRepository sobre o Prisma Client. */
export class PrismaMensagemWhatsappRepository implements MensagemWhatsappRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async create(dados: CriarMensagemWhatsappDados): Promise<MensagemWhatsapp> {
    const registro = await this.client.mensagemWhatsapp.create({
      data: {
        conversaId: dados.conversaId,
        direcao: dados.direcao,
        tipoConteudo: dados.tipoConteudo,
        conteudo: dados.conteudo,
        whatsappMessageId: dados.whatsappMessageId,
        statusEntrega: dados.statusEntrega,
      },
    });
    return paraEntidade(registro);
  }
}

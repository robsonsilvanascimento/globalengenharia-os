import type { ConversaWhatsapp as ConversaWhatsappPrisma, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../../shared/infra/PrismaClient';
import type { ConversaWhatsapp } from '../domain/ConversaWhatsapp';
import type {
  AtualizarConversaWhatsappDados,
  ConversaWhatsappRepository,
  CriarConversaWhatsappDados,
} from '../domain/ConversaWhatsappRepository';
import type { ContextoConversaWhatsapp, EstadoFluxoConversa } from '../domain/FluxoConversa';

/** Converte o registro do Prisma (campos opcionais como `null`, `contextoDados` como JsonValue) para a entidade de dominio. */
function paraEntidade(registro: ConversaWhatsappPrisma): ConversaWhatsapp {
  return {
    id: registro.id,
    clienteId: registro.clienteId,
    telefoneWhatsapp: registro.telefoneWhatsapp,
    estadoFluxo: registro.estadoFluxo as EstadoFluxoConversa,
    contextoDados: (registro.contextoDados ?? {}) as ContextoConversaWhatsapp,
    ordemServicoId: registro.ordemServicoId ?? undefined,
    iniciadaEm: registro.iniciadaEm,
    atualizadaEm: registro.atualizadaEm,
  };
}

/** Implementacao de ConversaWhatsappRepository sobre o Prisma Client. */
export class PrismaConversaWhatsappRepository implements ConversaWhatsappRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async findByTelefone(telefone: string): Promise<ConversaWhatsapp | null> {
    const registro = await this.client.conversaWhatsapp.findFirst({
      where: { telefoneWhatsapp: telefone },
      orderBy: { iniciadaEm: 'desc' },
    });
    return registro ? paraEntidade(registro) : null;
  }

  async create(dados: CriarConversaWhatsappDados): Promise<ConversaWhatsapp> {
    const registro = await this.client.conversaWhatsapp.create({
      data: {
        clienteId: dados.clienteId,
        telefoneWhatsapp: dados.telefoneWhatsapp,
        estadoFluxo: dados.estadoFluxo,
        contextoDados: dados.contextoDados as Prisma.InputJsonValue,
      },
    });
    return paraEntidade(registro);
  }

  async update(id: string, dados: AtualizarConversaWhatsappDados): Promise<ConversaWhatsapp> {
    const registro = await this.client.conversaWhatsapp.update({
      where: { id },
      data: {
        estadoFluxo: dados.estadoFluxo,
        contextoDados: dados.contextoDados as Prisma.InputJsonValue | undefined,
        ordemServicoId: dados.ordemServicoId,
      },
    });
    return paraEntidade(registro);
  }
}

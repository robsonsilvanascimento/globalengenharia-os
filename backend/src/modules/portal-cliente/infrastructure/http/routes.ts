import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import type { ArmazenamentoArquivoService } from '../../../../shared/infra/storage/ArmazenamentoArquivoService';
import { UnauthorizedError, NotFoundError } from '../../../../shared/http/errors/AppError';

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

export interface PortalClienteRoutesDeps {
  prisma: PrismaClient;
  armazenamentoArquivoService: ArmazenamentoArquivoService;
}

async function resolverClienteDoToken(
  prisma: PrismaClient,
  token: string | undefined,
): Promise<string> {
  if (!token) {
    throw new UnauthorizedError('Token invalido ou expirado');
  }

  const registro = await prisma.tokenPortalCliente.findUnique({ where: { token } });

  if (!registro || registro.expiraEm <= new Date()) {
    throw new UnauthorizedError('Token invalido ou expirado');
  }

  return registro.clienteId;
}

export function registerPortalClienteRoutes(
  app: FastifyInstance,
  deps: PortalClienteRoutesDeps,
): void {
  const { prisma, armazenamentoArquivoService } = deps;

  app.get('/portal/os', async (request, reply) => {
    const token = request.headers['x-portal-token'] as string | undefined;
    const clienteId = await resolverClienteDoToken(prisma, token);

    const ordens = await prisma.ordemServico.findMany({
      where: { clienteId },
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        numero: true,
        status: true,
        prioridade: true,
        descricaoProblema: true,
        criadoEm: true,
        valorCobrado: true,
      },
    });

    return reply.status(200).send(
      ordens.map((os) => ({
        id: os.id,
        numero: os.numero,
        status: os.status,
        prioridade: os.prioridade,
        descricao_problema: os.descricaoProblema,
        criado_em: os.criadoEm,
        valor_cobrado: os.valorCobrado,
      })),
    );
  });

  app.get('/portal/os/:id', async (request, reply) => {
    const token = request.headers['x-portal-token'] as string | undefined;
    const clienteId = await resolverClienteDoToken(prisma, token);

    const { id } = idParamsSchema.parse(request.params);

    const os = await prisma.ordemServico.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        status: true,
        prioridade: true,
        descricaoProblema: true,
        criadoEm: true,
        valorCobrado: true,
        clienteId: true,
        historicoStatus: {
          orderBy: { criadoEm: 'asc' },
          select: {
            id: true,
            statusAnterior: true,
            statusNovo: true,
            observacao: true,
            criadoEm: true,
          },
        },
        fotosServico: {
          orderBy: { criadoEm: 'asc' },
          select: {
            id: true,
            mimeType: true,
            base64: true,
            legenda: true,
          },
        },
      },
    });

    if (!os) {
      throw new NotFoundError('Ordem de servico nao encontrada');
    }

    if (os.clienteId !== clienteId) {
      throw new NotFoundError('Ordem de servico nao encontrada');
    }

    return reply.status(200).send({
      id: os.id,
      numero: os.numero,
      status: os.status,
      prioridade: os.prioridade,
      descricao_problema: os.descricaoProblema,
      criado_em: os.criadoEm,
      valor_cobrado: os.valorCobrado,
      historico_status: os.historicoStatus.map((h) => ({
        id: h.id,
        status_anterior: h.statusAnterior,
        status_novo: h.statusNovo,
        observacao: h.observacao,
        criado_em: h.criadoEm,
      })),
      fotos_servico: os.fotosServico.map((f) => ({
        id: f.id,
        mime_type: f.mimeType,
        base64: f.base64,
        legenda: f.legenda,
      })),
    });
  });

  app.get('/portal/os/:id/pdf', async (request, reply) => {
    const token = request.headers['x-portal-token'] as string | undefined;
    const clienteId = await resolverClienteDoToken(prisma, token);

    const { id } = idParamsSchema.parse(request.params);

    const os = await prisma.ordemServico.findUnique({
      where: { id },
      select: { clienteId: true },
    });

    if (!os) {
      throw new NotFoundError('Ordem de servico nao encontrada');
    }

    if (os.clienteId !== clienteId) {
      throw new NotFoundError('Ordem de servico nao encontrada');
    }

    const doc = await prisma.documentoOS.findFirst({
      where: { ordemServicoId: id, tipoDocumento: 'laudo_tecnico', ativo: true },
    });

    if (!doc) {
      throw new NotFoundError('PDF nao disponivel para esta ordem de servico');
    }

    const conteudo = await armazenamentoArquivoService.lerArquivo(doc.caminhoArmazenamento);

    reply.header('Content-Disposition', `attachment; filename="os-${doc.ordemServicoId}.pdf"`);
    return reply.type('application/pdf').send(conteudo);
  });
}

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ListarMidiasOrdemServicoUseCase } from '../../application/ListarMidiasOrdemServicoUseCase';
import { ObterArquivoMidiaUseCase } from '../../application/ObterArquivoMidiaUseCase';
import { RemoverMidiaOrdemServicoUseCase } from '../../application/RemoverMidiaOrdemServicoUseCase';
import { MidiaNaoEncontradaError } from '../../domain/errors/MidiaNaoEncontradaError';
import type { MidiaOrdemServico } from '../../domain/MidiaOrdemServico';
import type { MidiaOrdemServicoRepository } from '../../domain/MidiaOrdemServicoRepository';
import type { ArmazenamentoArquivoService } from '../../../../shared/infra/storage/ArmazenamentoArquivoService';
import type { OrdemServicoRepository } from '../../../ordens-servico/domain/OrdemServicoRepository';
import { NotFoundError } from '../../../../shared/http/errors/AppError';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const midiaIdParamsSchema = z.object({
  id: z.string().uuid(),
  midiaId: z.string().uuid(),
});

export interface MidiasRoutesDeps {
  midiaOrdemServicoRepository: MidiaOrdemServicoRepository;
  armazenamentoArquivoService: ArmazenamentoArquivoService;
  ordemServicoRepository: OrdemServicoRepository;
}

/** Relanca erros de dominio conhecidos como AppError HTTP; demais erros seguem para o error-handler global. */
function relancarComoAppError(error: unknown): never {
  if (error instanceof MidiaNaoEncontradaError) {
    throw new NotFoundError(error.message);
  }
  throw error;
}

function montarMidiaResponse(midia: MidiaOrdemServico) {
  return {
    id: midia.id,
    ordem_servico_id: midia.ordemServicoId ?? null,
    cliente_id: midia.clienteId,
    tipo: midia.tipo,
    mime_type: midia.mimeType,
    tamanho_bytes: midia.tamanhoBytes,
    whatsapp_media_id: midia.whatsappMediaId ?? null,
    criado_em: midia.criadoEm,
  };
}

/** Registra as rotas do modulo de midias de ordens de servico. */
export function registerMidiasRoutes(app: FastifyInstance, deps: MidiasRoutesDeps): void {
  const { midiaOrdemServicoRepository, armazenamentoArquivoService, ordemServicoRepository } = deps;

  const adminOuTecnico = { preHandler: [authenticate, requireRole(['admin', 'tecnico'])] };
  const somenteAdmin = { preHandler: [authenticate, requireRole(['admin'])] };

  const listarMidiasUseCase = new ListarMidiasOrdemServicoUseCase({ midiaOrdemServicoRepository });
  const obterArquivoMidiaUseCase = new ObterArquivoMidiaUseCase({
    midiaOrdemServicoRepository,
    armazenamentoArquivoService,
  });
  const removerMidiaUseCase = new RemoverMidiaOrdemServicoUseCase({
    midiaOrdemServicoRepository,
    armazenamentoArquivoService,
  });

  /** Garante que a OS informada existe. Lanca NotFoundError (404) caso contrario. */
  async function garantirOrdemServicoExiste(ordemServicoId: string): Promise<void> {
    const ordemServico = await ordemServicoRepository.findById(ordemServicoId);
    if (!ordemServico) {
      throw new NotFoundError('Ordem de servico nao encontrada');
    }
  }

  app.get('/ordens-servico/:id/midias', adminOuTecnico, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    await garantirOrdemServicoExiste(id);

    const midias = await listarMidiasUseCase.execute(id);
    return reply.status(200).send(midias.map(montarMidiaResponse));
  });

  app.get('/ordens-servico/:id/midias/:midiaId/arquivo', adminOuTecnico, async (request, reply) => {
    const { id, midiaId } = midiaIdParamsSchema.parse(request.params);
    await garantirOrdemServicoExiste(id);

    try {
      const { midia, conteudo } = await obterArquivoMidiaUseCase.execute(midiaId);

      if (midia.ordemServicoId !== id) {
        throw new NotFoundError('Midia nao encontrada para esta ordem de servico');
      }

      // `attachment` (em vez de `inline`) + nosleep de conteudo: o mimeType vem
      // da Meta e nao e 100% confiavel; forcar download em vez de renderizacao
      // inline evita que um tipo inesperado seja interpretado pelo navegador
      // (defesa em profundidade contra content-sniffing/XSS armazenado).
      reply.header('Content-Disposition', `attachment; filename="${midia.id}"`);
      reply.header('X-Content-Type-Options', 'nosniff');
      return reply.type(midia.mimeType).send(conteudo);
    } catch (error) {
      relancarComoAppError(error);
    }
  });

  app.delete('/ordens-servico/:id/midias/:midiaId', somenteAdmin, async (request, reply) => {
    const { id, midiaId } = midiaIdParamsSchema.parse(request.params);
    await garantirOrdemServicoExiste(id);

    const midia = await midiaOrdemServicoRepository.findById(midiaId);
    if (!midia || midia.ordemServicoId !== id) {
      throw new NotFoundError('Midia nao encontrada para esta ordem de servico');
    }

    try {
      await removerMidiaUseCase.execute(midiaId);
    } catch (error) {
      relancarComoAppError(error);
    }

    return reply.status(204).send();
  });
}

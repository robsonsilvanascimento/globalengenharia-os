import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';
import type { OrdemServicoRepository } from '../../../ordens-servico/domain/OrdemServicoRepository';
import type { OrcamentoOSRepository } from '../../domain/OrcamentoOSRepository';
import { CriarOrcamentoUseCase } from '../../application/CriarOrcamentoUseCase';
import { ObterOrcamentoUseCase } from '../../application/ObterOrcamentoUseCase';

const osIdParams = z.object({ id: z.string().uuid() });

const criarOrcamentoBody = z.object({
  itens: z
    .array(
      z.object({
        descricao: z.string().min(1),
        valor: z.number().positive(),
      }),
    )
    .min(1),
  observacao: z.string().optional(),
});

export interface OrcamentoRoutesDeps {
  orcamentoRepository: OrcamentoOSRepository;
  ordemServicoRepository: OrdemServicoRepository;
}

export function registerOrcamentoRoutes(app: FastifyInstance, deps: OrcamentoRoutesDeps): void {
  const atendenteOuAdmin = { preHandler: [authenticate, requireRole(['atendente', 'admin'])] };

  const criarOrcamentoUseCase = new CriarOrcamentoUseCase(deps);
  const obterOrcamentoUseCase = new ObterOrcamentoUseCase({ orcamentoRepository: deps.orcamentoRepository });

  app.post('/ordens-servico/:id/orcamento', atendenteOuAdmin, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);
    const body = criarOrcamentoBody.parse(request.body);

    const orcamento = await criarOrcamentoUseCase.execute({
      ordemServicoId: id,
      itens: body.itens,
      observacao: body.observacao,
      criadoPorId: request.user!.id,
    });

    return reply.status(201).send(orcamento);
  });

  app.get('/ordens-servico/:id/orcamento', atendenteOuAdmin, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);
    const orcamento = await obterOrcamentoUseCase.execute(id);
    return reply.status(200).send(orcamento);
  });
}

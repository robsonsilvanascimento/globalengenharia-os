import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ChecklistRepository } from '../../domain/ChecklistRepository';
import type { OrdemServicoRepository } from '../../../ordens-servico/domain/OrdemServicoRepository';
import { CriarTemplateChecklistUseCase } from '../../application/CriarTemplateChecklistUseCase';
import { ListarTemplatesChecklistUseCase } from '../../application/ListarTemplatesChecklistUseCase';
import { ResponderChecklistUseCase } from '../../application/ResponderChecklistUseCase';
import { BuscarChecklistOSUseCase } from '../../application/BuscarChecklistOSUseCase';
import { NotFoundError } from '../../../../shared/http/errors/AppError';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';

const osIdParams = z.object({ id: z.string().uuid() });

const criarTemplateBody = z.object({
  categoria_servico_id: z.string().uuid(),
  titulo: z.string().min(1),
  itens: z
    .array(z.object({ descricao: z.string().min(1), ordem: z.number().int() }))
    .min(1),
});

const responderChecklistBody = z.object({
  respostas: z
    .array(z.object({ item_id: z.string().uuid(), marcado: z.boolean() }))
    .min(1),
});

export interface ChecklistRoutesDeps {
  checklistRepository: ChecklistRepository;
  ordemServicoRepository: OrdemServicoRepository;
}

export function registerChecklistRoutes(app: FastifyInstance, deps: ChecklistRoutesDeps): void {
  const { checklistRepository, ordemServicoRepository } = deps;

  const adminOuTecnico = { preHandler: [authenticate, requireRole(['admin', 'tecnico'])] };
  const somenteAdmin = { preHandler: [authenticate, requireRole(['admin'])] };

  const criarTemplateUseCase = new CriarTemplateChecklistUseCase({ checklistRepository });
  const listarTemplatesUseCase = new ListarTemplatesChecklistUseCase({ checklistRepository });
  const responderChecklistUseCase = new ResponderChecklistUseCase({
    checklistRepository,
    ordemServicoRepository,
  });
  const buscarChecklistOSUseCase = new BuscarChecklistOSUseCase({
    checklistRepository,
    ordemServicoRepository,
  });

  async function garantirOS(id: string) {
    const os = await ordemServicoRepository.findById(id);
    if (!os) throw new NotFoundError('Ordem de servico nao encontrada');
    return os;
  }

  app.post('/checklist/templates', somenteAdmin, async (request, reply) => {
    const body = criarTemplateBody.parse(request.body);
    const template = await criarTemplateUseCase.execute({
      categoriaServicoId: body.categoria_servico_id,
      titulo: body.titulo,
      itens: body.itens,
    });
    return reply.status(201).send(template);
  });

  app.get('/checklist/templates', adminOuTecnico, async (_request, reply) => {
    const templates = await listarTemplatesUseCase.execute();
    return reply.status(200).send(templates);
  });

  app.get('/ordens-servico/:id/checklist', adminOuTecnico, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);
    const os = await garantirOS(id);
    const resultado = await buscarChecklistOSUseCase.execute({
      ordemServicoId: id,
      categoriaServicoId: os.categoriaServicoId,
    });
    return reply.status(200).send(resultado);
  });

  app.put('/ordens-servico/:id/checklist', adminOuTecnico, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);
    const body = responderChecklistBody.parse(request.body);
    const usuario = request.user as { id: string } | undefined;

    const respostas = await responderChecklistUseCase.execute({
      ordemServicoId: id,
      respostas: body.respostas.map((r) => ({ itemId: r.item_id, marcado: r.marcado })),
      respondidoPorId: usuario?.id ?? null,
    });

    return reply.status(200).send(respostas);
  });
}

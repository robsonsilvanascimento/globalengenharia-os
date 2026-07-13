import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PendenciaOSRepository } from '../../domain/PendenciaOSRepository';
import type { OrdemServicoRepository } from '../../../ordens-servico/domain/OrdemServicoRepository';
import { RegistrarPendenciaOSUseCase } from '../../application/RegistrarPendenciaOSUseCase';
import { ListarPendenciasOSUseCase } from '../../application/ListarPendenciasOSUseCase';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';

const osIdParams = z.object({ id: z.string().uuid() });

const registrarPendenciaBody = z.object({
  observacao: z.string().min(1),
  fotos: z
    .array(
      z.object({
        mime_type: z.string(),
        base64: z.string().min(1),
      }),
    )
    .min(1),
});

export interface PendenciasRoutesDeps {
  pendenciaRepository: PendenciaOSRepository;
  ordemServicoRepository: OrdemServicoRepository;
}

export function registerPendenciasRoutes(app: FastifyInstance, deps: PendenciasRoutesDeps): void {
  const { pendenciaRepository, ordemServicoRepository } = deps;

  const adminOuTecnico = { preHandler: [authenticate, requireRole(['admin', 'tecnico'])] };

  const registrarPendenciaUseCase = new RegistrarPendenciaOSUseCase({
    pendenciaRepository,
    ordemServicoRepository,
  });

  const listarPendenciasUseCase = new ListarPendenciasOSUseCase({
    pendenciaRepository,
    ordemServicoRepository,
  });

  app.post('/ordens-servico/:id/pendencias', adminOuTecnico, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);
    const body = registrarPendenciaBody.parse(request.body);
    const usuario = request.user as { id: string } | undefined;

    const pendencia = await registrarPendenciaUseCase.execute({
      ordemServicoId: id,
      observacao: body.observacao,
      criadoPorId: usuario?.id ?? null,
      fotos: body.fotos.map((f) => ({ mimeType: f.mime_type, base64: f.base64 })),
    });

    return reply.status(201).send(pendencia);
  });

  app.get('/ordens-servico/:id/pendencias', adminOuTecnico, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);
    const pendencias = await listarPendenciasUseCase.execute(id);
    return reply.status(200).send(pendencias);
  });
}

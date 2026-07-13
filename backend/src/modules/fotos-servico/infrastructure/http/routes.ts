import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { FotoServicoRepository } from '../../domain/FotoServicoRepository';
import type { OrdemServicoRepository } from '../../../ordens-servico/domain/OrdemServicoRepository';
import { AdicionarFotoServicoUseCase } from '../../application/AdicionarFotoServicoUseCase';
import { ListarFotosServicoUseCase } from '../../application/ListarFotosServicoUseCase';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';

const osIdParams = z.object({ id: z.string().uuid() });

const adicionarFotoBody = z.object({
  mime_type: z.enum(['image/jpeg', 'image/png']),
  base64: z.string().min(1),
  legenda: z.string().optional(),
});

export interface FotosServicoRoutesDeps {
  fotoServicoRepository: FotoServicoRepository;
  ordemServicoRepository: OrdemServicoRepository;
}

export function registerFotosServicoRoutes(
  app: FastifyInstance,
  deps: FotosServicoRoutesDeps,
): void {
  const { fotoServicoRepository, ordemServicoRepository } = deps;

  const adminOuTecnico = { preHandler: [authenticate, requireRole(['admin', 'tecnico'])] };

  const adicionarFotoUseCase = new AdicionarFotoServicoUseCase({
    fotoServicoRepository,
    ordemServicoRepository,
  });

  const listarFotosUseCase = new ListarFotosServicoUseCase({
    fotoServicoRepository,
    ordemServicoRepository,
  });

  app.post('/ordens-servico/:id/fotos-servico', adminOuTecnico, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);
    const body = adicionarFotoBody.parse(request.body);
    const usuario = request.user as { id: string } | undefined;

    const foto = await adicionarFotoUseCase.execute({
      ordemServicoId: id,
      mimeType: body.mime_type,
      base64: body.base64,
      legenda: body.legenda,
      enviadoPorId: usuario?.id ?? null,
    });

    return reply.status(201).send(foto);
  });

  app.get('/ordens-servico/:id/fotos-servico', adminOuTecnico, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);

    const fotos = await listarFotosUseCase.execute(id);

    return reply.status(200).send({ fotos });
  });
}

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';
import { GerarRelatorioTecnicoUseCase } from '../../application/GerarRelatorioTecnicoUseCase';
import type { OrdemServicoRepository } from '../../../ordens-servico/domain/OrdemServicoRepository';
import type { ComponenteInstaladoRepository } from '../../../rastreabilidade/domain/ComponenteInstaladoRepository';
import type { DocumentoOSRepository } from '../../../rastreabilidade/domain/DocumentoOSRepository';

const osIdParams = z.object({ id: z.string().uuid() });

export interface RelatorioTecnicoRoutesDeps {
  ordemServicoRepository: OrdemServicoRepository;
  componenteInstaladoRepository: ComponenteInstaladoRepository;
  documentoOSRepository: DocumentoOSRepository;
  prisma: PrismaClient;
}

export function registerRelatorioTecnicoRoutes(app: FastifyInstance, deps: RelatorioTecnicoRoutesDeps): void {
  const adminOuTecnico = { preHandler: [authenticate, requireRole(['admin', 'tecnico'])] };

  const useCase = new GerarRelatorioTecnicoUseCase(deps);

  app.get('/ordens-servico/:id/relatorio-tecnico', adminOuTecnico, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);

    // Valores financeiros (valor cobrado e estimativa de custo) so entram no
    // relatorio quando quem gera e admin.
    const ocultarValores = request.user!.papel !== 'admin';
    const pdfBuffer = await useCase.execute(id, ocultarValores);

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="relatorio-tecnico-os-${id}.pdf"`);
    reply.header('X-Content-Type-Options', 'nosniff');
    return reply.send(pdfBuffer);
  });
}

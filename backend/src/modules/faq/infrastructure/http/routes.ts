import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { FaqEntryRepository } from '../../domain/FaqEntryRepository';
import { NotFoundError } from '../../../../shared/http/errors/AppError';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';

const listQuerySchema = z.object({
  incluir_inativas: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

const criarFaqEntryBodySchema = z.object({
  pergunta: z.string().min(1),
  resposta: z.string().min(1),
  tags: z.string().optional(),
});

const atualizarFaqEntryBodySchema = z
  .object({
    pergunta: z.string().min(1).optional(),
    resposta: z.string().min(1).optional(),
    tags: z.string().nullable().optional(),
    ativo: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  });

const faqEntryIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export interface FaqRoutesDeps {
  faqEntryRepository: FaqEntryRepository;
}

/** Registra as rotas do modulo de FAQ (CRUD administrativo da base de conhecimento). */
export function registerFaqRoutes(app: FastifyInstance, deps: FaqRoutesDeps): void {
  const { faqEntryRepository } = deps;
  const somenteAdmin = { preHandler: [authenticate, requireRole(['admin'])] };

  app.get('/faq', { preHandler: authenticate }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);

    // Apenas admin pode enxergar entradas inativas; demais papeis sempre recebem so ativo=true.
    const incluirInativas = request.user!.papel === 'admin' && query.incluir_inativas === true;

    const entradas = await faqEntryRepository.list(incluirInativas);
    return reply.status(200).send(entradas);
  });

  app.post('/faq', somenteAdmin, async (request, reply) => {
    const body = criarFaqEntryBodySchema.parse(request.body);

    const entrada = await faqEntryRepository.create({
      pergunta: body.pergunta,
      resposta: body.resposta,
      tags: body.tags,
    });

    return reply.status(201).send(entrada);
  });

  app.patch('/faq/:id', somenteAdmin, async (request, reply) => {
    const { id } = faqEntryIdParamsSchema.parse(request.params);
    const body = atualizarFaqEntryBodySchema.parse(request.body);

    const existente = await faqEntryRepository.findById(id);
    if (!existente) {
      throw new NotFoundError('Entrada de FAQ nao encontrada');
    }

    const entradaAtualizada = await faqEntryRepository.update(id, body);

    return reply.status(200).send(entradaAtualizada);
  });
}

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CategoriaServicoRepository } from '../../domain/CategoriaServicoRepository';
import { NotFoundError } from '../../../../shared/http/errors/AppError';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';

const areaSchema = z.enum(['eletrica', 'automacao', 'energia_solar', 'outro']);

const listQuerySchema = z.object({
  incluir_inativas: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

const criarCategoriaBodySchema = z.object({
  nome: z.string().min(1).max(150),
  area: areaSchema,
});

const atualizarCategoriaBodySchema = z
  .object({
    nome: z.string().min(1).max(150).optional(),
    area: areaSchema.optional(),
    ativo: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  });

const categoriaIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export interface CategoriasServicoRoutesDeps {
  categoriaServicoRepository: CategoriaServicoRepository;
}

/** Registra as rotas do modulo de categorias de servico. */
export function registerCategoriasServicoRoutes(
  app: FastifyInstance,
  deps: CategoriasServicoRoutesDeps,
): void {
  const { categoriaServicoRepository } = deps;
  const somenteAdmin = { preHandler: [authenticate, requireRole(['admin'])] };

  app.get('/categorias-servico', { preHandler: authenticate }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);

    // Apenas admin pode enxergar categorias inativas; demais papeis sempre recebem so ativo=true.
    const incluirInativas = request.user!.papel === 'admin' && query.incluir_inativas === true;

    const categorias = await categoriaServicoRepository.list(incluirInativas);
    return reply.status(200).send(categorias);
  });

  app.post('/categorias-servico', somenteAdmin, async (request, reply) => {
    const body = criarCategoriaBodySchema.parse(request.body);

    const categoria = await categoriaServicoRepository.create({
      nome: body.nome,
      area: body.area,
    });

    return reply.status(201).send(categoria);
  });

  app.patch('/categorias-servico/:id', somenteAdmin, async (request, reply) => {
    const { id } = categoriaIdParamsSchema.parse(request.params);
    const body = atualizarCategoriaBodySchema.parse(request.body);

    const existente = await categoriaServicoRepository.findById(id);
    if (!existente) {
      throw new NotFoundError('Categoria de servico nao encontrada');
    }

    const categoriaAtualizada = await categoriaServicoRepository.update(id, body);

    return reply.status(200).send(categoriaAtualizada);
  });
}

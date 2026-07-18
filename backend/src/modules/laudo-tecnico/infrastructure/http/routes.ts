import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';
import { NotFoundError } from '../../../../shared/http/errors/AppError';
import type { TrechoNormativoRepository } from '../../domain/TrechoNormativoRepository';
import { CATEGORIAS_TRECHO } from '../seed/trechos-normativos.seed';

const listarQuery = z.object({
  categoria: z.string().optional(),
  norma: z.string().optional(),
  busca: z.string().optional(),
});

const idParams = z.object({ id: z.string().uuid() });

const criarBody = z.object({
  norma: z.string().min(1),
  item: z.string().optional(),
  categoria: z.string().min(1),
  assunto: z.string().min(1),
  texto: z.string().min(1),
  item_verificar: z.boolean().optional(),
});

const atualizarBody = z
  .object({
    norma: z.string().min(1).optional(),
    item: z.string().nullable().optional(),
    categoria: z.string().min(1).optional(),
    assunto: z.string().min(1).optional(),
    texto: z.string().min(1).optional(),
    item_verificar: z.boolean().optional(),
    ativo: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Informe ao menos um campo' });

export interface LaudoTecnicoRoutesDeps {
  trechoNormativoRepository: TrechoNormativoRepository;
}

export function registerLaudoTecnicoRoutes(app: FastifyInstance, deps: LaudoTecnicoRoutesDeps): void {
  const { trechoNormativoRepository } = deps;
  // Montagem de laudo e feita pela equipe tecnica; cadastro/edicao da
  // biblioteca de trechos fica restrito ao admin.
  const equipeTecnica = { preHandler: [authenticate, requireRole(['admin', 'tecnico', 'atendente'])] };
  const somenteAdmin = { preHandler: [authenticate, requireRole(['admin'])] };

  // Categorias disponiveis (para os filtros da aba de laudos).
  app.get('/laudos/categorias', equipeTecnica, async (_request, reply) => {
    const categorias = Object.entries(CATEGORIAS_TRECHO).map(([valor, rotulo]) => ({ valor, rotulo }));
    return reply.status(200).send(categorias);
  });

  // Biblioteca de trechos normativos (filtravel por categoria, norma e busca).
  app.get('/laudos/trechos', equipeTecnica, async (request, reply) => {
    const query = listarQuery.parse(request.query);
    const trechos = await trechoNormativoRepository.listar(query);
    return reply.status(200).send(trechos);
  });

  app.post('/laudos/trechos', somenteAdmin, async (request, reply) => {
    const body = criarBody.parse(request.body);
    const trecho = await trechoNormativoRepository.criar({
      norma: body.norma,
      item: body.item,
      categoria: body.categoria,
      assunto: body.assunto,
      texto: body.texto,
      itemVerificar: body.item_verificar,
      criadoPorId: request.user!.id,
    });
    return reply.status(201).send(trecho);
  });

  app.put('/laudos/trechos/:id', somenteAdmin, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = atualizarBody.parse(request.body);

    const existente = await trechoNormativoRepository.buscarPorId(id);
    if (!existente) throw new NotFoundError('Trecho nao encontrado');

    const trecho = await trechoNormativoRepository.atualizar(id, {
      norma: body.norma,
      item: body.item,
      categoria: body.categoria,
      assunto: body.assunto,
      texto: body.texto,
      itemVerificar: body.item_verificar,
      ativo: body.ativo,
    });
    return reply.status(200).send(trecho);
  });

  app.delete('/laudos/trechos/:id', somenteAdmin, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const existente = await trechoNormativoRepository.buscarPorId(id);
    if (!existente) throw new NotFoundError('Trecho nao encontrado');

    await trechoNormativoRepository.desativar(id);
    return reply.status(204).send();
  });
}

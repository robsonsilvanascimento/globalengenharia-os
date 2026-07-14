import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';
import { ConflictError, NotFoundError, ValidationError } from '../../../../shared/http/errors/AppError';

const pecaIdParams = z.object({
  id: z.string().uuid(),
});

const criarPecaBody = z.object({
  codigo: z.string().min(1),
  nome: z.string().min(1),
  descricao: z.string().optional(),
  unidade: z.string().optional(),
  preco_unitario: z.number().positive(),
  estoque_atual: z.number().optional(),
  estoque_minimo: z.number().optional(),
});

const atualizarPecaBody = z
  .object({
    codigo: z.string().min(1).optional(),
    nome: z.string().min(1).optional(),
    descricao: z.string().optional(),
    unidade: z.string().optional(),
    preco_unitario: z.number().positive().optional(),
    estoque_atual: z.number().optional(),
    estoque_minimo: z.number().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  });

const ativoBody = z.object({
  ativo: z.boolean(),
});

const listQuerySchema = z.object({
  ativo: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  search: z.string().optional(),
});

const entradaBody = z.object({
  quantidade: z.number().positive(),
  preco_unitario: z.number().positive().optional(),
  precoUnitario: z.number().positive().optional(),
  observacao: z.string().optional(),
});

const ajusteBody = z.object({
  novoEstoque: z.number().min(0),
  observacao: z.string().optional(),
});

const movimentacoesQuerySchema = z.object({
  tipo: z.enum(['entrada', 'saida']).optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().positive().default(20),
});

export interface EstoqueRoutesDeps {
  prisma: PrismaClient;
}

export function registerEstoqueRoutes(app: FastifyInstance, { prisma }: EstoqueRoutesDeps): void {
  const somenteAdmin = { preHandler: [authenticate, requireRole(['admin'])] };
  const adminOuTecnico = { preHandler: [authenticate, requireRole(['admin', 'tecnico'])] };

  app.post('/pecas', somenteAdmin, async (request, reply) => {
    const body = criarPecaBody.parse(request.body);

    const existente = await prisma.peca.findUnique({ where: { codigo: body.codigo } });
    if (existente) {
      throw new ConflictError('Codigo de peca ja cadastrado');
    }

    const peca = await prisma.peca.create({
      data: {
        codigo: body.codigo,
        nome: body.nome,
        descricao: body.descricao,
        unidade: body.unidade,
        precoUnitario: body.preco_unitario,
        estoqueAtual: body.estoque_atual ?? 0,
        estoqueMinimo: body.estoque_minimo ?? 0,
      },
    });

    return reply.status(201).send(peca);
  });

  app.get('/pecas', adminOuTecnico, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);

    const pecas = await prisma.peca.findMany({
      where: {
        ...(query.ativo !== undefined ? { ativo: query.ativo } : {}),
        ...(query.search
          ? {
              OR: [
                { nome: { contains: query.search, mode: 'insensitive' } },
                { codigo: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { nome: 'asc' },
    });

    return reply.status(200).send(pecas);
  });

  app.get('/pecas/:id', adminOuTecnico, async (request, reply) => {
    const { id } = pecaIdParams.parse(request.params);

    const peca = await prisma.peca.findUnique({
      where: { id },
      include: {
        movimentacoes: {
          orderBy: { criadoEm: 'desc' },
          take: 50,
        },
      },
    });

    if (!peca) {
      throw new NotFoundError('Peca nao encontrada');
    }

    return reply.status(200).send(peca);
  });

  app.put('/pecas/:id', somenteAdmin, async (request, reply) => {
    const { id } = pecaIdParams.parse(request.params);
    const body = atualizarPecaBody.parse(request.body);

    const existente = await prisma.peca.findUnique({ where: { id } });
    if (!existente) {
      throw new NotFoundError('Peca nao encontrada');
    }

    if (body.codigo && body.codigo !== existente.codigo) {
      const codigoDuplicado = await prisma.peca.findUnique({ where: { codigo: body.codigo } });
      if (codigoDuplicado) {
        throw new ConflictError('Codigo de peca ja cadastrado');
      }
    }

    const peca = await prisma.peca.update({
      where: { id },
      data: {
        ...(body.codigo !== undefined ? { codigo: body.codigo } : {}),
        ...(body.nome !== undefined ? { nome: body.nome } : {}),
        ...(body.descricao !== undefined ? { descricao: body.descricao } : {}),
        ...(body.unidade !== undefined ? { unidade: body.unidade } : {}),
        ...(body.preco_unitario !== undefined ? { precoUnitario: body.preco_unitario } : {}),
        ...(body.estoque_atual !== undefined ? { estoqueAtual: body.estoque_atual } : {}),
        ...(body.estoque_minimo !== undefined ? { estoqueMinimo: body.estoque_minimo } : {}),
      },
    });

    return reply.status(200).send(peca);
  });

  app.patch('/pecas/:id/ativo', somenteAdmin, async (request, reply) => {
    const { id } = pecaIdParams.parse(request.params);
    const body = ativoBody.parse(request.body);

    const existente = await prisma.peca.findUnique({ where: { id } });
    if (!existente) {
      throw new NotFoundError('Peca nao encontrada');
    }

    const peca = await prisma.peca.update({
      where: { id },
      data: { ativo: body.ativo },
    });

    return reply.status(200).send(peca);
  });

  app.post('/pecas/:id/entradas', somenteAdmin, async (request, reply) => {
    const { id } = pecaIdParams.parse(request.params);
    const body = entradaBody.parse(request.body);

    const existente = await prisma.peca.findUnique({ where: { id } });
    if (!existente) {
      throw new NotFoundError('Peca nao encontrada');
    }

    const precoUnitario = body.precoUnitario ?? body.preco_unitario ?? Number(existente.precoUnitario);

    const movimentacao = await prisma.$transaction(async (tx) => {
      const mov = await tx.movimentacaoEstoque.create({
        data: {
          tipo: 'entrada',
          quantidade: body.quantidade,
          precoUnitario,
          observacao: body.observacao,
          pecaId: id,
          criadoPorId: request.user!.id,
        },
      });

      await tx.peca.update({
        where: { id },
        data: {
          estoqueAtual: { increment: body.quantidade },
          precoUnitario,
        },
      });

      return mov;
    });

    return reply.status(201).send(movimentacao);
  });

  app.post('/pecas/:id/ajuste', somenteAdmin, async (request, reply) => {
    const { id } = pecaIdParams.parse(request.params);
    const body = ajusteBody.parse(request.body);

    const existente = await prisma.peca.findUnique({ where: { id } });
    if (!existente) throw new NotFoundError('Peca nao encontrada');

    const estoqueAtual = Number(existente.estoqueAtual);
    const diff = body.novoEstoque - estoqueAtual;
    if (diff === 0) return reply.status(200).send({ message: 'Sem alteracao' });

    const tipo = diff > 0 ? 'entrada' : 'saida';
    const quantidade = Math.abs(diff);
    const precoUnitario = Number(existente.precoUnitario);

    const movimentacao = await prisma.$transaction(async (tx) => {
      const mov = await tx.movimentacaoEstoque.create({
        data: {
          tipo,
          quantidade,
          precoUnitario,
          observacao: body.observacao ?? `Ajuste manual: ${estoqueAtual} → ${body.novoEstoque}`,
          pecaId: id,
          criadoPorId: request.user!.id,
        },
      });
      await tx.peca.update({
        where: { id },
        data: { estoqueAtual: body.novoEstoque },
      });
      return mov;
    });

    return reply.status(201).send(movimentacao);
  });

  app.get('/pecas/:id/movimentacoes', somenteAdmin, async (request, reply) => {
    const { id } = pecaIdParams.parse(request.params);
    const query = movimentacoesQuerySchema.parse(request.query);

    const existente = await prisma.peca.findUnique({ where: { id } });
    if (!existente) {
      throw new NotFoundError('Peca nao encontrada');
    }

    const where = {
      pecaId: id,
      ...(query.tipo ? { tipo: query.tipo } : {}),
    };

    const [total, movimentacoes] = await prisma.$transaction([
      prisma.movimentacaoEstoque.count({ where }),
      prisma.movimentacaoEstoque.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip: (query.page - 1) * query.page_size,
        take: query.page_size,
      }),
    ]);

    return reply.status(200).send({ total, movimentacoes });
  });
}

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { HashService } from '../../application/ports/HashService';
import type { Usuario } from '../../domain/Usuario';
import type { UsuarioRepository } from '../../domain/UsuarioRepository';
import { ConflictError, NotFoundError } from '../../../../shared/http/errors/AppError';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';
import { prisma } from '../../../../shared/infra/PrismaClient';

const papelSchema = z.enum(['atendente', 'tecnico', 'admin', 'ajudante']);

const criarUsuarioBodySchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  senha: z.string().min(6),
  papel: papelSchema,
  ativo: z.boolean().optional(),
  telefone: z.string().optional(),
  valorHora: z.number().min(0).optional(),
});

const atualizarUsuarioBodySchema = z
  .object({
    nome: z.string().min(1).optional(),
    papel: papelSchema.optional(),
    ativo: z.boolean().optional(),
    telefone: z.string().optional(),
    valorHora: z.number().min(0).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  });

const usuarioIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export interface UsuariosRoutesDeps {
  usuarioRepository: UsuarioRepository;
  hashService: HashService;
}

/** Remove campos sensiveis antes de devolver o usuario na resposta HTTP. */
function paraRespostaPublica(usuario: Usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
    ativo: usuario.ativo,
    telefone: usuario.telefone ?? null,
    valorHora: usuario.valorHora ?? null,
    criadoEm: usuario.criadoEm,
  };
}

/**
 * Registra o CRUD de usuarios. Leitura (GET) e liberada para qualquer papel
 * autenticado, pois atendente/tecnico precisam popular selects de tecnicos
 * (filtro de OS, atribuicao) — a resposta ja remove campos sensiveis via
 * `paraRespostaPublica`. Escrita (POST/PATCH) permanece restrita a admin.
 */
export function registerUsuariosRoutes(app: FastifyInstance, deps: UsuariosRoutesDeps): void {
  const { usuarioRepository, hashService } = deps;
  const autenticado = { preHandler: [authenticate] };
  const somenteAdmin = { preHandler: [authenticate, requireRole(['admin'])] };

  app.get('/usuarios', autenticado, async (_request, reply) => {
    const usuarios = await usuarioRepository.list();
    return reply.status(200).send(usuarios.map(paraRespostaPublica));
  });

  app.post('/usuarios', somenteAdmin, async (request, reply) => {
    const body = criarUsuarioBodySchema.parse(request.body);

    const existente = await usuarioRepository.findByEmail(body.email);
    if (existente) {
      throw new ConflictError('Ja existe um usuario com este email');
    }

    const senhaHash = await hashService.hash(body.senha);

    const usuario = await usuarioRepository.create({
      nome: body.nome,
      email: body.email,
      senhaHash,
      papel: body.papel,
      ativo: body.ativo,
      telefone: body.telefone,
      valorHora: body.valorHora,
    });

    return reply.status(201).send(paraRespostaPublica(usuario));
  });

  app.patch('/usuarios/:id', somenteAdmin, async (request, reply) => {
    const { id } = usuarioIdParamsSchema.parse(request.params);
    const body = atualizarUsuarioBodySchema.parse(request.body);

    const existente = await usuarioRepository.findById(id);
    if (!existente) {
      throw new NotFoundError('Usuario nao encontrado');
    }

    const usuarioAtualizado = await usuarioRepository.update(id, body);

    return reply.status(200).send(paraRespostaPublica(usuarioAtualizado));
  });

  const pushTokenBodySchema = z.object({
    expo_push_token: z
      .string()
      .regex(/^ExponentPushToken\[.+\]$/, 'Token Expo inválido'),
  });

  app.put('/usuarios/me/push-token', autenticado, async (request, reply) => {
    const body = pushTokenBodySchema.parse(request.body);
    await prisma.usuario.update({
      where: { id: request.user!.id },
      data: { expoPushToken: body.expo_push_token },
    });
    return reply.status(200).send({ message: 'Token salvo' });
  });

  const comissaoBodySchema = z.object({
    comissao_ativa: z.boolean(),
    comissao_pct: z.number().min(0).max(100),
  });

  app.patch('/usuarios/:id/comissao', somenteAdmin, async (request, reply) => {
    const { id } = usuarioIdParamsSchema.parse(request.params);
    const body = comissaoBodySchema.parse(request.body);

    const existente = await usuarioRepository.findById(id);
    if (!existente) {
      throw new NotFoundError('Usuario nao encontrado');
    }

    const usuario = await prisma.usuario.update({
      where: { id },
      data: {
        comissaoAtiva: body.comissao_ativa,
        comissaoPct: body.comissao_pct,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        papel: true,
        ativo: true,
        telefone: true,
        valorHora: true,
        criadoEm: true,
        comissaoAtiva: true,
        comissaoPct: true,
      },
    });

    return reply.status(200).send(usuario);
  });
}

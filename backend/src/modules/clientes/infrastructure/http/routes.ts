import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ListarHistoricoOSClienteUseCase } from '../../application/use-cases/ListarHistoricoOSClienteUseCase';
import { ObterResumoClienteUseCase } from '../../application/ObterResumoClienteUseCase';
import { ClienteNaoEncontradoError } from '../../domain/errors/ClienteNaoEncontradoError';
import type { ClienteRepository } from '../../domain/ClienteRepository';
import type { CategoriaServicoRepository } from '../../../categorias-servico/domain/CategoriaServicoRepository';
import type { OrdemServicoRepository } from '../../../ordens-servico/domain/OrdemServicoRepository';
import { ConflictError, NotFoundError } from '../../../../shared/http/errors/AppError';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';

const listQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
});

const clienteIdParamsSchema = z.object({
  clienteId: z.string().uuid(),
});

const historicoOSQuerySchema = z.object({
  excluirOsId: z.string().uuid().optional(),
});

const criarClienteBodySchema = z.object({
  nome: z.string().min(1),
  telefone_whatsapp: z.string().min(1),
  documento: z.string().optional(),
  email: z.string().email().optional(),
});

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

export interface ClientesRoutesDeps {
  clienteRepository: ClienteRepository;
  ordemServicoRepository: OrdemServicoRepository;
  categoriaServicoRepository: CategoriaServicoRepository;
}

/** Registra as rotas do modulo de clientes. */
export function registerClientesRoutes(app: FastifyInstance, deps: ClientesRoutesDeps): void {
  const { clienteRepository, ordemServicoRepository, categoriaServicoRepository } = deps;
  const atendenteOuAdmin = { preHandler: [authenticate, requireRole(['atendente', 'admin'])] };
  const adminOuTecnico = { preHandler: [authenticate, requireRole(['admin', 'tecnico'])] };

  const obterResumoClienteUseCase = new ObterResumoClienteUseCase({
    clienteRepository,
    ordemServicoRepository,
    categoriaServicoRepository,
  });

  const listarHistoricoOSClienteUseCase = new ListarHistoricoOSClienteUseCase({ ordemServicoRepository });

  app.get('/clientes', { preHandler: authenticate }, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const clientes = await clienteRepository.list();

    if (!query.q) {
      return reply.status(200).send(clientes);
    }

    const termo = query.q.toLowerCase();
    const filtrados = clientes.filter(
      (cliente) =>
        cliente.nome.toLowerCase().includes(termo) || cliente.telefoneWhatsapp.includes(query.q!),
    );

    return reply.status(200).send(filtrados);
  });

  app.post('/clientes', atendenteOuAdmin, async (request, reply) => {
    const body = criarClienteBodySchema.parse(request.body);

    const existente = await clienteRepository.findByTelefone(body.telefone_whatsapp);
    if (existente) {
      throw new ConflictError('Ja existe um cliente cadastrado com este telefone');
    }

    const cliente = await clienteRepository.create({
      nome: body.nome,
      telefoneWhatsapp: body.telefone_whatsapp,
      documento: body.documento,
      email: body.email,
    });

    return reply.status(201).send(cliente);
  });

  app.get('/clientes/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);

    const cliente = await clienteRepository.findById(id);
    if (!cliente) {
      throw new NotFoundError('Cliente nao encontrado');
    }

    return reply.status(200).send({
      id: cliente.id,
      nome: cliente.nome,
      telefone_whatsapp: cliente.telefoneWhatsapp,
      email: cliente.email ?? null,
      documento: cliente.documento ?? null,
      criado_em: cliente.criadoEm,
    });
  });

  app.get('/clientes/:clienteId/historico-os', adminOuTecnico, async (request, reply) => {
    const { clienteId } = clienteIdParamsSchema.parse(request.params);
    const query = historicoOSQuerySchema.parse(request.query);

    const items = await listarHistoricoOSClienteUseCase.execute({
      clienteId,
      excluirOsId: query.excluirOsId,
    });

    return reply.status(200).send({
      items: items.map((item) => ({
        id: item.id,
        numero: item.numero,
        status: item.status,
        prioridade: item.prioridade,
        descricao_problema: item.descricaoProblema,
        categoria_nome: item.categoriaNome,
        tecnico_nome: item.tecnicoNome,
        valor_cobrado: item.valorCobrado,
        criado_em: item.criadoEm,
        fechado_em: item.fechadoEm,
      })),
    });
  });

  app.get('/clientes/:id/resumo', { preHandler: authenticate }, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);

    try {
      const resumo = await obterResumoClienteUseCase.execute(id);

      return reply.status(200).send({
        total_ordens_servico: resumo.totalOrdensServico,
        total_valor_cobrado: resumo.totalValorCobrado,
        ordens_servico: resumo.ordensServico.map((ordemServico) => ({
          id: ordemServico.id,
          numero: ordemServico.numero,
          categoria_nome: ordemServico.categoriaNome,
          descricao_problema: ordemServico.descricaoProblema,
          status: ordemServico.status,
          prioridade: ordemServico.prioridade,
          valor_cobrado: ordemServico.valorCobrado,
          criado_em: ordemServico.criadoEm,
        })),
      });
    } catch (error) {
      if (error instanceof ClienteNaoEncontradoError) {
        throw new NotFoundError(error.message);
      }
      throw error;
    }
  });
}

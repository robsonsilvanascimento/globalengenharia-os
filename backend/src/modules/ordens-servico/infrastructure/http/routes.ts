import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AtribuirTecnicoUseCase } from '../../application/AtribuirTecnicoUseCase';
import { AtualizarOrdemServicoUseCase } from '../../application/AtualizarOrdemServicoUseCase';
import { AtualizarStatusOrdemServicoUseCase } from '../../application/AtualizarStatusOrdemServicoUseCase';
import { BuscarOrdemServicoUseCase } from '../../application/BuscarOrdemServicoUseCase';
import { CriarOrdemServicoUseCase } from '../../application/CriarOrdemServicoUseCase';
import { ListarHistoricoOSUseCase } from '../../application/ListarHistoricoOSUseCase';
import { ListarOrdensServicoUseCase } from '../../application/ListarOrdensServicoUseCase';
import { RegistrarValorOrdemServicoUseCase } from '../../application/RegistrarValorOrdemServicoUseCase';
import { VerificarDisponibilidadeUseCase } from '../../application/VerificarDisponibilidadeUseCase';
import { AjudanteIndisponivelError } from '../../domain/errors/AjudanteIndisponivelError';
import { OrcamentoObrigatorioError } from '../../domain/errors/OrcamentoObrigatorioError';
import { OrdemServicoConcorrenciaError } from '../../domain/errors/OrdemServicoConcorrenciaError';
import { OrdemServicoNaoEncontradaError } from '../../domain/errors/OrdemServicoNaoEncontradaError';
import { TecnicoIndisponivelError } from '../../domain/errors/TecnicoIndisponivelError';
import { TransicaoInvalidaError } from '../../domain/errors/TransicaoInvalidaError';
import type { HistoricoStatusOS } from '../../domain/HistoricoStatusOS';
import type { HistoricoStatusOSRepository } from '../../domain/HistoricoStatusOSRepository';
import type { NumeroOSGenerator } from '../../domain/NumeroOSGenerator';
import type { OrdemServico } from '../../domain/OrdemServico';
import type { OrdemServicoRepository } from '../../domain/OrdemServicoRepository';
import type { ClienteRepository } from '../../../clientes/domain/ClienteRepository';
import type { UsuarioRepository } from '../../../auth/domain/UsuarioRepository';
import type { ChecklistRepository } from '../../../checklist/domain/ChecklistRepository';
import type { EventBus } from '../../../../shared/domain/EventBus';
import { ConflictError, NotFoundError } from '../../../../shared/http/errors/AppError';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';

const statusSchema = z.enum([
  'aberta',
  'triagem',
  'atribuida',
  'em_andamento',
  'aguardando_peca',
  'concluida',
  'cancelada',
]);

const prioridadeSchema = z.enum(['baixa', 'normal', 'alta', 'urgente']);

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const listQuerySchema = z.object({
  status: statusSchema.optional(),
  tecnico_id: z.string().uuid().optional(),
  cliente_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

const historicoQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(50),
});

const criarOrdemServicoBodySchema = z.object({
  cliente_id: z.string().uuid(),
  categoria_servico_id: z.string().uuid(),
  descricao_problema: z.string().min(1),
  endereco_atendimento: z.string().optional(),
  prioridade: prioridadeSchema.optional(),
  tipo_chamado: z.enum(['emergencia', 'servico']).optional(),
});

const atualizarOrdemServicoBodySchema = z.object({
  descricao_problema: z.string().min(1).optional(),
  endereco_atendimento: z.string().optional(),
  prioridade: prioridadeSchema.optional(),
  data_agendada: z.coerce.date().optional(),
});

const atualizarStatusBodySchema = z.object({
  status: statusSchema,
  observacao: z.string().optional(),
});

const atribuirTecnicoBodySchema = z.object({
  tecnico_id: z.string().uuid(),
  ajudante_id: z.string().uuid().optional(),
  data_agendada: z.coerce.date().optional(),
});

const registrarValorBodySchema = z.object({
  valor_cobrado: z.number().min(0),
});

export interface OrdensServicoRoutesDeps {
  ordemServicoRepository: OrdemServicoRepository;
  historicoStatusOSRepository: HistoricoStatusOSRepository;
  numeroOSGenerator: NumeroOSGenerator;
  eventBus: EventBus;
  clienteRepository: ClienteRepository;
  usuarioRepository: UsuarioRepository;
  checklistRepository: ChecklistRepository;
  /** Checa se a OS tem orcamento aprovado (regra de emergencia). */
  orcamentoAprovado?: (ordemServicoId: string) => Promise<boolean>;
}

/** Relanca erros de dominio conhecidos como AppError HTTP; demais erros seguem para o error-handler global. */
function relancarComoAppError(error: unknown): never {
  if (error instanceof OrdemServicoNaoEncontradaError) {
    throw new NotFoundError(error.message);
  }
  if (error instanceof TransicaoInvalidaError) {
    throw new ConflictError(error.message);
  }
  if (error instanceof TecnicoIndisponivelError) {
    throw new ConflictError(error.message);
  }
  if (error instanceof AjudanteIndisponivelError) {
    throw new ConflictError(error.message);
  }
  if (error instanceof OrdemServicoConcorrenciaError) {
    throw new ConflictError(error.message);
  }
  if (error instanceof OrcamentoObrigatorioError) {
    throw new ConflictError(error.message);
  }
  throw error;
}

/** Registra as rotas do modulo de ordens de servico. */
export function registerOrdensServicoRoutes(app: FastifyInstance, deps: OrdensServicoRoutesDeps): void {
  const {
    ordemServicoRepository,
    historicoStatusOSRepository,
    numeroOSGenerator,
    eventBus,
    clienteRepository,
    usuarioRepository,
    checklistRepository,
  } = deps;

  const atendenteOuAdmin = { preHandler: [authenticate, requireRole(['atendente', 'admin'])] };
  const somenteAdmin = { preHandler: [authenticate, requireRole(['admin'])] };
  const equipeOperacional = {
    preHandler: [authenticate, requireRole(['atendente', 'admin', 'tecnico'])],
  };
  /**
   * Mesmo grupo de equipeOperacional, mas tambem inclui ajudante — usado
   * apenas nas rotas de LEITURA que o app mobile do ajudante consome (ele
   * so visualiza as OS em que esta escalado, nunca altera status).
   */
  const equipeOperacionalComLeituraAjudante = {
    preHandler: [authenticate, requireRole(['atendente', 'admin', 'tecnico', 'ajudante'])],
  };

  /**
   * Valor cobrado e informacao financeira restrita ao admin. Para qualquer
   * outro papel (tecnico, ajudante, atendente) o campo e omitido da resposta
   * — nao apenas escondido na UI, mas ausente do payload da API.
   */
  function deveOcultarValor(papel: string): boolean {
    return papel !== 'admin';
  }

  /**
   * Tecnico/ajudante so podem acessar a OS se estiverem atribuidos a ela —
   * evita que qualquer tecnico/ajudante autenticado veja OS de outros.
   * Retorna 404 (nao 403) para nao revelar a existencia da OS a quem nao tem
   * acesso, seguindo o mesmo padrao ja usado na consulta via WhatsApp.
   */
  function garantirAcessoTecnico(ordemServico: OrdemServico, usuarioId: string, papel: string): void {
    if (papel !== 'tecnico' && papel !== 'ajudante') return;
    if (ordemServico.tecnicoId === usuarioId || ordemServico.ajudanteId === usuarioId) return;
    throw new NotFoundError('Ordem de Servico nao encontrada');
  }

  const criarOrdemServicoUseCase = new CriarOrdemServicoUseCase({
    ordemServicoRepository,
    historicoStatusOSRepository,
    numeroOSGenerator,
    eventBus,
  });
  const atualizarOrdemServicoUseCase = new AtualizarOrdemServicoUseCase({ ordemServicoRepository, eventBus });
  const atualizarStatusOrdemServicoUseCase = new AtualizarStatusOrdemServicoUseCase({
    ordemServicoRepository,
    historicoStatusOSRepository,
    eventBus,
    checklistRepository,
    orcamentoAprovado: deps.orcamentoAprovado,
  });
  const verificarDisponibilidadeUseCase = new VerificarDisponibilidadeUseCase({ ordemServicoRepository });
  const atribuirTecnicoUseCase = new AtribuirTecnicoUseCase({
    ordemServicoRepository,
    historicoStatusOSRepository,
    verificarDisponibilidadeUseCase,
    eventBus,
  });
  const registrarValorOrdemServicoUseCase = new RegistrarValorOrdemServicoUseCase({ ordemServicoRepository });
  const listarOrdensServicoUseCase = new ListarOrdensServicoUseCase({ ordemServicoRepository });
  const buscarOrdemServicoUseCase = new BuscarOrdemServicoUseCase({ ordemServicoRepository });
  const listarHistoricoOSUseCase = new ListarHistoricoOSUseCase({
    ordemServicoRepository,
    historicoStatusOSRepository,
  });

  /** Monta o DTO HTTP (snake_case) de uma OS, enriquecido com cliente_nome/tecnico_nome. */
  async function montarOrdemServicoResponse(ordemServico: OrdemServico, ocultarValor = false) {
    const [cliente, tecnico] = await Promise.all([
      clienteRepository.findById(ordemServico.clienteId),
      ordemServico.tecnicoId ? usuarioRepository.findById(ordemServico.tecnicoId) : Promise.resolve(null),
    ]);

    return {
      id: ordemServico.id,
      numero: ordemServico.numero,
      cliente_id: ordemServico.clienteId,
      cliente_nome: cliente?.nome ?? '',
      categoria_servico_id: ordemServico.categoriaServicoId,
      descricao_problema: ordemServico.descricaoProblema,
      endereco_atendimento: ordemServico.enderecoAtendimento,
      status: ordemServico.status,
      prioridade: ordemServico.prioridade,
      tecnico_id: ordemServico.tecnicoId,
      tecnico_nome: tecnico?.nome,
      valor_cobrado: ocultarValor ? undefined : ordemServico.valorCobrado ?? null,
      data_agendada: ordemServico.dataAgendada ?? null,
      criado_em: ordemServico.criadoEm,
      atualizado_em: ordemServico.atualizadoEm,
      sla_vencido: ordemServico.slaVencido ?? false,
    };
  }

  function montarOrdemServicoResponseEmLote(
    ordens: OrdemServico[],
    nomeClientePorId: Map<string, string>,
    nomeUsuarioPorId: Map<string, string>,
    ocultarValor = false,
  ) {
    return ordens.map((ordemServico) => ({
      id: ordemServico.id,
      numero: ordemServico.numero,
      cliente_id: ordemServico.clienteId,
      cliente_nome: nomeClientePorId.get(ordemServico.clienteId) ?? '',
      categoria_servico_id: ordemServico.categoriaServicoId,
      descricao_problema: ordemServico.descricaoProblema,
      endereco_atendimento: ordemServico.enderecoAtendimento,
      status: ordemServico.status,
      prioridade: ordemServico.prioridade,
      tecnico_id: ordemServico.tecnicoId,
      tecnico_nome: ordemServico.tecnicoId ? nomeUsuarioPorId.get(ordemServico.tecnicoId) : undefined,
      valor_cobrado: ocultarValor ? undefined : ordemServico.valorCobrado ?? null,
      data_agendada: ordemServico.dataAgendada ?? null,
      criado_em: ordemServico.criadoEm,
      atualizado_em: ordemServico.atualizadoEm,
      sla_vencido: ordemServico.slaVencido ?? false,
    }));
  }

  function montarHistoricoResponse(historico: HistoricoStatusOS) {
    return {
      id: historico.id,
      ordem_servico_id: historico.ordemServicoId,
      status_anterior: historico.statusAnterior,
      status_novo: historico.statusNovo,
      alterado_por_usuario_id: historico.alteradoPorUsuarioId,
      alterado_por_bot: historico.alteradoPorBot,
      observacao: historico.observacao,
      criado_em: historico.criadoEm,
    };
  }

  app.get('/ordens-servico', equipeOperacionalComLeituraAjudante, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);
    const papel = request.user!.papel;
    // Tecnico/ajudante so podem listar as proprias OS — ignora tecnico_id
    // vindo da query e forca o proprio id, para nao consultar a agenda de outros.
    const tecnicoId = papel === 'tecnico' ? request.user!.id : query.tecnico_id;
    const ajudanteId = papel === 'ajudante' ? request.user!.id : undefined;

    const resultado = await listarOrdensServicoUseCase.execute({
      status: query.status,
      tecnicoId,
      ajudanteId,
      clienteId: query.cliente_id,
      page: query.page,
      pageSize: query.page_size,
    });

    const [clientes, usuarios] = await Promise.all([clienteRepository.list(), usuarioRepository.list()]);
    const nomeClientePorId = new Map(clientes.map((cliente) => [cliente.id, cliente.nome]));
    const nomeUsuarioPorId = new Map(usuarios.map((usuario) => [usuario.id, usuario.nome]));

    return reply.status(200).send({
      data: montarOrdemServicoResponseEmLote(
        resultado.itens,
        nomeClientePorId,
        nomeUsuarioPorId,
        deveOcultarValor(papel),
      ),
      page: query.page,
      page_size: query.page_size,
      total: resultado.total,
    });
  });

  app.post('/ordens-servico', atendenteOuAdmin, async (request, reply) => {
    const body = criarOrdemServicoBodySchema.parse(request.body);

    const ordemServico = await criarOrdemServicoUseCase.execute({
      clienteId: body.cliente_id,
      categoriaServicoId: body.categoria_servico_id,
      descricaoProblema: body.descricao_problema,
      enderecoAtendimento: body.endereco_atendimento,
      prioridade: body.prioridade,
      tipoChamado: body.tipo_chamado,
      criadoPorUsuarioId: request.user!.id,
      criadoVia: 'painel',
    });

    return reply.status(201).send(await montarOrdemServicoResponse(ordemServico, deveOcultarValor(request.user!.papel)));
  });

  app.get('/ordens-servico/:id', equipeOperacionalComLeituraAjudante, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const papel = request.user!.papel;

    try {
      const ordemServico = await buscarOrdemServicoUseCase.execute(id);
      garantirAcessoTecnico(ordemServico, request.user!.id, papel);
      return reply.status(200).send(await montarOrdemServicoResponse(ordemServico, deveOcultarValor(papel)));
    } catch (error) {
      relancarComoAppError(error);
    }
  });

  app.patch('/ordens-servico/:id', atendenteOuAdmin, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const body = atualizarOrdemServicoBodySchema.parse(request.body);

    try {
      const ordemServico = await atualizarOrdemServicoUseCase.execute({
        ordemServicoId: id,
        descricaoProblema: body.descricao_problema,
        enderecoAtendimento: body.endereco_atendimento,
        prioridade: body.prioridade,
        dataAgendada: body.data_agendada,
      });
      return reply.status(200).send(await montarOrdemServicoResponse(ordemServico, deveOcultarValor(request.user!.papel)));
    } catch (error) {
      relancarComoAppError(error);
    }
  });

  app.patch('/ordens-servico/:id/status', equipeOperacional, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const body = atualizarStatusBodySchema.parse(request.body);

    try {
      const ordemServicoAtual = await buscarOrdemServicoUseCase.execute(id);
      garantirAcessoTecnico(ordemServicoAtual, request.user!.id, request.user!.papel);

      const ordemServico = await atualizarStatusOrdemServicoUseCase.execute({
        ordemServicoId: id,
        statusNovo: body.status,
        papelUsuario: request.user!.papel,
        usuarioId: request.user!.id,
        observacao: body.observacao,
      });
      return reply
        .status(200)
        .send(await montarOrdemServicoResponse(ordemServico, deveOcultarValor(request.user!.papel)));
    } catch (error) {
      relancarComoAppError(error);
    }
  });

  app.patch('/ordens-servico/:id/atribuir', atendenteOuAdmin, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const body = atribuirTecnicoBodySchema.parse(request.body);

    try {
      const ordemServico = await atribuirTecnicoUseCase.execute({
        ordemServicoId: id,
        tecnicoId: body.tecnico_id,
        ajudanteId: body.ajudante_id,
        usuarioId: request.user!.id,
        dataAgendada: body.data_agendada,
      });
      return reply.status(200).send(await montarOrdemServicoResponse(ordemServico, deveOcultarValor(request.user!.papel)));
    } catch (error) {
      relancarComoAppError(error);
    }
  });

  app.get('/ordens-servico/:id/disponibilidade', atendenteOuAdmin, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);

    try {
      const ordemServico = await buscarOrdemServicoUseCase.execute(id);

      if (!ordemServico.dataAgendada) {
        const todosUsuarios = await usuarioRepository.list();
        const mapearUsuario = (usuario: (typeof todosUsuarios)[number]) => ({
          id: usuario.id,
          nome: usuario.nome,
        });

        return reply.status(200).send({
          tecnicos_disponiveis: todosUsuarios
            .filter((usuario) => usuario.ativo && usuario.papel === 'tecnico')
            .map(mapearUsuario),
          ajudantes_disponiveis: todosUsuarios
            .filter((usuario) => usuario.ativo && usuario.papel === 'ajudante')
            .map(mapearUsuario),
          sem_data_agendada: true,
        });
      }

      const [tecnicosDisponiveis, ajudantesDisponiveis] = await Promise.all([
        verificarDisponibilidadeUseCase.listarTecnicosDisponiveis(
          ordemServico.dataAgendada,
          ['tecnico'],
          usuarioRepository,
        ),
        verificarDisponibilidadeUseCase.listarTecnicosDisponiveis(
          ordemServico.dataAgendada,
          ['ajudante'],
          usuarioRepository,
        ),
      ]);

      return reply.status(200).send({
        tecnicos_disponiveis: tecnicosDisponiveis.map((usuario) => ({ id: usuario.id, nome: usuario.nome })),
        ajudantes_disponiveis: ajudantesDisponiveis.map((usuario) => ({ id: usuario.id, nome: usuario.nome })),
      });
    } catch (error) {
      relancarComoAppError(error);
    }
  });

  app.patch('/ordens-servico/:id/valor', somenteAdmin, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const body = registrarValorBodySchema.parse(request.body);

    try {
      const ordemServico = await registrarValorOrdemServicoUseCase.execute({
        ordemServicoId: id,
        valorCobrado: body.valor_cobrado,
      });
      return reply.status(200).send(await montarOrdemServicoResponse(ordemServico, deveOcultarValor(request.user!.papel)));
    } catch (error) {
      relancarComoAppError(error);
    }
  });

  app.get('/ordens-servico/:id/historico', equipeOperacionalComLeituraAjudante, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const query = historicoQuerySchema.parse(request.query);

    try {
      const ordemServico = await buscarOrdemServicoUseCase.execute(id);
      garantirAcessoTecnico(ordemServico, request.user!.id, request.user!.papel);

      const resultado = await listarHistoricoOSUseCase.execute({
        ordemServicoId: id,
        page: query.page,
        pageSize: query.page_size,
      });
      return reply.status(200).send(resultado.itens.map(montarHistoricoResponse));
    } catch (error) {
      relancarComoAppError(error);
    }
  });
}

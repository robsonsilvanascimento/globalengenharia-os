import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CalcularSalvarEstimativaCustoUseCase } from '../../application/CalcularSalvarEstimativaCustoUseCase';
import { ObterEstimativaCustoUseCase } from '../../application/ObterEstimativaCustoUseCase';
import type { EstimativaCustoOS } from '../../domain/EstimativaCustoOS';
import type { EstimativaCustoOSRepository } from '../../domain/EstimativaCustoOSRepository';
import type { OrdemServicoRepository } from '../../../ordens-servico/domain/OrdemServicoRepository';
import type { UsuarioRepository } from '../../../auth/domain/UsuarioRepository';
import { NotFoundError, ValidationError } from '../../../../shared/http/errors/AppError';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const calcularEstimativaBodySchema = z.object({
  horas_estimadas_tecnico: z.number().positive(),
  horas_estimadas_ajudante: z.number().nonnegative().optional(),
  custo_combustivel: z.number().nonnegative().default(0),
  custo_pedagio: z.number().nonnegative().default(0),
  custo_desgaste_veiculo: z.number().nonnegative().default(0),
  custo_almoco: z.number().nonnegative().default(0),
  custo_janta: z.number().nonnegative().default(0),
  custo_estadia: z.number().nonnegative().default(0),
  turno: z.enum(['diurno', 'noturno']).default('diurno'),
  custo_adicional_noturno: z.number().nonnegative().default(0),
  outros_custos: z.number().nonnegative().default(0),
});

export interface EstimativaCustoRoutesDeps {
  estimativaCustoOSRepository: EstimativaCustoOSRepository;
  ordemServicoRepository: OrdemServicoRepository;
  usuarioRepository: UsuarioRepository;
}

function montarEstimativaResponse(estimativa: EstimativaCustoOS) {
  return {
    id: estimativa.id,
    ordem_servico_id: estimativa.ordemServicoId,
    horas_estimadas_tecnico: estimativa.horasEstimadasTecnico,
    valor_hora_tecnico: estimativa.valorHoraTecnico,
    horas_estimadas_ajudante: estimativa.horasEstimadasAjudante ?? null,
    valor_hora_ajudante: estimativa.valorHoraAjudante ?? null,
    custo_combustivel: estimativa.custoCombustivel,
    custo_pedagio: estimativa.custoPedagio,
    custo_desgaste_veiculo: estimativa.custoDesgasteVeiculo,
    custo_almoco: estimativa.custoAlmoco,
    custo_janta: estimativa.custoJanta,
    custo_estadia: estimativa.custoEstadia,
    turno: estimativa.turno,
    custo_adicional_noturno: estimativa.custoAdicionalNoturno,
    outros_custos: estimativa.outrosCustos,
    custo_total: estimativa.custoTotal,
    criado_por_usuario_id: estimativa.criadoPorUsuarioId,
    criado_em: estimativa.criadoEm,
    atualizado_em: estimativa.atualizadoEm,
  };
}

/** Registra as rotas do modulo de estimativa de custo de ordens de servico. */
export function registerEstimativaCustoRoutes(app: FastifyInstance, deps: EstimativaCustoRoutesDeps): void {
  const { estimativaCustoOSRepository, ordemServicoRepository, usuarioRepository } = deps;

  // Dado financeiro sensivel: restrito a admin, mesmo padrao do valor_cobrado da OS.
  const somenteAdmin = { preHandler: [authenticate, requireRole(['admin'])] };

  const calcularSalvarEstimativaCustoUseCase = new CalcularSalvarEstimativaCustoUseCase({
    estimativaCustoOSRepository,
  });
  const obterEstimativaCustoUseCase = new ObterEstimativaCustoUseCase({ estimativaCustoOSRepository });

  app.get('/ordens-servico/:id/estimativa-custo', somenteAdmin, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);

    const ordemServico = await ordemServicoRepository.findById(id);
    if (!ordemServico) {
      throw new NotFoundError('Ordem de servico nao encontrada');
    }

    const estimativa = await obterEstimativaCustoUseCase.execute(id);

    // "Ainda nao calculada" e um estado normal da OS, nao um erro — 200 com
    // corpo null em vez de 404 (nao ha padrao equivalente pre-existente no
    // projeto para "recurso 1:1 opcional"; este e o primeiro caso).
    return reply.status(200).send(estimativa ? montarEstimativaResponse(estimativa) : null);
  });

  app.put('/ordens-servico/:id/estimativa-custo', somenteAdmin, async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const body = calcularEstimativaBodySchema.parse(request.body);

    const ordemServico = await ordemServicoRepository.findById(id);
    if (!ordemServico) {
      throw new NotFoundError('Ordem de servico nao encontrada');
    }

    if (!ordemServico.tecnicoId) {
      throw new ValidationError('A ordem de servico nao possui tecnico atribuido');
    }

    const tecnico = await usuarioRepository.findById(ordemServico.tecnicoId);
    if (!tecnico || tecnico.valorHora == null) {
      throw new ValidationError('O tecnico atribuido nao possui valor/hora cadastrado');
    }

    let valorHoraAjudante: number | undefined;
    if (body.horas_estimadas_ajudante !== undefined) {
      if (!ordemServico.ajudanteId) {
        throw new ValidationError('A ordem de servico nao possui ajudante atribuido');
      }

      const ajudante = await usuarioRepository.findById(ordemServico.ajudanteId);
      if (!ajudante || ajudante.valorHora == null) {
        throw new ValidationError('O ajudante atribuido nao possui valor/hora cadastrado');
      }

      valorHoraAjudante = ajudante.valorHora;
    }

    const estimativa = await calcularSalvarEstimativaCustoUseCase.execute({
      ordemServicoId: id,
      horasEstimadasTecnico: body.horas_estimadas_tecnico,
      valorHoraTecnico: tecnico.valorHora,
      horasEstimadasAjudante: body.horas_estimadas_ajudante,
      valorHoraAjudante,
      custoCombustivel: body.custo_combustivel,
      custoPedagio: body.custo_pedagio,
      custoDesgasteVeiculo: body.custo_desgaste_veiculo,
      custoAlmoco: body.custo_almoco,
      custoJanta: body.custo_janta,
      custoEstadia: body.custo_estadia,
      turno: body.turno,
      custoAdicionalNoturno: body.custo_adicional_noturno,
      outrosCustos: body.outros_custos,
      criadoPorUsuarioId: request.user!.id,
    });

    return reply.status(200).send(montarEstimativaResponse(estimativa));
  });
}

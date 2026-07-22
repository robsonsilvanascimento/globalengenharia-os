import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';
import { NotFoundError } from '../../../../shared/http/errors/AppError';
import type { ClienteRepository } from '../../../clientes/domain/ClienteRepository';
import type { ContaReceber } from '../../domain/ContaReceber';
import type { ContaReceberComCliente, ContaReceberRepository } from '../../domain/ContaReceberRepository';
import type { ContratoComCliente, ContratoRecorrenteRepository } from '../../domain/ContratoRecorrenteRepository';
import { CriarContaReceberUseCase } from '../../application/CriarContaReceberUseCase';
import { BaixarContaReceberUseCase } from '../../application/BaixarContaReceberUseCase';
import { CancelarContaReceberUseCase } from '../../application/CancelarContaReceberUseCase';
import { CriarContratoUseCase } from '../../application/CriarContratoUseCase';
import { GerarCobrancasRecorrentesUseCase } from '../../application/GerarCobrancasRecorrentesUseCase';

const idParams = z.object({ id: z.string().uuid() });

const listarContasQuery = z.object({
  status: z.enum(['aberta', 'paga', 'vencida', 'cancelada']).optional(),
  cliente_id: z.string().uuid().optional(),
  contrato_id: z.string().uuid().optional(),
  vencimento_inicio: z.string().datetime().optional(),
  vencimento_fim: z.string().datetime().optional(),
});

const criarContaBody = z.object({
  cliente_id: z.string().uuid(),
  descricao: z.string().min(1).max(500),
  valor: z.number().positive(),
  vencimento_em: z.string().datetime(),
  observacao: z.string().max(2000).nullable().optional(),
});

const baixaBody = z.object({
  valor_pago: z.number().positive().optional(),
  forma_pagamento: z.string().max(50).nullable().optional(),
  pago_em: z.string().datetime().optional(),
});

const listarContratosQuery = z.object({
  ativo: z.enum(['true', 'false']).optional(),
  cliente_id: z.string().uuid().optional(),
});

const criarContratoBody = z.object({
  cliente_id: z.string().uuid(),
  descricao: z.string().min(1).max(500),
  valor: z.number().positive(),
  periodicidade: z.enum(['semanal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual']),
  data_inicio: z.string().datetime(),
  data_fim: z.string().datetime().nullable().optional(),
});

function contaResponse(c: ContaReceber & { clienteNome?: string }) {
  return {
    id: c.id,
    numero: c.numero,
    cliente_id: c.clienteId,
    cliente_nome: c.clienteNome ?? null,
    contrato_id: c.contratoId,
    descricao: c.descricao,
    valor: c.valor,
    vencimento_em: c.vencimentoEm,
    status: c.status,
    pago_em: c.pagoEm,
    valor_pago: c.valorPago,
    forma_pagamento: c.formaPagamento,
    observacao: c.observacao,
    criado_em: c.criadoEm,
  };
}

function contratoResponse(c: ContratoComCliente) {
  return {
    id: c.id,
    cliente_id: c.clienteId,
    cliente_nome: c.clienteNome,
    descricao: c.descricao,
    valor: c.valor,
    periodicidade: c.periodicidade,
    proxima_cobranca_em: c.proximaCobrancaEm,
    data_inicio: c.dataInicio,
    data_fim: c.dataFim,
    ativo: c.ativo,
    criado_em: c.criadoEm,
  };
}

function resumoContas(contas: ContaReceberComCliente[]) {
  const resumo = { total_aberto: 0, total_vencido: 0, total_recebido: 0, quantidade: contas.length };
  for (const c of contas) {
    if (c.status === 'aberta') resumo.total_aberto += c.valor;
    else if (c.status === 'vencida') resumo.total_vencido += c.valor;
    else if (c.status === 'paga') resumo.total_recebido += c.valorPago ?? c.valor;
  }
  return resumo;
}

export interface FinanceiroRecorrenteRoutesDeps {
  contaReceberRepository: ContaReceberRepository;
  contratoRecorrenteRepository: ContratoRecorrenteRepository;
  clienteRepository: ClienteRepository;
}

export function registerFinanceiroRecorrenteRoutes(app: FastifyInstance, deps: FinanceiroRecorrenteRoutesDeps): void {
  const { contaReceberRepository, contratoRecorrenteRepository, clienteRepository } = deps;
  const somenteAdmin = { preHandler: [authenticate, requireRole(['admin'])] };

  const criarContaUseCase = new CriarContaReceberUseCase({ contaReceberRepository });
  const baixarContaUseCase = new BaixarContaReceberUseCase({ contaReceberRepository });
  const cancelarContaUseCase = new CancelarContaReceberUseCase({ contaReceberRepository });
  const criarContratoUseCase = new CriarContratoUseCase({ contratoRecorrenteRepository });
  const gerarCobrancasUseCase = new GerarCobrancasRecorrentesUseCase({
    contratoRecorrenteRepository,
    contaReceberRepository,
  });

  async function garantirCliente(clienteId: string): Promise<void> {
    const cliente = await clienteRepository.findById(clienteId);
    if (!cliente) throw new NotFoundError('Cliente nao encontrado');
  }

  // ===== Contas a receber =====

  app.get('/contas-receber', somenteAdmin, async (request, reply) => {
    const q = listarContasQuery.parse(request.query);
    const contas = await contaReceberRepository.listar({
      status: q.status,
      clienteId: q.cliente_id,
      contratoId: q.contrato_id,
      vencimentoInicio: q.vencimento_inicio ? new Date(q.vencimento_inicio) : undefined,
      vencimentoFim: q.vencimento_fim ? new Date(q.vencimento_fim) : undefined,
    });
    return reply.status(200).send({ contas: contas.map(contaResponse), resumo: resumoContas(contas) });
  });

  app.post('/contas-receber', somenteAdmin, async (request, reply) => {
    const body = criarContaBody.parse(request.body);
    await garantirCliente(body.cliente_id);
    const conta = await criarContaUseCase.execute({
      clienteId: body.cliente_id,
      descricao: body.descricao,
      valor: body.valor,
      vencimentoEm: new Date(body.vencimento_em),
      observacao: body.observacao,
      criadoPorId: request.user!.id,
    });
    return reply.status(201).send(contaResponse(conta));
  });

  app.post('/contas-receber/:id/baixa', somenteAdmin, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = baixaBody.parse(request.body ?? {});
    const conta = await baixarContaUseCase.execute({
      id,
      valorPago: body.valor_pago,
      formaPagamento: body.forma_pagamento,
      pagoEm: body.pago_em ? new Date(body.pago_em) : undefined,
    });
    return reply.status(200).send(contaResponse(conta));
  });

  app.post('/contas-receber/:id/cancelar', somenteAdmin, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const conta = await cancelarContaUseCase.execute(id);
    return reply.status(200).send(contaResponse(conta));
  });

  // ===== Contratos recorrentes =====

  app.get('/contratos-recorrentes', somenteAdmin, async (request, reply) => {
    const q = listarContratosQuery.parse(request.query);
    const contratos = await contratoRecorrenteRepository.listar({
      ativo: q.ativo === undefined ? undefined : q.ativo === 'true',
      clienteId: q.cliente_id,
    });
    return reply.status(200).send(contratos.map(contratoResponse));
  });

  app.post('/contratos-recorrentes', somenteAdmin, async (request, reply) => {
    const body = criarContratoBody.parse(request.body);
    await garantirCliente(body.cliente_id);
    const contrato = await criarContratoUseCase.execute({
      clienteId: body.cliente_id,
      descricao: body.descricao,
      valor: body.valor,
      periodicidade: body.periodicidade,
      dataInicio: new Date(body.data_inicio),
      dataFim: body.data_fim ? new Date(body.data_fim) : null,
      criadoPorId: request.user!.id,
    });
    return reply.status(201).send(contratoResponse({ ...contrato, clienteNome: '' }));
  });

  app.post('/contratos-recorrentes/:id/ativar', somenteAdmin, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const existente = await contratoRecorrenteRepository.buscarPorId(id);
    if (!existente) throw new NotFoundError('Contrato nao encontrado');
    const contrato = await contratoRecorrenteRepository.definirAtivo(id, true);
    return reply.status(200).send(contratoResponse({ ...contrato, clienteNome: '' }));
  });

  app.post('/contratos-recorrentes/:id/desativar', somenteAdmin, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const existente = await contratoRecorrenteRepository.buscarPorId(id);
    if (!existente) throw new NotFoundError('Contrato nao encontrado');
    const contrato = await contratoRecorrenteRepository.definirAtivo(id, false);
    return reply.status(200).send(contratoResponse({ ...contrato, clienteNome: '' }));
  });

  // Faturamento manual (mesmo processo do worker diario) — util para o admin
  // gerar as cobrancas devidas na hora, sem esperar o cron.
  app.post('/contratos-recorrentes/faturar', somenteAdmin, async (_request, reply) => {
    const resultado = await gerarCobrancasUseCase.execute();
    return reply.status(200).send({
      contas_geradas: resultado.contasGeradas,
      contratos_processados: resultado.contratosProcessados,
    });
  });
}

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';
import { NotFoundError, ValidationError } from '../../../../shared/http/errors/AppError';
import { gerarOrcamentoPdf } from '../../../../shared/infra/pdf/GerarOrcamentoService';
import { enviarDocumento } from '../../../whatsapp/infrastructure/MetaCloudApiClient';
import { logger } from '../../../../shared/infra/Logger';
import { montarLinkAprovacaoOrcamento } from '../../application/montarLinkAprovacaoOrcamento';
import type { OrdemServicoRepository } from '../../../ordens-servico/domain/OrdemServicoRepository';
import type { OrcamentoOSRepository } from '../../domain/OrcamentoOSRepository';
import { CriarOrcamentoUseCase } from '../../application/CriarOrcamentoUseCase';
import { ObterOrcamentoUseCase } from '../../application/ObterOrcamentoUseCase';
import { ResponderOrcamentoUseCase } from '../../application/ResponderOrcamentoUseCase';

const osIdParams = z.object({ id: z.string().uuid() });
const tokenParams = z.object({ token: z.string().min(32) });
const responderBody = z.object({ decisao: z.enum(['aprovar', 'recusar']) });

const criarOrcamentoBody = z.object({
  itens: z
    .array(
      z.object({
        descricao: z.string().min(1),
        valor: z.number().positive(),
      }),
    )
    .min(1),
  observacao: z.string().optional(),
});

export interface OrcamentoRoutesDeps {
  orcamentoRepository: OrcamentoOSRepository;
  ordemServicoRepository: OrdemServicoRepository;
  /** Efeito aplicado na OS quando o cliente aprova o orcamento (parte 5). */
  aoAprovarOrcamento?: (ordemServicoId: string) => Promise<void>;
}

export function registerOrcamentoRoutes(app: FastifyInstance, deps: OrcamentoRoutesDeps): void {
  const atendenteOuAdmin = { preHandler: [authenticate, requireRole(['atendente', 'admin'])] };

  const criarOrcamentoUseCase = new CriarOrcamentoUseCase(deps);
  const obterOrcamentoUseCase = new ObterOrcamentoUseCase({ orcamentoRepository: deps.orcamentoRepository });
  const responderOrcamentoUseCase = new ResponderOrcamentoUseCase({
    orcamentoRepository: deps.orcamentoRepository,
    aoAprovar: deps.aoAprovarOrcamento
      ? (orcamento) => deps.aoAprovarOrcamento!(orcamento.ordemServicoId)
      : undefined,
  });

  app.post('/ordens-servico/:id/orcamento', atendenteOuAdmin, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);
    const body = criarOrcamentoBody.parse(request.body);

    const orcamento = await criarOrcamentoUseCase.execute({
      ordemServicoId: id,
      itens: body.itens,
      observacao: body.observacao,
      criadoPorId: request.user!.id,
    });

    return reply.status(201).send(orcamento);
  });

  app.get('/ordens-servico/:id/orcamento', atendenteOuAdmin, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);
    const orcamento = await obterOrcamentoUseCase.execute(id);
    return reply.status(200).send(orcamento);
  });

  // Gera a proposta e a envia ao cliente pelo WhatsApp (PDF + link do portal
  // para aprovar/recusar). Marca o orcamento como enviado ao ter sucesso.
  app.post('/ordens-servico/:id/orcamento/enviar', atendenteOuAdmin, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);
    const orcamento = await obterOrcamentoUseCase.execute(id);

    if (orcamento.status === 'aprovado') {
      throw new ValidationError('Orcamento ja aprovado pelo cliente');
    }

    const os = await deps.ordemServicoRepository.findByIdCompleto(id);
    if (!os) throw new NotFoundError('Ordem de servico nao encontrada');
    if (!os.cliente.telefoneWhatsapp) {
      throw new ValidationError('Cliente sem telefone de WhatsApp cadastrado');
    }

    const pdf = await gerarOrcamentoPdf({
      numeroOS: os.numero,
      clienteNome: os.cliente.nome,
      emitidoEm: orcamento.criadoEm,
      itens: orcamento.itens,
      valorTotal: orcamento.valorTotal,
      observacao: orcamento.observacao,
    });

    const link = montarLinkAprovacaoOrcamento(orcamento.tokenAprovacao);
    const legenda =
      `Segue o orçamento da sua Ordem de Serviço ${os.numero}. ` +
      `Para aprovar ou recusar, acesse: ${link}`;

    const resultado = await enviarDocumento(
      os.cliente.telefoneWhatsapp,
      pdf,
      `orcamento-${os.numero}.pdf`,
      'application/pdf',
      legenda,
    );

    if (!resultado.sucesso) {
      logger.error(
        { ordemServicoId: id, erro: resultado.erro, codigoErro: resultado.codigoErro },
        'Falha ao enviar orcamento via WhatsApp',
      );
      return reply.status(502).send({ error: 'Falha ao enviar pelo WhatsApp', detalhe: resultado.erro });
    }

    const atualizado = await deps.orcamentoRepository.marcarEnviado(orcamento.id, new Date());
    return reply.status(200).send({ enviado: true, link, orcamento: atualizado });
  });

  // PDF da proposta, para download/visualizacao pela equipe.
  app.get('/ordens-servico/:id/orcamento/pdf', atendenteOuAdmin, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);
    const orcamento = await obterOrcamentoUseCase.execute(id);
    const os = await deps.ordemServicoRepository.findByIdCompleto(id);
    if (!os) throw new NotFoundError('Ordem de servico nao encontrada');

    const pdf = await gerarOrcamentoPdf({
      numeroOS: os.numero,
      clienteNome: os.cliente.nome,
      emitidoEm: orcamento.criadoEm,
      itens: orcamento.itens,
      valorTotal: orcamento.valorTotal,
      observacao: orcamento.observacao,
    });

    return reply
      .status(200)
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="orcamento-${os.numero}.pdf"`)
      .send(pdf);
  });

  // --- Rotas publicas (sem login): o cliente acessa pelo link com o token ---

  // Dados do orcamento para a pagina de aprovacao do cliente.
  app.get('/orcamentos/aprovacao/:token', async (request, reply) => {
    const { token } = tokenParams.parse(request.params);
    const orcamento = await deps.orcamentoRepository.buscarPorToken(token);
    if (!orcamento) throw new NotFoundError('Orcamento nao encontrado');

    const os = await deps.ordemServicoRepository.findByIdCompleto(orcamento.ordemServicoId);

    return reply.status(200).send({
      numero_os: os?.numero ?? null,
      cliente_nome: os?.cliente.nome ?? null,
      status: orcamento.status,
      itens: orcamento.itens,
      valor_total: orcamento.valorTotal,
      observacao: orcamento.observacao,
      respondido_em: orcamento.respondidoEm,
    });
  });

  // Cliente aprova ou recusa o orcamento pelo link.
  app.post('/orcamentos/aprovacao/:token', async (request, reply) => {
    const { token } = tokenParams.parse(request.params);
    const body = responderBody.parse(request.body);

    const { orcamento } = await responderOrcamentoUseCase.execute(token, body.decisao);

    return reply.status(200).send({ status: orcamento.status, respondido_em: orcamento.respondidoEm });
  });
}

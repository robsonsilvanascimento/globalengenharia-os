import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ListarSolicitacoesAtendimentoUseCase } from '../../application/ListarSolicitacoesAtendimentoUseCase';
import {
  ResponderSolicitacaoAtendimentoUseCase,
  type CriarFaqEntryPort,
} from '../../application/ResponderSolicitacaoAtendimentoUseCase';
import type { SolicitacaoAtendimento } from '../../domain/SolicitacaoAtendimento';
import type { SolicitacaoAtendimentoRepository } from '../../domain/SolicitacaoAtendimentoRepository';
import type { ClienteRepository } from '../../../clientes/domain/ClienteRepository';
import { enviarTexto } from '../../../whatsapp/infrastructure/MetaCloudApiClient';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';

const statusSchema = z.enum(['pendente', 'respondida']);

const listQuerySchema = z.object({
  status: statusSchema.optional(),
});

const responderBodySchema = z.object({
  resposta_texto: z.string().min(1).max(5000),
  salvar_como_faq: z.boolean().optional(),
});

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

export interface AtendimentoHumanoRoutesDeps {
  solicitacaoAtendimentoRepository: SolicitacaoAtendimentoRepository;
  clienteRepository: ClienteRepository;
  /** Opcional: quando ausente, respostas com salvar_como_faq=true nao criam FaqEntry (ver ResponderSolicitacaoAtendimentoUseCase). */
  criarFaqEntry?: CriarFaqEntryPort;
}

/** Monta o DTO HTTP (snake_case) de uma SolicitacaoAtendimento. */
function montarSolicitacaoResponse(solicitacao: SolicitacaoAtendimento, clienteNome?: string) {
  return {
    id: solicitacao.id,
    cliente_id: solicitacao.clienteId,
    cliente_nome: clienteNome ?? null,
    conversa_id: solicitacao.conversaId,
    mensagem_cliente: solicitacao.mensagemCliente,
    status: solicitacao.status,
    resposta_texto: solicitacao.respostaTexto,
    respondido_por_usuario_id: solicitacao.respondidoPorUsuarioId,
    salvar_como_faq: solicitacao.salvarComoFaq,
    criado_em: solicitacao.criadoEm,
    respondido_em: solicitacao.respondidoEm,
  };
}

/** Busca os nomes dos clientes das solicitacoes em lote (uma unica leitura por cliente). */
async function montarSolicitacoesResponseEmLote(
  solicitacoes: SolicitacaoAtendimento[],
  clienteRepository: ClienteRepository,
) {
  const clienteIds = [...new Set(solicitacoes.map((s) => s.clienteId))];
  const clientesEncontrados = await Promise.all(
    clienteIds.map((id) => clienteRepository.findById(id)),
  );
  const nomesPorClienteId = new Map(
    clientesEncontrados
      .filter((cliente): cliente is NonNullable<typeof cliente> => cliente !== null)
      .map((cliente) => [cliente.id, cliente.nome]),
  );

  return solicitacoes.map((solicitacao) =>
    montarSolicitacaoResponse(solicitacao, nomesPorClienteId.get(solicitacao.clienteId)),
  );
}

/** Registra as rotas do modulo de atendimento humano. */
export function registerAtendimentoHumanoRoutes(
  app: FastifyInstance,
  deps: AtendimentoHumanoRoutesDeps,
): void {
  const { solicitacaoAtendimentoRepository, clienteRepository, criarFaqEntry } = deps;

  const atendenteOuAdmin = { preHandler: [authenticate, requireRole(['atendente', 'admin'])] };

  const listarSolicitacoesAtendimentoUseCase = new ListarSolicitacoesAtendimentoUseCase({
    solicitacaoAtendimentoRepository,
  });
  const responderSolicitacaoAtendimentoUseCase = new ResponderSolicitacaoAtendimentoUseCase({
    solicitacaoAtendimentoRepository,
    criarFaqEntry,
  });

  app.get('/solicitacoes-atendimento', atendenteOuAdmin, async (request, reply) => {
    const query = listQuerySchema.parse(request.query);

    const solicitacoes = await listarSolicitacoesAtendimentoUseCase.execute(query.status);

    return reply.status(200).send(await montarSolicitacoesResponseEmLote(solicitacoes, clienteRepository));
  });

  app.patch(
    '/solicitacoes-atendimento/:id/responder',
    atendenteOuAdmin,
    async (request, reply) => {
      const { id } = idParamsSchema.parse(request.params);
      const body = responderBodySchema.parse(request.body);

      const resultado = await responderSolicitacaoAtendimentoUseCase.execute({
        solicitacaoId: id,
        respostaTexto: body.resposta_texto,
        respondidoPorUsuarioId: request.user!.id,
        salvarComoFaq: body.salvar_como_faq ?? false,
      });

      const cliente = await clienteRepository.findById(resultado.solicitacao.clienteId);
      if (cliente) {
        await enviarTexto(cliente.telefoneWhatsapp, body.resposta_texto);
      }

      return reply.status(200).send(montarSolicitacaoResponse(resultado.solicitacao, cliente?.nome));
    },
  );
}

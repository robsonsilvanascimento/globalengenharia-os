import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { FotoServicoRepository } from '../../domain/FotoServicoRepository';
import type { OrdemServicoRepository } from '../../../ordens-servico/domain/OrdemServicoRepository';
import { AdicionarFotoServicoUseCase } from '../../application/AdicionarFotoServicoUseCase';
import { ListarFotosServicoUseCase } from '../../application/ListarFotosServicoUseCase';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';
import { NotFoundError, ValidationError } from '../../../../shared/http/errors/AppError';
import { gerarRelatorioFotografico } from '../../../../shared/infra/pdf/GerarRelatorioFotograficoService';
import { enviarDocumento } from '../../../whatsapp/infrastructure/MetaCloudApiClient';
import { logger } from '../../../../shared/infra/Logger';

const osIdParams = z.object({ id: z.string().uuid() });

const adicionarFotoBody = z.object({
  mime_type: z.enum(['image/jpeg', 'image/png']),
  base64: z.string().min(1),
  legenda: z.string().optional(),
  momento: z.enum(['antes', 'depois']).optional(),
});

export interface FotosServicoRoutesDeps {
  fotoServicoRepository: FotoServicoRepository;
  ordemServicoRepository: OrdemServicoRepository;
}

export function registerFotosServicoRoutes(
  app: FastifyInstance,
  deps: FotosServicoRoutesDeps,
): void {
  const { fotoServicoRepository, ordemServicoRepository } = deps;

  const adminOuTecnico = { preHandler: [authenticate, requireRole(['admin', 'tecnico'])] };
  const equipe = { preHandler: [authenticate, requireRole(['admin', 'tecnico', 'atendente'])] };
  const adminOuAtendente = { preHandler: [authenticate, requireRole(['admin', 'atendente'])] };

  /** Monta os dados do relatorio (OS + fotos) ou lanca erro de dominio. */
  async function montarDadosRelatorio(ordemServicoId: string) {
    const os = await ordemServicoRepository.findByIdCompleto(ordemServicoId);
    if (!os) throw new NotFoundError('Ordem de servico nao encontrada');

    const fotos = await fotoServicoRepository.findByOrdemServico(ordemServicoId);
    if (fotos.length === 0) {
      throw new ValidationError('Nenhuma foto registrada para esta OS');
    }

    return {
      cliente: os.cliente,
      dados: {
        numeroOS: os.numero,
        clienteNome: os.cliente.nome,
        emitidoEm: new Date(),
        fotos: fotos.map((foto) => ({
          base64: foto.base64,
          mimeType: foto.mimeType,
          legenda: foto.legenda,
          momento: foto.momento,
        })),
      },
    };
  }

  const adicionarFotoUseCase = new AdicionarFotoServicoUseCase({
    fotoServicoRepository,
    ordemServicoRepository,
  });

  const listarFotosUseCase = new ListarFotosServicoUseCase({
    fotoServicoRepository,
    ordemServicoRepository,
  });

  app.post('/ordens-servico/:id/fotos-servico', adminOuTecnico, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);
    const body = adicionarFotoBody.parse(request.body);
    const usuario = request.user as { id: string } | undefined;

    const foto = await adicionarFotoUseCase.execute({
      ordemServicoId: id,
      mimeType: body.mime_type,
      base64: body.base64,
      legenda: body.legenda,
      momento: body.momento,
      enviadoPorId: usuario?.id ?? null,
    });

    return reply.status(201).send(foto);
  });

  app.get('/ordens-servico/:id/fotos-servico', adminOuTecnico, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);

    const fotos = await listarFotosUseCase.execute(id);

    return reply.status(200).send({ fotos });
  });

  // Relatorio fotografico comparativo (antes/depois) em PDF, para download.
  app.get('/ordens-servico/:id/relatorio-fotografico', equipe, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);
    const { dados } = await montarDadosRelatorio(id);

    const pdf = await gerarRelatorioFotografico(dados);

    return reply
      .status(200)
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="relatorio-fotografico-${dados.numeroOS}.pdf"`)
      .send(pdf);
  });

  // Gera o relatorio e entrega ao cliente via WhatsApp.
  app.post('/ordens-servico/:id/relatorio-fotografico/enviar', adminOuAtendente, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);
    const { cliente, dados } = await montarDadosRelatorio(id);

    if (!cliente.telefoneWhatsapp) {
      throw new ValidationError('Cliente sem telefone de WhatsApp cadastrado');
    }

    const pdf = await gerarRelatorioFotografico(dados);
    const resultado = await enviarDocumento(
      cliente.telefoneWhatsapp,
      pdf,
      `relatorio-fotografico-${dados.numeroOS}.pdf`,
      'application/pdf',
      `Relatório fotográfico da sua Ordem de Serviço ${dados.numeroOS}.`,
    );

    if (!resultado.sucesso) {
      logger.error(
        { ordemServicoId: id, erro: resultado.erro, codigoErro: resultado.codigoErro },
        'Falha ao enviar relatorio fotografico via WhatsApp',
      );
      return reply.status(502).send({ error: 'Falha ao enviar pelo WhatsApp', detalhe: resultado.erro });
    }

    return reply.status(200).send({ enviado: true, messageId: resultado.messageId });
  });
}

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ComponenteInstaladoRepository } from '../../domain/ComponenteInstaladoRepository';
import type { DocumentoOSRepository } from '../../domain/DocumentoOSRepository';
import type { OrdemServicoRepository } from '../../../ordens-servico/domain/OrdemServicoRepository';
import type { ArmazenamentoArquivoService } from '../../../../shared/infra/storage/ArmazenamentoArquivoService';
import { RegistrarComponenteUseCase } from '../../application/RegistrarComponenteUseCase';
import { AdicionarDocumentoOSUseCase } from '../../application/AdicionarDocumentoOSUseCase';
import { ListarRastreabilidadeOSUseCase } from '../../application/ListarRastreabilidadeOSUseCase';
import { NotFoundError } from '../../../../shared/http/errors/AppError';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';

const osIdParams = z.object({ id: z.string().uuid() });
const docIdParams = z.object({ id: z.string().uuid(), docId: z.string().uuid() });

const registrarComponenteBody = z.object({
  nome: z.string().min(1).max(200),
  fabricante: z.string().max(200).optional(),
  modelo: z.string().max(200).optional(),
  numero_serie: z.string().max(100).optional(),
  codigo_barras: z.string().max(100).optional(),
  garantia_meses: z.number().int().min(1).optional(),
  observacoes: z.string().max(2000).optional(),
});

const TIPOS_DOCUMENTO = [
  'certificado_garantia',
  'manual',
  'laudo_tecnico',
  'nota_fiscal',
  'foto',
  'outro',
] as const;

export interface RastreabilidadeRoutesDeps {
  componenteInstaladoRepository: ComponenteInstaladoRepository;
  documentoOSRepository: DocumentoOSRepository;
  ordemServicoRepository: OrdemServicoRepository;
  armazenamentoArquivoService: ArmazenamentoArquivoService;
}

export function registerRastreabilidadeRoutes(
  app: FastifyInstance,
  deps: RastreabilidadeRoutesDeps,
): void {
  const { componenteInstaladoRepository, documentoOSRepository, ordemServicoRepository, armazenamentoArquivoService } = deps;

  const adminOuTecnico = { preHandler: [authenticate, requireRole(['admin', 'tecnico'])] };
  const somenteAdmin = { preHandler: [authenticate, requireRole(['admin'])] };

  const registrarComponenteUseCase = new RegistrarComponenteUseCase({ componenteInstaladoRepository });
  const adicionarDocumentoUseCase = new AdicionarDocumentoOSUseCase({
    documentoOSRepository,
    componenteInstaladoRepository,
  });
  const listarRastreabilidadeUseCase = new ListarRastreabilidadeOSUseCase({
    componenteInstaladoRepository,
    documentoOSRepository,
  });

  async function garantirOS(id: string) {
    const os = await ordemServicoRepository.findById(id);
    if (!os) throw new NotFoundError('Ordem de servico nao encontrada');
    return os;
  }

  // GET /ordens-servico/:id/rastreabilidade — visao completa para auditoria
  app.get('/ordens-servico/:id/rastreabilidade', adminOuTecnico, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);
    await garantirOS(id);
    const dados = await listarRastreabilidadeUseCase.execute(id);
    return reply.status(200).send(dados);
  });

  // POST /ordens-servico/:id/componentes — registrar componente instalado
  app.post('/ordens-servico/:id/componentes', adminOuTecnico, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);
    await garantirOS(id);

    const body = registrarComponenteBody.parse(request.body);
    const usuario = request.user as { id: string } | undefined;

    const componente = await registrarComponenteUseCase.execute({
      ordemServicoId: id,
      nome: body.nome,
      fabricante: body.fabricante,
      modelo: body.modelo,
      numeroSerie: body.numero_serie,
      codigoBarras: body.codigo_barras,
      garantiaMeses: body.garantia_meses,
      observacoes: body.observacoes,
      criadoPorUsuarioId: usuario?.id,
    });

    return reply.status(201).send(componente);
  });

  const adicionarDocumentoBody = z.object({
    nome: z.string().min(1).max(200),
    tipo_documento: z.enum(TIPOS_DOCUMENTO),
    componente_instalado_id: z.string().uuid().optional(),
    mime_type: z.string().min(1).max(100),
    nome_arquivo: z.string().min(1).max(255),
    // conteudo do arquivo em base64 — sem .max() aqui de proposito: ja e limitado
    // pelo bodyLimit padrao do Fastify (1MB por request), suficiente pra nao
    // precisar de um segundo limite especifico deste campo.
    conteudo_base64: z.string().min(1),
  });

  // POST /ordens-servico/:id/documentos — upload de documento (JSON + base64)
  app.post('/ordens-servico/:id/documentos', adminOuTecnico, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);
    await garantirOS(id);

    const body = adicionarDocumentoBody.parse(request.body);
    const buffer = Buffer.from(body.conteudo_base64, 'base64');

    const { chave } = await armazenamentoArquivoService.salvar(
      buffer,
      body.nome_arquivo,
      `documentos-os/${id}`,
    );

    const usuario = request.user as { id: string } | undefined;

    const documento = await adicionarDocumentoUseCase.execute({
      ordemServicoId: id,
      componenteInstaladoId: body.componente_instalado_id,
      nome: body.nome,
      tipoDocumento: body.tipo_documento,
      caminhoArmazenamento: chave,
      mimeType: body.mime_type,
      tamanhoBytes: buffer.length,
      carregadoPorUsuarioId: usuario?.id,
    });

    return reply.status(201).send(documento);
  });

  // GET /ordens-servico/:id/documentos/:docId/arquivo — download do documento
  app.get('/ordens-servico/:id/documentos/:docId/arquivo', adminOuTecnico, async (request, reply) => {
    const { id, docId } = docIdParams.parse(request.params);
    await garantirOS(id);

    const doc = await documentoOSRepository.findById(docId);
    if (!doc || doc.ordemServicoId !== id || !doc.ativo) {
      throw new NotFoundError('Documento nao encontrado para esta ordem de servico');
    }

    const conteudo = await armazenamentoArquivoService.lerArquivo(doc.caminhoArmazenamento);

    const nomeSeguro = doc.nome.replace(/[^a-zA-Z0-9._-]/g, '_');
    reply.header('Content-Disposition', `attachment; filename="${nomeSeguro}"`);
    reply.header('X-Content-Type-Options', 'nosniff');
    return reply.type(doc.mimeType).send(conteudo);
  });

  // DELETE /ordens-servico/:id/documentos/:docId — desativar documento (soft delete)
  app.delete('/ordens-servico/:id/documentos/:docId', somenteAdmin, async (request, reply) => {
    const { id, docId } = docIdParams.parse(request.params);
    await garantirOS(id);

    const doc = await documentoOSRepository.findById(docId);
    if (!doc || doc.ordemServicoId !== id || !doc.ativo) {
      throw new NotFoundError('Documento nao encontrado para esta ordem de servico');
    }

    await documentoOSRepository.deactivate(docId);
    return reply.status(204).send();
  });
}

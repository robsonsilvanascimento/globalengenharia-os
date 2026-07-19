import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../../../../shared/http/middlewares/auth';
import { NotFoundError } from '../../../../shared/http/errors/AppError';
import { gerarLaudoPdf, type FotoLaudoPdf } from '../../../../shared/infra/pdf/GerarLaudoPdfService';
import type { ArmazenamentoArquivoService } from '../../../../shared/infra/storage/ArmazenamentoArquivoService';
import type { TrechoNormativoRepository } from '../../domain/TrechoNormativoRepository';
import type { LaudoRepository } from '../../domain/LaudoRepository';
import type { LaudoFotoRepository } from '../../domain/LaudoFotoRepository';
import { SalvarLaudoUseCase } from '../../application/SalvarLaudoUseCase';
import { AdicionarFotoLaudoUseCase } from '../../application/AdicionarFotoLaudoUseCase';
import { CATEGORIAS_TRECHO } from '../seed/trechos-normativos.seed';

const listarQuery = z.object({
  categoria: z.string().optional(),
  norma: z.string().optional(),
  busca: z.string().optional(),
});

const idParams = z.object({ id: z.string().uuid() });

const criarBody = z.object({
  norma: z.string().min(1),
  item: z.string().optional(),
  categoria: z.string().min(1),
  assunto: z.string().min(1),
  texto: z.string().min(1),
  item_verificar: z.boolean().optional(),
});

const atualizarBody = z
  .object({
    norma: z.string().min(1).optional(),
    item: z.string().nullable().optional(),
    categoria: z.string().min(1).optional(),
    assunto: z.string().min(1).optional(),
    texto: z.string().min(1).optional(),
    item_verificar: z.boolean().optional(),
    ativo: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Informe ao menos um campo' });

const osIdParams = z.object({ id: z.string().uuid() });
const laudoIdParams = z.object({ id: z.string().uuid() });
const fotoIdParams = z.object({ id: z.string().uuid(), fotoId: z.string().uuid() });

const adicionarFotoBody = z.object({
  base64: z.string().min(1),
  mime_type: z.string().min(1),
  legenda: z.string().nullable().optional(),
});

const atualizarFotoBody = z.object({
  legenda: z.string().nullable().optional(),
});

const salvarLaudoBody = z.object({
  id: z.string().uuid().optional(),
  ordem_servico_id: z.string().uuid().nullable().optional(),
  titulo: z.string().min(1),
  subtitulo: z.string().nullable().optional(),
  tipo: z.string().min(1),
  cliente_nome: z.string().nullable().optional(),
  normas_aplicaveis: z.string().nullable().optional(),
  conteudo: z.string().min(1),
  responsavel_nome: z.string().nullable().optional(),
  responsavel_crea: z.string().nullable().optional(),
  art_numero: z.string().nullable().optional(),
});

export interface LaudoTecnicoRoutesDeps {
  trechoNormativoRepository: TrechoNormativoRepository;
  laudoRepository: LaudoRepository;
  laudoFotoRepository: LaudoFotoRepository;
  armazenamentoArquivoService: ArmazenamentoArquivoService;
}

export function registerLaudoTecnicoRoutes(app: FastifyInstance, deps: LaudoTecnicoRoutesDeps): void {
  const { trechoNormativoRepository, laudoRepository, laudoFotoRepository, armazenamentoArquivoService } = deps;
  const salvarLaudoUseCase = new SalvarLaudoUseCase({ laudoRepository });
  const adicionarFotoLaudoUseCase = new AdicionarFotoLaudoUseCase({
    laudoRepository,
    laudoFotoRepository,
    armazenamentoArquivoService,
  });
  // Montagem de laudo e feita pela equipe tecnica; cadastro/edicao da
  // biblioteca de trechos fica restrito ao admin.
  const equipeTecnica = { preHandler: [authenticate, requireRole(['admin', 'tecnico', 'atendente'])] };
  const somenteAdmin = { preHandler: [authenticate, requireRole(['admin'])] };

  // Categorias disponiveis (para os filtros da aba de laudos).
  app.get('/laudos/categorias', equipeTecnica, async (_request, reply) => {
    const categorias = Object.entries(CATEGORIAS_TRECHO).map(([valor, rotulo]) => ({ valor, rotulo }));
    return reply.status(200).send(categorias);
  });

  // Biblioteca de trechos normativos (filtravel por categoria, norma e busca).
  app.get('/laudos/trechos', equipeTecnica, async (request, reply) => {
    const query = listarQuery.parse(request.query);
    const trechos = await trechoNormativoRepository.listar(query);
    return reply.status(200).send(trechos);
  });

  app.post('/laudos/trechos', somenteAdmin, async (request, reply) => {
    const body = criarBody.parse(request.body);
    const trecho = await trechoNormativoRepository.criar({
      norma: body.norma,
      item: body.item,
      categoria: body.categoria,
      assunto: body.assunto,
      texto: body.texto,
      itemVerificar: body.item_verificar,
      criadoPorId: request.user!.id,
    });
    return reply.status(201).send(trecho);
  });

  app.put('/laudos/trechos/:id', somenteAdmin, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const body = atualizarBody.parse(request.body);

    const existente = await trechoNormativoRepository.buscarPorId(id);
    if (!existente) throw new NotFoundError('Trecho nao encontrado');

    const trecho = await trechoNormativoRepository.atualizar(id, {
      norma: body.norma,
      item: body.item,
      categoria: body.categoria,
      assunto: body.assunto,
      texto: body.texto,
      itemVerificar: body.item_verificar,
      ativo: body.ativo,
    });
    return reply.status(200).send(trecho);
  });

  app.delete('/laudos/trechos/:id', somenteAdmin, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const existente = await trechoNormativoRepository.buscarPorId(id);
    if (!existente) throw new NotFoundError('Trecho nao encontrado');

    await trechoNormativoRepository.desativar(id);
    return reply.status(204).send();
  });

  // ===== Laudos emitidos =====

  // Salva (cria ou atualiza) o laudo montado no editor.
  app.post('/laudos', equipeTecnica, async (request, reply) => {
    const body = salvarLaudoBody.parse(request.body);
    const laudo = await salvarLaudoUseCase.execute({
      id: body.id,
      ordemServicoId: body.ordem_servico_id,
      titulo: body.titulo,
      subtitulo: body.subtitulo,
      tipo: body.tipo,
      clienteNome: body.cliente_nome,
      normasAplicaveis: body.normas_aplicaveis,
      conteudo: body.conteudo,
      responsavelNome: body.responsavel_nome,
      responsavelCrea: body.responsavel_crea,
      artNumero: body.art_numero,
      criadoPorId: request.user!.id,
    });
    return reply.status(body.id ? 200 : 201).send(laudo);
  });

  app.get('/laudos/:id', equipeTecnica, async (request, reply) => {
    const { id } = laudoIdParams.parse(request.params);
    const laudo = await laudoRepository.buscarPorId(id);
    if (!laudo) throw new NotFoundError('Laudo nao encontrado');
    return reply.status(200).send(laudo);
  });

  // PDF do laudo, com a marca e o bloco de responsabilidade tecnica/ART.
  app.get('/laudos/:id/pdf', equipeTecnica, async (request, reply) => {
    const { id } = laudoIdParams.parse(request.params);
    const laudo = await laudoRepository.buscarPorId(id);
    if (!laudo) throw new NotFoundError('Laudo nao encontrado');

    // Carrega os binarios das fotos do relatorio fotografico. Uma foto cujo
    // arquivo sumiu do armazenamento e ignorada (nao derruba a geracao).
    const fotosMeta = await laudoFotoRepository.listarPorLaudo(id);
    const fotos: FotoLaudoPdf[] = [];
    for (const foto of fotosMeta) {
      try {
        const buffer = await armazenamentoArquivoService.lerArquivo(foto.chaveArquivo);
        fotos.push({ buffer, mimeType: foto.mimeType, legenda: foto.legenda });
      } catch {
        // arquivo indisponivel: ignora esta foto
      }
    }

    const tipoRotulo = (CATEGORIAS_TRECHO as Record<string, string>)[laudo.tipo] ?? laudo.tipo;
    const pdf = await gerarLaudoPdf({
      numero: laudo.numero,
      titulo: laudo.titulo,
      subtitulo: laudo.subtitulo,
      tipoRotulo,
      clienteNome: laudo.clienteNome,
      normasAplicaveis: laudo.normasAplicaveis,
      emitidoEm: laudo.emitidoEm,
      conteudo: laudo.conteudo,
      responsavelNome: laudo.responsavelNome,
      responsavelCrea: laudo.responsavelCrea,
      artNumero: laudo.artNumero,
      fotos,
    });

    return reply
      .status(200)
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="laudo-${laudo.numero}.pdf"`)
      .send(pdf);
  });

  // ===== Relatorio fotografico do laudo =====

  // Lista as fotos (metadados) de um laudo.
  app.get('/laudos/:id/fotos', equipeTecnica, async (request, reply) => {
    const { id } = laudoIdParams.parse(request.params);
    const laudo = await laudoRepository.buscarPorId(id);
    if (!laudo) throw new NotFoundError('Laudo nao encontrado');
    const fotos = await laudoFotoRepository.listarPorLaudo(id);
    return reply.status(200).send(
      fotos.map((f) => ({ id: f.id, legenda: f.legenda, ordem: f.ordem, mime_type: f.mimeType, criado_em: f.criadoEm })),
    );
  });

  // Anexa uma foto (JPEG/PNG/WebP em base64) ao laudo. O cliente ja reduz a
  // imagem antes de enviar; ainda assim aceitamos um corpo maior nesta rota.
  app.post('/laudos/:id/fotos', { ...equipeTecnica, bodyLimit: 12 * 1024 * 1024 }, async (request, reply) => {
    const { id } = laudoIdParams.parse(request.params);
    const body = adicionarFotoBody.parse(request.body);
    const foto = await adicionarFotoLaudoUseCase.execute({
      laudoId: id,
      base64: body.base64,
      mimeType: body.mime_type,
      legenda: body.legenda,
    });
    return reply.status(201).send({ id: foto.id, legenda: foto.legenda, ordem: foto.ordem, mime_type: foto.mimeType });
  });

  // Binario da foto (para pre-visualizacao no editor).
  app.get('/laudos/:id/fotos/:fotoId/arquivo', equipeTecnica, async (request, reply) => {
    const { id, fotoId } = fotoIdParams.parse(request.params);
    const foto = await laudoFotoRepository.buscarPorId(fotoId);
    if (!foto || foto.laudoId !== id) throw new NotFoundError('Foto nao encontrada');
    const conteudo = await armazenamentoArquivoService.lerArquivo(foto.chaveArquivo);
    reply.header('X-Content-Type-Options', 'nosniff');
    return reply.type(foto.mimeType).send(conteudo);
  });

  // Atualiza a legenda de uma foto (informacao que o tecnico coletou em campo).
  app.patch('/laudos/:id/fotos/:fotoId', equipeTecnica, async (request, reply) => {
    const { id, fotoId } = fotoIdParams.parse(request.params);
    const body = atualizarFotoBody.parse(request.body);
    const foto = await laudoFotoRepository.buscarPorId(fotoId);
    if (!foto || foto.laudoId !== id) throw new NotFoundError('Foto nao encontrada');
    const legenda = body.legenda?.trim() || null;
    const atualizada = await laudoFotoRepository.atualizarLegenda(fotoId, legenda);
    return reply.status(200).send({ id: atualizada.id, legenda: atualizada.legenda, ordem: atualizada.ordem });
  });

  app.delete('/laudos/:id/fotos/:fotoId', equipeTecnica, async (request, reply) => {
    const { id, fotoId } = fotoIdParams.parse(request.params);
    const foto = await laudoFotoRepository.buscarPorId(fotoId);
    if (!foto || foto.laudoId !== id) throw new NotFoundError('Foto nao encontrada');
    await armazenamentoArquivoService.remover(foto.chaveArquivo);
    await laudoFotoRepository.remover(fotoId);
    return reply.status(204).send();
  });

  // Laudos de uma OS especifica.
  app.get('/ordens-servico/:id/laudos', equipeTecnica, async (request, reply) => {
    const { id } = osIdParams.parse(request.params);
    const laudos = await laudoRepository.listarPorOrdemServico(id);
    return reply.status(200).send(laudos);
  });
}

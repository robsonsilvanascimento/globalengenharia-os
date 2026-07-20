import type { PrismaClient } from '@prisma/client';
import type { OrdemServicoRepository } from '../../ordens-servico/domain/OrdemServicoRepository';
import type { ComponenteInstaladoRepository } from '../../rastreabilidade/domain/ComponenteInstaladoRepository';
import type { DocumentoOSRepository } from '../../rastreabilidade/domain/DocumentoOSRepository';
import { NotFoundError } from '../../../shared/http/errors/AppError';
import { gerarRelatorioTecnico, type DadosRelatorioTecnico } from '../../../shared/infra/pdf/GerarRelatorioTecnicoService';

export interface GerarRelatorioTecnicoUseCaseDeps {
  ordemServicoRepository: OrdemServicoRepository;
  componenteInstaladoRepository: ComponenteInstaladoRepository;
  documentoOSRepository: DocumentoOSRepository;
  prisma: PrismaClient;
}

export class GerarRelatorioTecnicoUseCase {
  constructor(private readonly deps: GerarRelatorioTecnicoUseCaseDeps) {}

  /**
   * @param ocultarValores quando `true`, omite todo dado financeiro do
   * relatorio (valor cobrado e estimativa de custo). Usado para gerar o PDF
   * sem valores quando o solicitante nao e admin (ex.: tecnico em campo).
   */
  async execute(ordemServicoId: string, ocultarValores = false, solicitanteName?: string): Promise<Buffer> {
    const os = await this.deps.ordemServicoRepository.findByIdCompleto(ordemServicoId);
    if (!os) throw new NotFoundError('Ordem de serviço não encontrada');

    const [componentes, documentos, assinatura] = await Promise.all([
      this.deps.componenteInstaladoRepository.findByOrdemServico(ordemServicoId),
      this.deps.documentoOSRepository.findByOrdemServico(ordemServicoId),
      this.deps.prisma.assinaturaOS.findUnique({ where: { ordemServicoId } }),
    ]);

    const dados: DadosRelatorioTecnico = {
      numero: os.numero,
      status: os.status,
      prioridade: os.prioridade,
      criadoEm: os.criadoEm,
      dataAgendada: os.dataAgendada,
      fechadoEm: os.fechadoEm,
      descricaoProblema: os.descricaoProblema,
      enderecoAtendimento: os.enderecoAtendimento,
      criadoVia: os.criadoVia,
      valorCobrado: ocultarValores || os.valorCobrado == null ? null : Number(os.valorCobrado),
      clienteNome: os.cliente.nome,
      clienteTelefone: os.cliente.telefoneWhatsapp,
      clienteEmail: os.cliente.email,
      clienteDocumento: os.cliente.documento,
      categoriaNome: os.categoriaServico.nome,
      categoriaArea: os.categoriaServico.area,
      tecnicoNome: os.tecnico?.nome ?? null,
      ajudanteNome: os.ajudante?.nome ?? null,
      componentes: componentes.map((c) => ({
        nome: c.nome,
        fabricante: c.fabricante,
        modelo: c.modelo,
        numeroSerie: c.numeroSerie,
        garantiaMeses: c.garantiaMeses,
        garantiaExpiraEm: c.garantiaExpiraEm,
        observacoes: c.observacoes,
        documentos: documentos
          .filter((d) => d.componenteInstaladoId === c.id)
          .map((d) => ({ nome: d.nome, tipoDocumento: d.tipoDocumento, tamanhoBytes: d.tamanhoBytes })),
      })),
      documentos: documentos
        .filter((d) => !d.componenteInstaladoId)
        .map((d) => ({ nome: d.nome, tipoDocumento: d.tipoDocumento, tamanhoBytes: d.tamanhoBytes })),
      historico: os.historicoStatus.map((h) => ({
        statusAnterior: h.statusAnterior,
        statusNovo: h.statusNovo,
        alteradoPorBot: h.alteradoPorBot,
        observacao: h.observacao,
        criadoEm: h.criadoEm,
      })),
      estimativa: os.estimativaCusto && !ocultarValores
        ? {
            horasEstimadasTecnico: Number(os.estimativaCusto.horasEstimadasTecnico),
            valorHoraTecnico: Number(os.estimativaCusto.valorHoraTecnico),
            horasEstimadasAjudante: os.estimativaCusto.horasEstimadasAjudante != null ? Number(os.estimativaCusto.horasEstimadasAjudante) : null,
            valorHoraAjudante: os.estimativaCusto.valorHoraAjudante != null ? Number(os.estimativaCusto.valorHoraAjudante) : null,
            custoCombustivel: Number(os.estimativaCusto.custoCombustivel),
            custoPedagio: Number(os.estimativaCusto.custoPedagio),
            custoDesgasteVeiculo: Number(os.estimativaCusto.custoDesgasteVeiculo),
            custoAlmoco: Number(os.estimativaCusto.custoAlmoco),
            custoJanta: Number(os.estimativaCusto.custoJanta),
            custoEstadia: Number(os.estimativaCusto.custoEstadia),
            turno: os.estimativaCusto.turno,
            custoAdicionalNoturno: Number(os.estimativaCusto.custoAdicionalNoturno),
            outrosCustos: Number(os.estimativaCusto.outrosCustos),
            custoTotal: Number(os.estimativaCusto.custoTotal),
          }
        : null,
      assinaturaBase64: assinatura?.imagemBase64 ?? null,
      assinaturaDataCriacao: assinatura?.criadoEm ?? null,
      geradoPorNome: solicitanteName ?? null,
      geradoEm: new Date(),
    };

    return gerarRelatorioTecnico(dados);
  }
}

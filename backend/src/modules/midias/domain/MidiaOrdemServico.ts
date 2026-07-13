/** Tipo de midia associada a uma Ordem de Servico. Espelha o enum TipoMidiaOS do Prisma. */
export type TipoMidia = 'video';

/**
 * Entidade de dominio MidiaOrdemServico. Representa um video (por enquanto o
 * unico tipo suportado) enviado pelo cliente via WhatsApp, associado a uma OS
 * e/ou a um cliente. Nao carrega nenhum detalhe de persistencia/armazenamento
 * fisico — `caminhoArmazenamento` e apenas a chave logica opaca usada pelo
 * ArmazenamentoArquivoService.
 */
export interface MidiaOrdemServico {
  id: string;
  ordemServicoId?: string;
  clienteId: string;
  tipo: TipoMidia;
  caminhoArmazenamento: string;
  mimeType: string;
  tamanhoBytes: number;
  whatsappMediaId?: string;
  criadoEm: Date;
}

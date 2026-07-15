import type { PagamentoOS, PrismaClient } from '@prisma/client';
import { gerarPixOrdemServico } from '../infrastructure/mercadopago/MercadoPagoService';

export interface GerarOuReutilizarPixInput {
  ordemServicoId: string;
  valorCobrado: number;
  clienteNome: string;
  clienteEmail?: string;
}

/**
 * Reaproveita um Pix pendente ja existente para a OS ou gera um novo via
 * Mercado Pago (`gerarPixOrdemServico`) quando nao ha nenhum. Usado tanto
 * pelo worker de geracao automatica ao concluir a OS
 * (`pix-whatsapp-worker`) quanto pela consulta de pagamento via WhatsApp
 * (`ConsultarPagamentoViaWhatsappUseCase`), evitando gerar cobrancas
 * duplicadas no Mercado Pago para a mesma OS.
 */
export async function gerarOuReutilizarPix(
  input: GerarOuReutilizarPixInput,
  prisma: PrismaClient,
): Promise<PagamentoOS> {
  const pagamentoExistente = await prisma.pagamentoOS.findFirst({
    where: { ordemServicoId: input.ordemServicoId, statusPagamento: 'pendente' },
    orderBy: { criadoEm: 'desc' },
  });

  if (pagamentoExistente) {
    return pagamentoExistente;
  }

  const { mercadoPagoId, qrCode, copiaECola } = await gerarPixOrdemServico({
    ordemServicoId: input.ordemServicoId,
    valor: input.valorCobrado,
    clienteNome: input.clienteNome,
    clienteEmail: input.clienteEmail,
  });

  return prisma.pagamentoOS.create({
    data: {
      ordemServicoId: input.ordemServicoId,
      tipo: 'pix_automatico',
      valor: input.valorCobrado,
      pixQrCode: qrCode,
      pixCopiaECola: copiaECola,
      mercadoPagoId,
    },
  });
}

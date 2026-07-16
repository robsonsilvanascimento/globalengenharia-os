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
 *
 * A checagem + criacao roda sob um advisory lock do Postgres (escopado pelo
 * hash do `ordemServicoId`), liberado automaticamente ao fim da transacao:
 * sem isso, duas chamadas concorrentes para a mesma OS (ex.: o listener de
 * conclusao e uma consulta de pagamento pelo bot quase simultaneas) poderiam
 * ambas ver "nenhum Pix pendente" e gerar cobrancas duplicadas no Mercado
 * Pago.
 */
export async function gerarOuReutilizarPix(
  input: GerarOuReutilizarPixInput,
  prisma: PrismaClient,
): Promise<PagamentoOS> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.ordemServicoId}))`;

      const pagamentoExistente = await tx.pagamentoOS.findFirst({
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

      return tx.pagamentoOS.create({
        data: {
          ordemServicoId: input.ordemServicoId,
          tipo: 'pix_automatico',
          valor: input.valorCobrado,
          pixQrCode: qrCode,
          pixCopiaECola: copiaECola,
          mercadoPagoId,
        },
      });
    },
    // Timeout maior que o padrao (5s): a transacao inclui uma chamada HTTP
    // externa ao Mercado Pago quando ainda nao ha Pix pendente.
    { timeout: 15000 },
  );
}

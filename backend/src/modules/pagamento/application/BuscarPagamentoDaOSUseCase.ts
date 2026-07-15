import type { PrismaClient } from '@prisma/client';
import type { OrdemServico } from '../../ordens-servico/domain/OrdemServico';
import type { ResultadoPagamentoOS } from '../../whatsapp/application/ConsultarPagamentoViaWhatsappUseCase';
import { gerarOuReutilizarPix } from './GerarOuReutilizarPixUseCase';

/**
 * Implementacao concreta de `BuscarPagamentoDaOSFn` (porta definida em
 * `ConsultarPagamentoViaWhatsappUseCase`): resolve a situacao de pagamento de
 * uma OS ja concluida — paga, sem valor cobrado definido, ou pendente (com
 * Pix gerado on-demand via `gerarOuReutilizarPix` quando necessario).
 */
export async function buscarPagamentoDaOS(
  ordemServico: OrdemServico,
  prisma: PrismaClient,
): Promise<ResultadoPagamentoOS> {
  const pagamentoPago = await prisma.pagamentoOS.findFirst({
    where: { ordemServicoId: ordemServico.id, statusPagamento: 'pago' },
  });

  if (pagamentoPago) {
    return { statusPagamento: 'pago' };
  }

  const valorCobrado = ordemServico.valorCobrado ?? 0;

  if (!valorCobrado) {
    return { statusPagamento: 'sem_valor' };
  }

  const cliente = await prisma.cliente.findUniqueOrThrow({ where: { id: ordemServico.clienteId } });

  const pagamentoOS = await gerarOuReutilizarPix(
    {
      ordemServicoId: ordemServico.id,
      valorCobrado,
      clienteNome: cliente.nome,
      clienteEmail: cliente.email ?? undefined,
    },
    prisma,
  );

  return { statusPagamento: 'pendente', valor: valorCobrado, pixCopiaECola: pagamentoOS.pixCopiaECola ?? '' };
}

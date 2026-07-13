import { prisma } from '../../../shared/infra/PrismaClient';
import { enqueueCalcularComissao } from '../../../shared/infra/queues';
import { BadRequestError } from '../../../shared/http/errors/AppError';

export interface RegistrarPagamentoManualInput {
  ordemServicoId: string;
  valor: number;
  observacao?: string;
  criadoPorId: string;
}

export async function registrarPagamentoManual(input: RegistrarPagamentoManualInput) {
  const { ordemServicoId, valor, observacao, criadoPorId } = input;

  if (valor <= 0) {
    throw new BadRequestError('O valor do pagamento deve ser maior que zero');
  }

  const pagamento = await prisma.pagamentoOS.create({
    data: {
      ordemServicoId,
      tipo: 'manual',
      statusPagamento: 'pago',
      pagoEm: new Date(),
      valor,
      observacao,
      criadoPorId,
    },
  });

  await prisma.ordemServico.update({
    where: { id: ordemServicoId },
    data: { statusPagamento: 'pago' },
  });

  await enqueueCalcularComissao({ pagamentoOSId: pagamento.id });

  return pagamento;
}

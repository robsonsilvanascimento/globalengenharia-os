import { prisma } from '../../../shared/infra/PrismaClient';
import { enqueueCalcularComissao, enqueueEntregaRecibo } from '../../../shared/infra/queues';
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

  // Cria o pagamento e fecha a OS como paga na mesma transacao: sem isso, um
  // crash/erro entre as duas escritas deixaria o PagamentoOS marcado como
  // pago mas a OS ainda "pendente" (ou vice-versa), um estado inconsistente
  // que so seria notado manualmente.
  const pagamento = await prisma.$transaction(async (tx) => {
    const pagamentoCriado = await tx.pagamentoOS.create({
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

    await tx.ordemServico.update({
      where: { id: ordemServicoId },
      data: { statusPagamento: 'pago' },
    });

    return pagamentoCriado;
  });

  await enqueueCalcularComissao({ pagamentoOSId: pagamento.id });
  await enqueueEntregaRecibo({ pagamentoOSId: pagamento.id });

  return pagamento;
}

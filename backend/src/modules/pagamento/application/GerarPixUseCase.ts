import type { PrismaClient } from '@prisma/client';
import { ValidationError } from '../../../shared/http/errors/AppError';
import { gerarPixOrdemServico } from '../infrastructure/mercadopago/MercadoPagoService';

interface GerarPixInput {
  ordemServicoId: string;
  criadoPorId: string;
}

export async function GerarPixUseCase(
  { ordemServicoId, criadoPorId }: GerarPixInput,
  prisma: PrismaClient,
) {
  const os = await prisma.ordemServico.findUniqueOrThrow({
    where: { id: ordemServicoId },
    include: { cliente: { select: { nome: true, email: true } } },
  });

  const valorCobrado = os.valorCobrado ? Number(os.valorCobrado) : 0;

  if (!valorCobrado) {
    throw new ValidationError('OS sem valor cobrado definido');
  }

  const { mercadoPagoId, qrCode, copiaECola } = await gerarPixOrdemServico({
    ordemServicoId,
    valor: valorCobrado,
    clienteNome: os.cliente.nome,
    clienteEmail: os.cliente.email ?? undefined,
  });

  const pagamentoOS = await prisma.pagamentoOS.create({
    data: {
      ordemServicoId,
      tipo: 'pix_automatico',
      valor: valorCobrado,
      pixQrCode: qrCode,
      pixCopiaECola: copiaECola,
      mercadoPagoId,
      criadoPorId,
    },
  });

  return pagamentoOS;
}

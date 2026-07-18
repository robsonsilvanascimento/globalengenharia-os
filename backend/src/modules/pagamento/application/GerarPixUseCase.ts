import type { PrismaClient } from '@prisma/client';
import { ValidationError } from '../../../shared/http/errors/AppError';
import { gerarOuReutilizarPix } from './GerarOuReutilizarPixUseCase';

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

  if (os.statusPagamento === 'pago') {
    throw new ValidationError('OS ja esta com pagamento confirmado');
  }

  // Reaproveita/gera sob o mesmo advisory lock usado pelo fluxo automatico,
  // evitando que uma geracao manual pelo painel crie uma cobranca duplicada
  // no Mercado Pago para uma OS que ja tem um Pix pendente.
  return gerarOuReutilizarPix(
    {
      ordemServicoId,
      valorCobrado,
      clienteNome: os.cliente.nome,
      clienteEmail: os.cliente.email ?? undefined,
      criadoPorId,
    },
    prisma,
  );
}

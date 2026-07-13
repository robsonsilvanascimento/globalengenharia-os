import type { Queue } from 'bullmq';
import type { AlertaGarantiaJobData } from './garantia-queue';

export async function agendarAlertaGarantia(
  queue: Queue<AlertaGarantiaJobData>,
): Promise<void> {
  await queue.add(
    'verificar',
    {},
    {
      repeat: { pattern: '0 8 * * *' },
      jobId: 'alerta-garantia-diario',
    },
  );
}

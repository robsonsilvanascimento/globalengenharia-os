import { Worker } from 'bullmq';
import Expo from 'expo-server-sdk';
import { redisConnection } from '../../../../shared/infra/RedisConnection';
import { logger } from '../../../../shared/infra/Logger';
import { EXPO_PUSH_QUEUE_NAME, type ExpoPushJobData } from './expo-push-queue';

const expo = new Expo();

export const expoPushWorker = new Worker<ExpoPushJobData>(
  EXPO_PUSH_QUEUE_NAME,
  async (job) => {
    const { expoPushToken, titulo, corpo, data } = job.data;

    if (!Expo.isExpoPushToken(expoPushToken)) {
      logger.warn({ expoPushToken }, 'Token Expo invalido, ignorando');
      return;
    }

    const tickets = await expo.sendPushNotificationsAsync([
      {
        to: expoPushToken,
        sound: 'default',
        title: titulo,
        body: corpo,
        data: data ?? {},
      },
    ]);

    const ticket = tickets[0];
    if (!ticket) {
      logger.warn({ jobId: job.id }, 'Nenhum ticket retornado pela API Expo');
      return;
    }

    if (ticket.status === 'error') {
      logger.error({ ticket, jobId: job.id }, 'Erro ao enviar push Expo');
    } else {
      logger.info({ jobId: job.id, expoPushToken }, 'Push Expo enviado com sucesso');
    }
  },
  { connection: redisConnection, concurrency: 5 },
);

expoPushWorker.on('failed', (job, err) => {
  logger.error({ err, jobId: job?.id }, 'Job da fila expo-push falhou');
});

expoPushWorker.on('error', (err) => {
  logger.error({ err }, 'Erro no worker da fila expo-push');
});

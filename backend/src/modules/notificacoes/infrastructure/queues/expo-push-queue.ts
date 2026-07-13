import { Queue } from 'bullmq';
import { redisConnection } from '../../../../shared/infra/RedisConnection';

export interface ExpoPushJobData {
  expoPushToken: string;
  titulo: string;
  corpo: string;
  data?: Record<string, unknown>;
}

export const EXPO_PUSH_QUEUE_NAME = 'expo-push';

export const expoPushQueue = new Queue<ExpoPushJobData>(EXPO_PUSH_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

export async function enqueueExpoPush(data: ExpoPushJobData): Promise<void> {
  await expoPushQueue.add('push', data);
}

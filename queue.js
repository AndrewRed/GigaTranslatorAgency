import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const queueName = 'translation:chunks';

export const redis = new Redis(redisUrl);

export async function enqueueChunk(chunkId) {
  await redis.lpush(queueName, chunkId);
}

export async function dequeueChunk(timeoutSec = 5) {
  const result = await redis.brpop(queueName, timeoutSec);
  if (!result) {
    return null;
  }

  return result[1];
}

export async function publishJobEvent(jobId, payload) {
  await redis.publish(`translation:job:${jobId}`, JSON.stringify(payload));
}

export function jobEventChannel(jobId) {
  return `translation:job:${jobId}`;
}

export { queueName };

import type { RedisClientType } from 'redis';
import { createClient } from 'redis';

export async function redisClientFactory(): Promise<RedisClientType> {
  const {
    REDIS_USER = undefined,
    REDIS_PASS = undefined,
    REDIS_HOST = 'localhost',
    REDIS_PORT = 6379,
  } = process.env;
  const authString =
    REDIS_USER && REDIS_PASS ? `${REDIS_USER}:${REDIS_PASS}@` : '';
  const client: RedisClientType = createClient({
    url: `redis://${authString}${REDIS_HOST}:${REDIS_PORT}`,
  });
  await client.connect();
  return client;
}

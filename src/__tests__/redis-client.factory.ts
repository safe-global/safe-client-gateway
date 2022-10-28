import { RedisClientType, createClient } from 'redis';

export async function redisClientFactory(): Promise<RedisClientType> {
  const { REDIS_HOST = 'localhost', REDIS_PORT = 6379 } = process.env;
  const client: RedisClientType = createClient({
    url: `redis://${REDIS_HOST}:${REDIS_PORT}`,
  });
  client.connect();
  return client;
}

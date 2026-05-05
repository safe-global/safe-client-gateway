// SPDX-License-Identifier: FSL-1.1-MIT
import { createClient } from 'redis';
import type { RedisClientType } from '@/datasources/cache/cache.module';

export async function redisClientFactory(): Promise<RedisClientType> {
  const {
    REDIS_USER,
    REDIS_PASS,
    REDIS_HOST = 'localhost',
    REDIS_PORT = 6379,
  } = process.env;
  const client: RedisClientType = createClient({
    socket: {
      host: REDIS_HOST,
      port: Number(REDIS_PORT),
    },
    username: REDIS_USER,
    password: REDIS_PASS,
  });
  await client.connect();
  return client;
}

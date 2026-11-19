// SPDX-License-Identifier: FSL-1.1-MIT
import { createClient } from 'redis';
import type { RedisClientType } from '#/datasources/cache/cache.module';

/**
 * @param args.database - Redis logical database to select. Defaults to 0,
 *   the one the app and the other specs use.
 */
export async function redisClientFactory(args?: {
  database?: number;
}): Promise<RedisClientType> {
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
    database: args?.database,
  });
  await client.connect();
  return client;
}

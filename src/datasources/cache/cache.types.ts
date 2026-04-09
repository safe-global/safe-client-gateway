// SPDX-License-Identifier: FSL-1.1-MIT
import { type createClient } from 'redis';

export type RedisClientType = ReturnType<typeof createClient>;

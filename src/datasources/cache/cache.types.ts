// SPDX-License-Identifier: FSL-1.1-MIT
import { createClient } from 'redis';

export type RedisClientType = ReturnType<typeof createClient>;

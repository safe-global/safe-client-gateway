import type { SingletonSchema } from '@/domain/chains/entities/schemas/singleton.schema';
import type { z } from 'zod';

export type Singleton = z.infer<typeof SingletonSchema>;

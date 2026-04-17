import type { z } from 'zod';
import type { SingletonSchema } from '@/modules/chains/domain/entities/schemas/singleton.schema';

export type Singleton = z.infer<typeof SingletonSchema>;

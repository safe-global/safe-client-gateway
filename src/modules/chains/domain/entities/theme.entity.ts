import type { z } from 'zod';
import type { ThemeSchema } from '@/modules/chains/domain/entities/schemas/chain.schema';

export type Theme = z.infer<typeof ThemeSchema>;

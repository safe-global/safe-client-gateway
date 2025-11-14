import type { ThemeSchema } from '@/modules/chains/domain/entities/schemas/chain.schema';
import type { z } from 'zod';

export type Theme = z.infer<typeof ThemeSchema>;

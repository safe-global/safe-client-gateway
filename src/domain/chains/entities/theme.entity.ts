import type { ThemeSchema } from '@/domain/chains/entities/schemas/chain.schema';
import type { z } from 'zod';

export type Theme = z.infer<typeof ThemeSchema>;

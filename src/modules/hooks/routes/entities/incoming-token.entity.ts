// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type { IncomingTokenEventSchema } from '@/modules/hooks/routes/entities/schemas/incoming-token.schema';

export type IncomingToken = z.infer<typeof IncomingTokenEventSchema>;

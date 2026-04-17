// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type { EventSchema } from '@/modules/hooks/routes/entities/schemas/event.schema';

export type Event = z.infer<typeof EventSchema>;

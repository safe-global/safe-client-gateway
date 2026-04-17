import type { z } from 'zod';
import type { NewConfirmationEventSchema } from '@/modules/hooks/routes/entities/schemas/new-confirmation.schema';

export type NewConfirmation = z.infer<typeof NewConfirmationEventSchema>;

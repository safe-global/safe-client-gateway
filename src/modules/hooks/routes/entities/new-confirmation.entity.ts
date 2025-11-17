import type { NewConfirmationEventSchema } from '@/modules/hooks/routes/entities/schemas/new-confirmation.schema';
import type { z } from 'zod';

export type NewConfirmation = z.infer<typeof NewConfirmationEventSchema>;

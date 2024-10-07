import type { NewConfirmationEventSchema } from '@/routes/hooks/entities/schemas/new-confirmation.schema';
import type { z } from 'zod';

export type NewConfirmation = z.infer<typeof NewConfirmationEventSchema>;

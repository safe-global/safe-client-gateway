import { NewConfirmationEventSchema } from '@/routes/cache-hooks/entities/schemas/new-confirmation.schema';
import { z } from 'zod';

export type NewConfirmation = z.infer<typeof NewConfirmationEventSchema>;

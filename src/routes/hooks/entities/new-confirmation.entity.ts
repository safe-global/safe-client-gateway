import { NewConfirmationEventSchema } from '@/routes/hooks/entities/schemas/new-confirmation.schema';
import { z } from 'zod';

export type NewConfirmation = z.infer<typeof NewConfirmationEventSchema>;

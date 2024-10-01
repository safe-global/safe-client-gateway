import type { NewMessageConfirmationEventSchema } from '@/routes/hooks/entities/schemas/new-message-confirmation.schema';
import type { z } from 'zod';

export type NewMessageConfirmation = z.infer<
  typeof NewMessageConfirmationEventSchema
>;

import type { NewMessageConfirmationEventSchema } from '@/modules/hooks/routes/entities/schemas/new-message-confirmation.schema';
import type { z } from 'zod';

export type NewMessageConfirmation = z.infer<
  typeof NewMessageConfirmationEventSchema
>;

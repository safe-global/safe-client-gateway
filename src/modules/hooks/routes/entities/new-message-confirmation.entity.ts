import type { z } from 'zod';
import type { NewMessageConfirmationEventSchema } from '@/modules/hooks/routes/entities/schemas/new-message-confirmation.schema';

export type NewMessageConfirmation = z.infer<
  typeof NewMessageConfirmationEventSchema
>;

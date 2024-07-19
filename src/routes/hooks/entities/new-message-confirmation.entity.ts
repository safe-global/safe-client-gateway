import { NewMessageConfirmationEventSchema } from '@/routes/hooks/entities/schemas/new-message-confirmation.schema';
import { z } from 'zod';

export type NewMessageConfirmation = z.infer<
  typeof NewMessageConfirmationEventSchema
>;

import { getSiweMessageSchema } from '@/domain/siwe/entities/siwe-message.entity';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { z } from 'zod';

// TODO: Inject
const MAX_VALIDITY_PERIOD_IN_SECONDS = 15 * 60; // 15 minutes

export type VerifyAuthMessageDto = z.infer<typeof VerifyAuthMessageDtoSchema>;

export const VerifyAuthMessageDtoSchema = z.object({
  message: getSiweMessageSchema(MAX_VALIDITY_PERIOD_IN_SECONDS),
  signature: HexSchema,
});

import { SiweMessageSchema } from '@/domain/auth/entities/siwe-message.entity';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { z } from 'zod';

export type VerifyAuthMessageDto = z.infer<typeof VerifyAuthMessageDtoSchema>;

export const VerifyAuthMessageDtoSchema = z.object({
  message: SiweMessageSchema,
  signature: HexSchema,
});

import { SiweMessageSchema } from '@/domain/auth/entities/schemas/siwe-message.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { z } from 'zod';

export const VerifyAuthMessageDtoSchema = z.object({
  message: SiweMessageSchema,
  signature: HexSchema,
});

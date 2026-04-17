import { z } from 'zod';
import { TokenDetailsSchema } from '@/domain/common/schemas/token-metadata.schema';

export type BalanceToken = z.infer<typeof BalanceTokenSchema>;

export const BalanceTokenSchema = TokenDetailsSchema.extend({
  logoUri: z.string(),
});

import { TokenDetailsSchema } from '@/domain/common/schemas/token-metadata.schema';
import { z } from 'zod';

export type BalanceToken = z.infer<typeof BalanceTokenSchema>;

export const BalanceTokenSchema = TokenDetailsSchema.extend({
  logoUri: z.string(),
});

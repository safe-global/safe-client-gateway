import { RowSchema } from '@/datasources/db/entities/row.entity';
import { AccountSchema } from '@/domain/accounts/entities/account.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export type CounterfactualSafe = z.infer<typeof CounterfactualSafeSchema>;

export const CounterfactualSafeSchema = RowSchema.extend({
  chain_id: z.string(),
  creator: AddressSchema,
  fallback_handler: AddressSchema,
  owners: z.array(AddressSchema),
  predicted_address: AddressSchema,
  salt_nonce: z.string(),
  singleton_address: AddressSchema,
  threshold: z.number().int().gte(0),
  account_id: AccountSchema.shape.id,
});

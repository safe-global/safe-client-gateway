import { GroupSchema } from '@/datasources/accounts/entities/group.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export type Account = z.infer<typeof AccountSchema>;

export const AccountSchema = z.object({
  id: z.number().int(),
  group_id: GroupSchema.shape.id,
  address: AddressSchema,
});

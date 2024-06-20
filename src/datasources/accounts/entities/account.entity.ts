import { GroupSchema } from '@/datasources/accounts/entities/group.entity';
import { RowSchema } from '@/datasources/db/entities/row.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export type Account = z.infer<typeof AccountSchema>;

export const AccountSchema = RowSchema.extend({
  group_id: GroupSchema.shape.id,
  address: AddressSchema,
});

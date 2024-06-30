import { RowSchema } from '@/datasources/db/entities/row.entity';
import { GroupSchema } from '@/domain/accounts/entities/group.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export type Account = z.infer<typeof AccountSchema>;

export const AccountSchema = RowSchema.extend({
  group_id: GroupSchema.shape.id.nullish().default(null),
  address: AddressSchema,
});

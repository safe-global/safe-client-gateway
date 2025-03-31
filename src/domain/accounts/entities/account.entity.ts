import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import { GroupSchema } from '@/domain/accounts/entities/group.entity';
import { NameSchema } from '@/domain/common/entities/name.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import type { z } from 'zod';

export type Account = z.infer<typeof AccountSchema>;

export const AccountSchema = RowSchema.extend({
  group_id: GroupSchema.shape.id.nullish().default(null),
  address: AddressSchema,
  name: NameSchema,
});

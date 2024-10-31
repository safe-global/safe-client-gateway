import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import { GroupSchema } from '@/domain/accounts/entities/group.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export type Account = z.infer<typeof AccountSchema>;

export const AccountSchema = RowSchema.extend({
  group_id: GroupSchema.shape.id.nullish().default(null),
  address: AddressSchema,
  name: z
    .string()
    .min(3, { message: 'Account names must be at least 3 characters long' })
    .max(20, { message: 'Account names must be at most 20 characters long' })
    .regex(/^[a-zA-Z0-9]+(?:[._-][a-zA-Z0-9]+)*$/, {
      message:
        'Account names must start with a letter or number and can contain alphanumeric characters, periods, underscores, and hyphens',
    }),
});

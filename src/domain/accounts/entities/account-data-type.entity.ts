import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import { z } from 'zod';

export enum AccountDataTypeNames {
  CounterfactualSafes = 'CounterfactualSafes',
  AddressBook = 'AddressBook',
  Watchlist = 'Watchlist',
}

export type AccountDataType = z.infer<typeof AccountDataTypeSchema>;

export const AccountDataTypeSchema = RowSchema.extend({
  name: z.nativeEnum(AccountDataTypeNames),
  description: z.string().nullish().default(null),
  is_active: z.boolean().default(true),
});

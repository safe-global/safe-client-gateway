import { AccountDataTypeSchema } from '@/modules/accounts/domain/entities/account-data-type.entity';
import { AccountSchema } from '@/modules/accounts/domain/entities/account.entity';
import { z } from 'zod';

export type AccountDataSetting = z.infer<typeof AccountDataSettingSchema>;

export const AccountDataSettingSchema = z.object({
  account_id: AccountSchema.shape.id,
  account_data_type_id: AccountDataTypeSchema.shape.id,
  enabled: z.boolean(),
  created_at: z.date(),
  updated_at: z.date(),
});

import { z } from 'zod';

export const UpsertAccountDataSettingDtoSchema = z.object({
  dataTypeName: z.string(),
  enabled: z.boolean(),
});

export const UpsertAccountDataSettingsDtoSchema = z.object({
  accountDataSettings: z.array(UpsertAccountDataSettingDtoSchema),
});

import { z } from 'zod';

export class UpsertAccountDataSettingsDto
  implements z.infer<typeof UpsertAccountDataSettingsDtoSchema>
{
  accountDataSettings: {
    dataTypeName: string;
    enabled: boolean;
  }[];

  constructor(props: UpsertAccountDataSettingsDto) {
    this.accountDataSettings = props.accountDataSettings;
  }
}

export const UpsertAccountDataSettingDtoSchema = z.object({
  dataTypeName: z.string(),
  enabled: z.boolean(),
});

export const UpsertAccountDataSettingsDtoSchema = z.object({
  accountDataSettings: z.array(UpsertAccountDataSettingDtoSchema),
});

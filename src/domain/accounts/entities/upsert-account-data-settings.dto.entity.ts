import { UpsertAccountDataSettingsDtoSchema } from '@/domain/accounts/entities/schemas/upsert-account-data-settings.dto.schema';
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

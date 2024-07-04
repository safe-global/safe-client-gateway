import { IBuilder, Builder } from '@/__tests__/builder';
import { UpsertAccountDataSettingsDto } from '@/domain/accounts/entities/upsert-account-data-settings.dto.entity';
import { faker } from '@faker-js/faker';

export function upsertAccountDataSettingsDtoBuilder(): IBuilder<UpsertAccountDataSettingsDto> {
  return new Builder<UpsertAccountDataSettingsDto>().with(
    'accountDataSettings',
    Array.from({ length: faker.number.int({ min: 1, max: 10 }) }, () => ({
      dataTypeName: faker.lorem.word(),
      enabled: faker.datatype.boolean(),
    })),
  );
}

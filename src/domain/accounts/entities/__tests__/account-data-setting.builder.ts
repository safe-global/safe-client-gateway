import { IBuilder, Builder } from '@/__tests__/builder';
import { AccountDataSetting } from '@/domain/accounts/entities/account-data-setting.entity';
import { faker } from '@faker-js/faker';

export function accountDataSettingBuilder(): IBuilder<AccountDataSetting> {
  return new Builder<AccountDataSetting>()
    .with('account_id', faker.number.int())
    .with('account_data_type_id', faker.number.int())
    .with('enabled', faker.datatype.boolean())
    .with('created_at', faker.date.recent())
    .with('updated_at', faker.date.recent());
}

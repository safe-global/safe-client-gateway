import { Builder, type IBuilder } from '@/__tests__/builder';
import type { OutreachFile } from '@/datasources/targeted-messaging/entities/outreach-file.entity';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';

export function outreachFileBuilder(): IBuilder<OutreachFile> {
  return new Builder<OutreachFile>()
    .with(
      'campaign_id',
      faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER - 1 }),
    )
    .with('campaign_name', faker.string.alphanumeric())
    .with('team_name', faker.string.alphanumeric())
    .with('start_date', faker.date.recent())
    .with('end_date', faker.date.recent())
    .with(
      'safe_addresses',
      Array.from({ length: faker.number.int({ min: 10, max: 50 }) }, () =>
        getAddress(faker.finance.ethereumAddress()),
      ),
    );
}

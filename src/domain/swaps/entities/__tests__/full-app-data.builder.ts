import { Builder, IBuilder } from '@/__tests__/builder';
import { FullAppData } from '@/domain/swaps/entities/full-app-data.entity';
import { faker } from '@faker-js/faker';

export function fullAppDataBuilder(): IBuilder<FullAppData> {
  return new Builder<FullAppData>().with('fullAppData', {
    appCode: faker.string.alphanumeric(),
  });
}

// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { FullAppData } from '@/modules/swaps/domain/entities/full-app-data.entity';

export function fullAppDataBuilder(): IBuilder<FullAppData> {
  return new Builder<FullAppData>().with('fullAppData', {
    appCode: faker.string.alphanumeric(),
  });
}

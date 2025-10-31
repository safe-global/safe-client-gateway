import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { AppBalance } from '@/domain/portfolio/entities/app-balance.entity';
import { appInfoBuilder } from '@/domain/portfolio/entities/__tests__/app-info.builder';
import { appPositionGroupBuilder } from '@/domain/portfolio/entities/__tests__/app-position-group.builder';

export function appBalanceBuilder(): IBuilder<AppBalance> {
  return new Builder<AppBalance>()
    .with('appInfo', appInfoBuilder().build())
    .with(
      'balanceFiat',
      faker.number.float({ min: 0, max: 100000, fractionDigits: 2 }).toString(),
    )
    .with('groups', [
      appPositionGroupBuilder().build(),
      appPositionGroupBuilder().build(),
    ]);
}

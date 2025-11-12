import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { AppBalance } from '@/modules/portfolio/domain/entities/app-balance.entity';
import { appInfoBuilder } from '@/modules/portfolio/domain/entities/__tests__/app-info.builder';
import { appPositionGroupBuilder } from '@/modules/portfolio/domain/entities/__tests__/app-position-group.builder';

export function appBalanceBuilder(): IBuilder<AppBalance> {
  return new Builder<AppBalance>()
    .with('appInfo', appInfoBuilder().build())
    .with('balanceFiat', faker.number.float({ fractionDigits: 2 }).toString())
    .with('groups', [
      appPositionGroupBuilder().build(),
      appPositionGroupBuilder().build(),
    ]);
}

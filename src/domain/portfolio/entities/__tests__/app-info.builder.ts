import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { AppBalanceAppInfo } from '@/domain/portfolio/entities/app-balance.entity';

export function appInfoBuilder(): IBuilder<AppBalanceAppInfo> {
  return new Builder<AppBalanceAppInfo>()
    .with('name', faker.company.name())
    .with('logoUrl', faker.internet.url({ appendSlash: false }))
    .with('url', faker.internet.url({ appendSlash: false }));
}

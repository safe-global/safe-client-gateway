import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { SafeAppInfo } from '@/routes/transactions/entities/safe-app-info.entity';

export function safeAppInfoBuilder(): IBuilder<SafeAppInfo> {
  return new Builder<SafeAppInfo>()
    .with('name', faker.word.words())
    .with('url', faker.internet.url({ appendSlash: false }))
    .with('logoUri', faker.internet.url({ appendSlash: false }));
}

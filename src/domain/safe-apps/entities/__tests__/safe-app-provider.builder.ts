import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { SafeAppProvider } from '@/domain/safe-apps/entities/safe-app-provider.entity';

export function safeAppProviderBuilder(): IBuilder<SafeAppProvider> {
  return new Builder<SafeAppProvider>()
    .with('url', faker.internet.url({ appendSlash: false }))
    .with('name', faker.word.sample());
}

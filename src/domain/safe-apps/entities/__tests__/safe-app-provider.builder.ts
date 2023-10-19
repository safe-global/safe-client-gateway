import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { SafeAppProvider } from '@/domain/safe-apps/entities/safe-app-provider.entity';

export function safeAppProviderBuilder(): IBuilder<SafeAppProvider> {
  return Builder.new<SafeAppProvider>()
    .with('url', faker.internet.url({ appendSlash: false }))
    .with('name', faker.word.sample());
}

import { faker } from '@faker-js/faker';
import { SafeAppProvider } from '../safe-app-provider.entity';
import { Builder, IBuilder } from '../../../../__tests__/builder';

export function safeAppProviderBuilder(): IBuilder<SafeAppProvider> {
  return Builder.new<SafeAppProvider>()
    .with('url', faker.internet.url({ appendSlash: false }))
    .with('name', faker.word.sample());
}

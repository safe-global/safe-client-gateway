import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { SafeAppInfo } from '../safe-app-info.entity';

export function safeAppInfoBuilder(): IBuilder<SafeAppInfo> {
  return Builder.new<SafeAppInfo>()
    .with('name', faker.word.words())
    .with('url', faker.internet.url({ appendSlash: false }))
    .with('logoUri', faker.internet.url({ appendSlash: false }));
}

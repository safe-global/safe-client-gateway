import { faker } from '@faker-js/faker';
import { SafeApp } from '../safe-app.entity';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { safeAppAccessControlBuilder } from './safe-app-access-control.builder';
import { safeAppProviderBuilder } from './safe-app-provider.builder';

export function safeAppBuilder(): IBuilder<SafeApp> {
  return Builder.new<SafeApp>()
    .with('id', faker.datatype.number())
    .with('url', faker.internet.url())
    .with('name', faker.random.word())
    .with('iconUrl', faker.internet.url())
    .with('description', faker.random.word())
    .with('chainIds', [faker.datatype.number(), faker.datatype.number()])
    .with('provider', safeAppProviderBuilder().build())
    .with('accessControl', safeAppAccessControlBuilder().build())
    .with('tags', [faker.random.word(), faker.random.word()]);
}

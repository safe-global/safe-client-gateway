import { Builder, IBuilder } from '@/__tests__/builder';
import { Subscription } from '@/domain/account/entities/subscription.entity';
import { faker } from '@faker-js/faker';

export function subscriptionBuilder(): IBuilder<Subscription> {
  return new Builder<Subscription>()
    .with('key', faker.word.sample())
    .with('name', faker.word.words());
}

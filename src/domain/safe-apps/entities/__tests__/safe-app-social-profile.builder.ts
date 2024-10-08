import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { SafeAppSocialProfile } from '@/domain/safe-apps/entities/safe-app-social-profile.entity';

export function safeAppSocialProfileBuilder(): IBuilder<SafeAppSocialProfile> {
  return new Builder<SafeAppSocialProfile>()
    .with('platform', faker.word.sample())
    .with('url', faker.internet.url({ appendSlash: false }));
}

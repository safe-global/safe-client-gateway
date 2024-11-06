import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { SafeAppSocialProfilePlatforms } from '@/domain/safe-apps/entities/schemas/safe-app.schema';
import type { SafeAppSocialProfile } from '@/domain/safe-apps/entities/safe-app-social-profile.entity';

export function safeAppSocialProfileBuilder(): IBuilder<SafeAppSocialProfile> {
  return new Builder<SafeAppSocialProfile>()
    .with('platform', faker.helpers.objectValue(SafeAppSocialProfilePlatforms))
    .with('url', faker.internet.url({ appendSlash: false }));
}

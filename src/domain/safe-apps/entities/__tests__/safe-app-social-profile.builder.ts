import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { SafeAppSocialProfile } from '../safe-app-social-profile.entity';

export function safeAppSocialProfileBuilder(): IBuilder<SafeAppSocialProfile> {
  return Builder.new<SafeAppSocialProfile>()
    .with('platform', faker.random.word())
    .with('url', faker.internet.url());
}

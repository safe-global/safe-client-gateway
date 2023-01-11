import { faker } from '@faker-js/faker';
import { SafeAppAccessControl } from '../safe-app-access-control.entity';
import { Builder, IBuilder } from '../../../../__tests__/builder';

export function safeAppAccessControlBuilder(): IBuilder<SafeAppAccessControl> {
  return Builder.new<SafeAppAccessControl>().with('type', faker.random.word());
}

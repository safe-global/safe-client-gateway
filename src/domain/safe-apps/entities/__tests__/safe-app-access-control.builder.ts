import { faker } from '@faker-js/faker';
import { random, range } from 'lodash';
import { Builder, IBuilder } from '@/__tests__/builder';
import {
  SafeAppAccessControl,
  SafeAppAccessControlPolicies,
} from '@/domain/safe-apps/entities/safe-app-access-control.entity';

export function safeAppAccessControlBuilder(): IBuilder<SafeAppAccessControl> {
  return new Builder<SafeAppAccessControl>()
    .with('type', SafeAppAccessControlPolicies.DomainAllowlist)
    .with(
      'value',
      range(random(2, 5)).map(() => faker.internet.url({ appendSlash: false })),
    );
}

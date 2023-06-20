import { faker } from '@faker-js/faker';
import { random, range } from 'lodash';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import {
  SafeAppAccessControl,
  SafeAppAccessControlPolicies,
} from '../safe-app-access-control.entity';

export function safeAppAccessControlBuilder(): IBuilder<SafeAppAccessControl> {
  return Builder.new<SafeAppAccessControl>()
    .with('type', SafeAppAccessControlPolicies.DomainAllowlist)
    .with(
      'value',
      range(random(2, 5)).map(() => faker.internet.url({ appendSlash: false })),
    );
}

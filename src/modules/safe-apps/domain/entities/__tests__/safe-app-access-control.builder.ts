import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { SafeAppAccessControl } from '@/modules/safe-apps/domain/entities/safe-app-access-control.entity';
import { SafeAppAccessControlPolicies } from '@/modules/safe-apps/domain/entities/safe-app-access-control.entity';

export function safeAppAccessControlBuilder(): IBuilder<SafeAppAccessControl> {
  return new Builder<SafeAppAccessControl>()
    .with('type', SafeAppAccessControlPolicies.DomainAllowlist)
    .with(
      'value',
      faker.helpers.multiple(() => faker.internet.url({ appendSlash: false }), {
        count: { min: 2, max: 5 },
      }),
    );
}

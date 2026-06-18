// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { DeviceType } from '@/modules/notifications/domain/v2/entities/device-type.entity';
import { NotificationType } from '@/modules/notifications/domain/v2/entities/notification-type.entity';
import type { UpsertSubscriptionsDto } from '@/modules/notifications/domain/v2/entities/upsert-subscriptions.dto.entity';
import { fakeUuid } from '@/validation/entities/schemas/__tests__/uuid.builder';

export function upsertSubscriptionsDtoBuilder(): IBuilder<UpsertSubscriptionsDto> {
  return new Builder<UpsertSubscriptionsDto>()
    .with('cloudMessagingToken', faker.string.alphanumeric({ length: 10 }))
    .with('deviceType', faker.helpers.arrayElement(Object.values(DeviceType)))
    .with('deviceUuid', fakeUuid())
    .with(
      'safes',
      Array.from(
        {
          length: faker.number.int({ min: 1, max: 5 }),
        },
        () => {
          return {
            chainId: faker.string.numeric(),
            address: getAddress(faker.finance.ethereumAddress()),
            notificationTypes: faker.helpers.arrayElements(
              Object.values(NotificationType),
            ),
          };
        },
      ),
    );
}

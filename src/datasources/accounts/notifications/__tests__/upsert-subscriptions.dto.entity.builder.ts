import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { getAddress } from 'viem';
import { UpsertSubscriptionsDto } from '@/datasources/accounts/notifications/entities/upsert-subscriptions.dto.entity';
import { DeviceType } from '@/domain/notifications/entities-v2/device-type.entity';
import { Uuid } from '@/domain/notifications/entities-v2/uuid.entity';
import { NotificationType } from '@/domain/notifications/entities-v2/notification-type.entity';

// TODO: Move to domain
export function upsertSubscriptionsDtoBuilder(): IBuilder<UpsertSubscriptionsDto> {
  return new Builder<UpsertSubscriptionsDto>()
    .with('account', getAddress(faker.finance.ethereumAddress()))
    .with('cloudMessagingToken', faker.string.alphanumeric())
    .with('deviceType', faker.helpers.arrayElement(Object.values(DeviceType)))
    .with('deviceUuid', faker.string.uuid() as Uuid)
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

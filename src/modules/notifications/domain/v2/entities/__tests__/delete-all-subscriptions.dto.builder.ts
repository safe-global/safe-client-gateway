import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { DeleteAllSubscriptionsDto } from '@/modules/notifications/domain/v2/entities/delete-all-subscriptions.dto.entity';
import type { UUID } from 'crypto';
import { Builder } from '@/__tests__/builder';
import type { IBuilder } from '@/__tests__/builder';

export function deleteAllSubscriptionsDtoBuilder(): IBuilder<DeleteAllSubscriptionsDto> {
  return new Builder<DeleteAllSubscriptionsDto>().with(
    'subscriptions',
    Array.from(
      {
        length: faker.number.int({ min: 1, max: 5 }),
      },
      () => {
        return {
          chainId: faker.string.numeric(),
          deviceUuid: faker.string.uuid() as UUID,
          safeAddress: getAddress(faker.finance.ethereumAddress()),
          // signerAddress is undefined by default - use .with() to add it on demand
        };
      },
    ),
  );
}

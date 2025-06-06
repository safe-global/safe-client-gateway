import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { getAddress } from 'viem';
import type { DeleteSubscriptionsDto } from '@/domain/notifications/v2/entities/delete-subscriptions.dto.entity';

export function deleteSubscriptionsDtoBuilder(): IBuilder<DeleteSubscriptionsDto> {
  return new Builder<DeleteSubscriptionsDto>().with(
    'safes',
    Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => ({
      chainId: faker.string.numeric(),
      address: getAddress(faker.finance.ethereumAddress()),
    })),
  );
}

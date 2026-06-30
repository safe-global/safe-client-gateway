// SPDX-License-Identifier: FSL-1.1-MIT

import type { UUID } from 'node:crypto';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';
import { fakeUuid } from '@/validation/entities/schemas/__tests__/uuid.builder';

export function addr(): Address {
  return getAddress(faker.finance.ethereumAddress());
}

export function createSubscriber(): {
  subscriber: Address;
  deviceUuid: UUID;
  cloudMessagingToken: string;
} {
  return {
    subscriber: addr(),
    deviceUuid: fakeUuid(),
    cloudMessagingToken: faker.string.alphanumeric(32),
  };
}

export function createSubscribers(count: number): Array<{
  subscriber: Address;
  deviceUuid: UUID;
  cloudMessagingToken: string;
}> {
  return Array.from({ length: count }, () => createSubscriber());
}

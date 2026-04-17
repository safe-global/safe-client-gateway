// SPDX-License-Identifier: FSL-1.1-MIT

import type { UUID } from 'node:crypto';
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';

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
    deviceUuid: faker.string.uuid() as UUID,
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

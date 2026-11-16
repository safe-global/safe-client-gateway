// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '#/__tests__/builder';
import { Builder } from '#/__tests__/builder';
import type { SafeQueueDelegate } from '#/modules/safe-queue/entities/delegate.entity';

export function safeQueueDelegateBuilder(): IBuilder<SafeQueueDelegate> {
  return new Builder<SafeQueueDelegate>()
    .with('delegate', getAddress(faker.finance.ethereumAddress()))
    .with('delegator', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric({ length: { min: 1, max: 6 } }))
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('label', faker.word.words())
    .with('created', faker.date.past())
    .with('modified', faker.date.recent());
}

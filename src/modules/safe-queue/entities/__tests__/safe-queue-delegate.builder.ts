// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '#/__tests__/builder';
import { Builder } from '#/__tests__/builder';
import type { Delegate } from '#/modules/delegate/domain/entities/delegate.entity';
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

/**
 * The queue-service record of a delegate built with the domain builders, so a
 * spec can serve an existing {@link Delegate} fixture from the queue service.
 */
export function safeQueueDelegateFrom(
  delegate: Delegate,
  chainId: string,
): IBuilder<SafeQueueDelegate> {
  return safeQueueDelegateBuilder()
    .with('chainId', chainId)
    .with('safe', delegate.safe)
    .with('delegate', delegate.delegate)
    .with('delegator', delegate.delegator)
    .with('label', delegate.label);
}

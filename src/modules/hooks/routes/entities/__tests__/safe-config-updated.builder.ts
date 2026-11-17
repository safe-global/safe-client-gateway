// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '#/__tests__/builder';
import { Builder } from '#/__tests__/builder';
import { TransactionEventType } from '#/modules/hooks/routes/entities/event-type.entity';
import type { SafeConfigUpdated } from '#/modules/hooks/routes/entities/safe-config-updated.entity';

export function safeConfigUpdatedEventBuilder(): IBuilder<SafeConfigUpdated> {
  return new Builder<SafeConfigUpdated>()
    .with('type', TransactionEventType.SAFE_CONFIG_UPDATED)
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric())
    .with('txHash', faker.string.hexadecimal());
}

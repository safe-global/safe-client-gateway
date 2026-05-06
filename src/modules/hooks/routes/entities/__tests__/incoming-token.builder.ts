// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import type { IncomingToken } from '@/modules/hooks/routes/entities/incoming-token.entity';

export function incomingTokenEventBuilder(): IBuilder<IncomingToken> {
  return new Builder<IncomingToken>()
    .with('type', TransactionEventType.INCOMING_TOKEN)
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric())
    .with('tokenAddress', getAddress(faker.finance.ethereumAddress()))
    .with('txHash', faker.string.hexadecimal());
}

// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import type { OutgoingEther } from '@/modules/hooks/routes/entities/outgoing-ether.entity';

export function outgoingEtherEventBuilder(): IBuilder<OutgoingEther> {
  return new Builder<OutgoingEther>()
    .with('type', TransactionEventType.OUTGOING_ETHER)
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric())
    .with('txHash', faker.string.hexadecimal())
    .with('value', faker.string.numeric());
}

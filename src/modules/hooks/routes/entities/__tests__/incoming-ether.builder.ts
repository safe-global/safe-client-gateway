import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import type { IncomingEther } from '@/modules/hooks/routes/entities/incoming-ether.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function incomingEtherEventBuilder(): IBuilder<IncomingEther> {
  return new Builder<IncomingEther>()
    .with('type', TransactionEventType.INCOMING_ETHER)
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric())
    .with('txHash', faker.string.hexadecimal())
    .with('value', faker.string.numeric());
}

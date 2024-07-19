import { IBuilder, Builder } from '@/__tests__/builder';
import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import { IncomingEther } from '@/routes/hooks/entities/incoming-ether.entity';
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

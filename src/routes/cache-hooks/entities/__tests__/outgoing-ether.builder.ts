import { IBuilder, Builder } from '@/__tests__/builder';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { OutgoingEther } from '@/routes/cache-hooks/entities/outgoing-ether.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function outgoingEtherEventBuilder(): IBuilder<OutgoingEther> {
  return new Builder<OutgoingEther>()
    .with('type', EventType.OUTGOING_ETHER)
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric())
    .with('txHash', faker.string.hexadecimal())
    .with('value', faker.string.numeric());
}

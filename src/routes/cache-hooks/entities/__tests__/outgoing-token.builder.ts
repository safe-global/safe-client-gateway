import { IBuilder, Builder } from '@/__tests__/builder';
import { EventType } from '@/routes/cache-hooks/entities/event-type.entity';
import { OutgoingToken } from '@/routes/cache-hooks/entities/outgoing-token.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function outgoingTokenEventBuilder(): IBuilder<OutgoingToken> {
  return new Builder<OutgoingToken>()
    .with('type', EventType.OUTGOING_TOKEN)
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric())
    .with('tokenAddress', getAddress(faker.finance.ethereumAddress()))
    .with('txHash', faker.string.hexadecimal());
}

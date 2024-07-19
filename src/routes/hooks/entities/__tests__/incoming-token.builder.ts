import { IBuilder, Builder } from '@/__tests__/builder';
import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import { IncomingToken } from '@/routes/hooks/entities/incoming-token.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function incomingTokenEventBuilder(): IBuilder<IncomingToken> {
  return new Builder<IncomingToken>()
    .with('type', TransactionEventType.INCOMING_TOKEN)
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('chainId', faker.string.numeric())
    .with('tokenAddress', getAddress(faker.finance.ethereumAddress()))
    .with('txHash', faker.string.hexadecimal());
}

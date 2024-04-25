import { IBuilder, Builder } from '@/__tests__/builder';
import { AuthPayload } from '@/routes/auth/entities/auth-payload.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function authPayloadBuilder(): IBuilder<AuthPayload> {
  return new Builder<AuthPayload>()
    .with('chain_id', faker.string.numeric({ exclude: ['0'] }))
    .with('signer_address', getAddress(faker.finance.ethereumAddress()));
}

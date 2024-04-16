import { IBuilder, Builder } from '@/__tests__/builder';
import { JwtAccessTokenPayload } from '@/routes/auth/entities/jwt-access-token.payload.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function jwtAccessTokenPayloadBuilder(): IBuilder<JwtAccessTokenPayload> {
  return new Builder<JwtAccessTokenPayload>()
    .with('chain_id', faker.string.numeric({ exclude: ['0'] }))
    .with('signer_address', getAddress(faker.finance.ethereumAddress()));
}

import { IBuilder, Builder } from '@/__tests__/builder';
import { JwtAccessTokenPayload } from '@/domain/auth/entities/jwt-access-token.payload.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function jwtAccessTokenPayloadBuilder(): IBuilder<JwtAccessTokenPayload> {
  return new Builder<JwtAccessTokenPayload>().with(
    'signer_address',
    getAddress(faker.finance.ethereumAddress()),
  );
}

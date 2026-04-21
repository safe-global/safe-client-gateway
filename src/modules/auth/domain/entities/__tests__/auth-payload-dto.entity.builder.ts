// SPDX-License-Identifier: FSL-1.1-MIT
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type {
  SiweAuthPayloadDto,
  OidcAuthPayloadDto,
} from '@/modules/auth/domain/entities/auth-payload.entity';
import { AuthMethod } from '@/modules/auth/domain/entities/auth-payload.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function siweAuthPayloadDtoBuilder(): IBuilder<SiweAuthPayloadDto> {
  return new Builder<SiweAuthPayloadDto>()
    .with('auth_method', AuthMethod.Siwe)
    .with('sub', faker.string.numeric({ exclude: ['0'] }))
    .with('chain_id', faker.string.numeric({ exclude: ['0'] }))
    .with('signer_address', getAddress(faker.finance.ethereumAddress()));
}

export function oidcAuthPayloadDtoBuilder(): IBuilder<OidcAuthPayloadDto> {
  return new Builder<OidcAuthPayloadDto>()
    .with('auth_method', AuthMethod.Oidc)
    .with('sub', faker.string.numeric({ exclude: ['0'] }));
}

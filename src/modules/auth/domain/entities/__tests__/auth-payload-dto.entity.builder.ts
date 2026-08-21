// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type {
  OidcAuthPayloadDto,
  SiweAuthPayloadDto,
} from '@/modules/auth/domain/entities/auth-payload.entity';
import { AuthMethod } from '@/modules/auth/domain/entities/auth-payload.entity';

export function siweAuthPayloadDtoBuilder(): IBuilder<SiweAuthPayloadDto> {
  return new Builder<SiweAuthPayloadDto>()
    .with('auth_method', AuthMethod.Siwe)
    .with('sub', faker.string.numeric({ exclude: ['0'] }))
    .with('chain_id', faker.string.numeric({ exclude: ['0'] }))
    .with('signer_address', getAddress(faker.finance.ethereumAddress()));
}

/**
 * An OIDC session as it exists in production: multi-factor authentication is
 * mandatory on every login, so a freshly signed-in session always carries a
 * recent `mfa_verified_at`. Tests covering the elevation window override it
 * with a stale value or `undefined`.
 */
export function oidcAuthPayloadDtoBuilder(): IBuilder<OidcAuthPayloadDto> {
  return new Builder<OidcAuthPayloadDto>()
    .with('auth_method', AuthMethod.Oidc)
    .with('sub', faker.string.numeric({ exclude: ['0'] }))
    .with('mfa_verified_at', Math.floor(Date.now() / 1_000));
}

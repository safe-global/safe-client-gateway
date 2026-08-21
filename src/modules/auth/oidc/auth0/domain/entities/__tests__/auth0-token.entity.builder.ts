// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Auth0Token } from '@/modules/auth/oidc/auth0/domain/entities/auth0-token.entity';
import { fakeEmailAddress } from '@/validation/entities/schemas/__tests__/email-address.builder';

/**
 * A verified Auth0 ID token as the callback receives it.
 *
 * `exp`/`nbf`/`iat` default to undefined rather than dates so a caller opts
 * into token expiry explicitly — the gateway's own max-validity ceiling
 * applies when they are absent, which is the more common case under test.
 * `amr` likewise defaults to undefined, matching Auth0 omitting it when no
 * challenge happened in the transaction.
 */
export function auth0TokenBuilder(): IBuilder<Auth0Token> {
  return new Builder<Auth0Token>()
    .with('sub', `auth0|${faker.string.uuid()}`)
    .with('email', fakeEmailAddress())
    .with('email_verified', true)
    .with('exp', undefined)
    .with('nbf', undefined)
    .with('iat', undefined)
    .with('amr', undefined);
}

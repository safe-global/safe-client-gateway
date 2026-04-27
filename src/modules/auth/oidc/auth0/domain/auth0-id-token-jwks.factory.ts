// SPDX-License-Identifier: FSL-1.1-MIT
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { AUTH0_JWKS_PATH } from '@/modules/auth/oidc/auth0/auth0.constants';
import type { IAuth0IdTokenJwks } from '@/modules/auth/oidc/auth0/domain/auth0-id-token-jwks.interface';
import { createRemoteJWKSet } from 'jose';

export function auth0IdTokenJwksFactory(
  configurationService: IConfigurationService,
): IAuth0IdTokenJwks {
  const domain = configurationService.getOrThrow<string>('auth.auth0.domain');
  const issuer = `https://${domain}/`;

  return createRemoteJWKSet(new URL(AUTH0_JWKS_PATH, issuer), {
    cacheMaxAge: configurationService.getOrThrow<number>(
      'auth.auth0.jwksCacheMaxAgeMs',
    ),
    cooldownDuration: configurationService.getOrThrow<number>(
      'auth.auth0.jwksCooldownMs',
    ),
  });
}

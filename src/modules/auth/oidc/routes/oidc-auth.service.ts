// SPDX-License-Identifier: FSL-1.1-MIT
import { randomBytes } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  assertExpirationTime,
  getMaxExpirationTime,
} from '@/modules/auth/utils/token-expiration.utils';
import {
  getRedirectConfig,
  resolveAndValidateRedirectUrl,
  type RedirectConfig,
} from '@/modules/auth/utils/auth-redirect.helper';
import { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import { AuthMethod } from '@/modules/auth/domain/entities/auth-payload.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  OidcState,
  OidcStateSchema,
} from '@/modules/auth/oidc/routes/entities/oidc-state.entity';
import { IAuth0Repository } from '@/modules/auth/oidc/auth0/domain/auth0.repository.interface';
import type { OidcConnection } from '@/modules/auth/oidc/routes/entities/oidc-connection.entity';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { getMillisecondsUntil } from '@/domain/common/utils/time';

type OidcAuthTokenResponse = {
  accessToken: string;
  maxAge: number | undefined;
};

@Injectable()
export class OidcAuthService {
  private readonly maxValidityPeriodInSeconds: number;
  private readonly stateTtlMs: number;
  private readonly redirectConfig: RedirectConfig;

  constructor(
    @Inject(IAuthRepository)
    private readonly authRepository: IAuthRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IUsersRepository)
    private readonly usersRepository: IUsersRepository,
    @Inject(IAuth0Repository)
    private readonly auth0Repository: IAuth0Repository,
  ) {
    this.maxValidityPeriodInSeconds = this.configurationService.getOrThrow(
      'auth.maxValidityPeriodSeconds',
    );
    this.stateTtlMs =
      this.configurationService.getOrThrow<number>('auth.stateTtlMs');
    this.redirectConfig = getRedirectConfig(this.configurationService);
  }

  public async authenticateWithOidc(
    code: string,
  ): Promise<OidcAuthTokenResponse> {
    const {
      sub: extUserId,
      email,
      email_verified: emailVerified,
      exp: expirationTime,
      nbf,
      iat,
    } = await this.auth0Repository.authenticateWithAuthorizationCode(code);

    const maxExpirationTime = getMaxExpirationTime(
      this.maxValidityPeriodInSeconds,
    );

    if (expirationTime) {
      assertExpirationTime(
        expirationTime,
        maxExpirationTime,
        this.maxValidityPeriodInSeconds,
      );
    }

    const userId =
      await this.usersRepository.findOrCreateByExtUserId(extUserId);
    if (emailVerified && email) {
      await this.usersRepository.persistVerifiedEmail(userId, email);
    } else if (email) {
      await this.usersRepository.assertEmailCanBeUsedByUser(userId, email);
    }
    const accessToken = this.authRepository.signToken(
      {
        auth_method: AuthMethod.Oidc,
        sub: userId.toString(),
      },
      {
        nbf,
        exp: expirationTime ?? maxExpirationTime,
        iat: iat ?? new Date(),
      },
    );

    const exp = expirationTime ?? maxExpirationTime;
    return {
      accessToken,
      maxAge: getMillisecondsUntil(exp),
    };
  }

  /**
   * Builds the OIDC authorization request.
   *
   * Generates a CSRF token and encodes it — together with the optional
   * redirect URL — as a base64url JSON payload in the OAuth {@link https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.1 state} parameter.
   *
   * @param redirectUrl - Optional post-login redirect URL. Must be
   *   same-origin as the configured {@link postLoginRedirectUri}.
   * @param connection - Optional OIDC connection name to route directly
   *   to a specific identity provider.
   * @returns The OIDC authorization URL, the encoded state, and its TTL.
   * @throws {BadRequestException} If {@link redirectUrl} is not same-origin.
   */
  public createOidcAuthorizationRequest(
    redirectUrl?: string,
    connection?: OidcConnection,
  ): {
    authorizationUrl: string;
    state: string;
    stateMaxAge: number;
  } {
    const resolvedRedirectUrl = redirectUrl
      ? resolveAndValidateRedirectUrl(this.redirectConfig, redirectUrl)
      : undefined;

    const statePayload = {
      csrf: randomBytes(32).toString('hex'),
      redirectUrl: resolvedRedirectUrl,
    };

    const state = Buffer.from(JSON.stringify(statePayload)).toString(
      'base64url',
    );

    return {
      authorizationUrl: this.auth0Repository.getAuthorizationUrl(
        state,
        connection,
      ),
      state,
      stateMaxAge: this.stateTtlMs,
    };
  }

  public getPostLoginRedirectUri(state?: string): string {
    if (!state) {
      return this.redirectConfig.postLoginRedirectUri;
    }

    return (
      this.decodeState(state).redirectUrl ||
      this.redirectConfig.postLoginRedirectUri
    );
  }

  private decodeState(state: string): OidcState {
    try {
      const json = Buffer.from(state, 'base64url').toString('utf-8');
      return OidcStateSchema.parse(JSON.parse(json));
    } catch {
      throw new UnauthorizedException('Invalid OAuth state');
    }
  }
}

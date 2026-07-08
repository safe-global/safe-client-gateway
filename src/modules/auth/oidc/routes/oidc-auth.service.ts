// SPDX-License-Identifier: FSL-1.1-MIT
import { randomBytes } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { getMillisecondsUntil } from '@/domain/common/utils/time';
import { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import { AuthMethod } from '@/modules/auth/domain/entities/auth-payload.entity';
import { IAuth0Repository } from '@/modules/auth/oidc/auth0/domain/auth0.repository.interface';
import type { OidcConnection } from '@/modules/auth/oidc/routes/entities/oidc-connection.entity';
import {
  type OidcState,
  OidcStateSchema,
} from '@/modules/auth/oidc/routes/entities/oidc-state.entity';
import {
  getRedirectConfig,
  type RedirectConfig,
  resolveAndValidateRedirectUrl,
} from '@/modules/auth/utils/auth-redirect.helper';
import {
  assertExpirationTime,
  getMaxExpirationTime,
} from '@/modules/auth/utils/token-expiration.utils';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';

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

  /**
   * Whether the given state payload marks a step-up (elevation) round-trip.
   */
  public isElevationState(state: string): boolean {
    return this.decodeState(state).elevate === true;
  }

  public async authenticateWithOidc(
    code: string,
    elevated = false,
  ): Promise<OidcAuthTokenResponse> {
    const {
      sub: extUserId,
      email,
      email_verified: emailVerified,
      exp: expirationTime,
      nbf,
      iat,
      amr,
      acr,
      auth_time: authTime,
    } = await this.auth0Repository.authenticateWithAuthorizationCode(code);

    if (!(email && emailVerified)) {
      throw new UnauthorizedException(
        'A verified email is required to sign in',
      );
    }

    // A step-up round-trip is only valid if the provider actually performed
    // multi-factor authentication for it.
    if (elevated && !amr?.includes('mfa')) {
      throw new UnauthorizedException(
        'Multi-factor authentication was not performed',
      );
    }

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

    const userId = await this.usersRepository.findOrCreateByExtUserIdAndEmail(
      extUserId,
      email,
    );
    const accessToken = this.authRepository.signToken(
      {
        auth_method: AuthMethod.Oidc,
        sub: userId.toString(),
        amr,
        acr,
        auth_time: authTime,
        // Server-side stamp: Auth0's auth_time reflects the SSO login, not
        // the MFA challenge, so elevation freshness is recorded here instead.
        mfa_verified_at: elevated ? Math.floor(Date.now() / 1_000) : undefined,
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
   * @param elevate - When true, requests step-up authentication: the
   *   provider must re-challenge multi-factor authentication and stamp a
   *   fresh auth_time, regardless of an existing provider session.
   * @returns The OIDC authorization URL, the encoded state, and its TTL.
   * @throws {BadRequestException} If {@link redirectUrl} is not same-origin.
   */
  public createOidcAuthorizationRequest(
    redirectUrl?: string,
    connection?: OidcConnection,
    elevate?: boolean,
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
      elevate: elevate || undefined,
    };

    const state = Buffer.from(JSON.stringify(statePayload)).toString(
      'base64url',
    );

    return {
      authorizationUrl: this.auth0Repository.getAuthorizationUrl(
        state,
        connection,
        elevate,
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

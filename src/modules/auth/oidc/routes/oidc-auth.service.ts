// SPDX-License-Identifier: FSL-1.1-MIT
import { randomBytes } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { getSecondsUntil } from '@/domain/common/utils/time';
import { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import {
  AuthMethod,
  type AuthPayload,
} from '@/modules/auth/domain/entities/auth-payload.entity';
import { TOTP_AUTHENTICATION_METHOD_TYPE } from '@/modules/auth/oidc/auth0/datasources/entities/auth0-authentication-method.entity';
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
  userId: number;
};

export type Authenticator = {
  id: string;
  type: string;
  name?: string;
  createdAt?: string;
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
   * Whether the given state payload marks an authenticator-enrollment
   * round-trip.
   */
  public isEnrollmentState(state: string): boolean {
    return this.decodeState(state).enroll === true;
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

    if (!(email && emailVerified)) {
      throw new UnauthorizedException(
        'A verified email is required to sign in',
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
      maxAge: getSecondsUntil(exp),
      userId,
    };
  }

  /**
   * Lists the MFA authentication methods of the authenticated user, for the
   * self-service authenticator management UI (Auth0's recommended flow for
   * factor replacement).
   *
   * Security invariant: the Auth0 user ID must always be resolved from the
   * authenticated gateway payload. Never accept a local or Auth0 user ID from
   * request input here, as the Management API token has tenant-wide access.
   */
  public async listAuthenticators(
    authPayload: AuthPayload,
  ): Promise<Array<Authenticator>> {
    const extUserId = await this.getExtUserId(authPayload);
    const methods =
      await this.auth0Repository.listUserAuthenticationMethods(extUserId);

    return methods.map((method) => ({
      id: method.id,
      type: method.type,
      name: method.name,
      createdAt: method.created_at,
    }));
  }

  /**
   * Removes authenticator (TOTP) enrollments superseded by a hosted
   * enrollment round-trip: every TOTP method except the most recently
   * created one. The recovery code is untouched.
   *
   * Security invariant: {@link userId} must come from the verified OIDC
   * callback result, never from request input. Authentication method IDs must
   * likewise come from Auth0's response for that resolved user.
   */
  public async cleanupSupersededAuthenticators(userId: number): Promise<void> {
    const user = await this.usersRepository.findOneOrFail({ id: userId });
    if (!user.extUserId) {
      return;
    }

    const methods = await this.auth0Repository.listUserAuthenticationMethods(
      user.extUserId,
    );
    const totpMethods = methods
      .filter((method) => method.type === TOTP_AUTHENTICATION_METHOD_TYPE)
      .sort(
        (a, b) =>
          new Date(a.created_at ?? 0).getTime() -
          new Date(b.created_at ?? 0).getTime(),
      );

    for (const method of totpMethods.slice(0, -1)) {
      await this.auth0Repository.deleteUserAuthenticationMethod(
        user.extUserId,
        method.id,
      );
    }
  }

  private async getExtUserId(authPayload: AuthPayload): Promise<string> {
    const user = await this.usersRepository.findOneOrFail({
      id: Number(authPayload.getUserId()),
    });

    if (!user.extUserId) {
      throw new UnauthorizedException('User is not linked to an OIDC identity');
    }

    return user.extUserId;
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
   * @param enroll - When true, requests hosted enrollment of a new
   *   authenticator: the provider challenges an existing factor, then walks
   *   the user through enrolling the new one; the callback removes
   *   superseded enrollments.
   * @returns The OIDC authorization URL, the encoded state, and its TTL.
   * @throws {BadRequestException} If {@link redirectUrl} is not same-origin.
   */
  public createOidcAuthorizationRequest(
    redirectUrl?: string,
    connection?: OidcConnection,
    enroll?: boolean,
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
      enroll: enroll || undefined,
    };

    const state = Buffer.from(JSON.stringify(statePayload)).toString(
      'base64url',
    );

    return {
      authorizationUrl: this.auth0Repository.getAuthorizationUrl(
        state,
        connection,
        enroll,
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

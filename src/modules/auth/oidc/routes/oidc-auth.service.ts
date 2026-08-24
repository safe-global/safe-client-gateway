// SPDX-License-Identifier: FSL-1.1-MIT
import { randomBytes } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { getSecondsUntil } from '@/domain/common/utils/time';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import {
  AuthMethod,
  type AuthPayload,
} from '@/modules/auth/domain/entities/auth-payload.entity';
import { TOTP_AUTHENTICATION_METHOD_TYPE } from '@/modules/auth/oidc/auth0/datasources/entities/auth0-authentication-method.entity';
import { IAuth0Repository } from '@/modules/auth/oidc/auth0/domain/auth0.repository.interface';
import type { Authenticator } from '@/modules/auth/oidc/routes/entities/authenticator.entity';
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

@Injectable()
export class OidcAuthService {
  /** RFC 8176 method reference Auth0 sets once a second factor was presented. */
  private static readonly MFA_AMR_VALUE = 'mfa';
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
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
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

  /**
   * Whether the given state payload marks a step-up (elevation) round-trip.
   *
   * Callers must only pass a state that has already been matched against the
   * state cookie, otherwise the flag is attacker-controlled.
   */
  public isElevationState(state: string): boolean {
    return this.decodeState(state).elevate === true;
  }

  /**
   * @param elevate - Whether this callback completes a step-up round-trip. When
   *   true the provider must have performed a multi-factor challenge, and the
   *   request is rejected if it did not.
   * @param priorAccessToken - The session cookie that was present when the
   *   step-up round-trip completed, if any. On elevation its expiry is carried
   *   over to the new token, so a step-up never extends the session; without a
   *   valid one there is nothing to elevate and the request is rejected.
   */
  public async authenticateWithOidc(
    code: string,
    elevate = false,
    priorAccessToken?: string,
  ): Promise<OidcAuthTokenResponse> {
    const {
      sub: extUserId,
      email,
      email_verified: emailVerified,
      exp: expirationTime,
      nbf,
      iat,
      amr,
    } = await this.auth0Repository.authenticateWithAuthorizationCode(code);

    if (!(email && emailVerified)) {
      throw new UnauthorizedException(
        'A verified email is required to sign in',
      );
    }

    // Auth0 injects `amr` only for a transaction in which the user actually
    // passed a challenge, so this both proves the step-up happened and guards
    // against a tenant whose configuration silently ignores `acr_values`,
    // whatever the reason — the challenge is never taken on trust.
    const hasMultiFactor =
      amr?.includes(OidcAuthService.MFA_AMR_VALUE) === true;

    if (elevate && !hasMultiFactor) {
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

    // A step-up elevates an existing session, so it must not extend it: the
    // elevated token keeps the prior session's expiry, and the hard logout
    // still lands where the original login put it. With no live session to
    // elevate — it expired while the user was on the challenge page — the
    // step-up fails rather than minting a fresh session: elevation would
    // otherwise double as a login whose first factor is only Auth0's
    // longer-lived SSO session. The carried-over expiry is our own verified
    // token's, so it can only shorten the lifetime — but the max-validity
    // bound is enforced rather than argued.
    let exp: Date;
    if (elevate) {
      const priorExpiration = this.getPriorExpiration(priorAccessToken);
      if (!priorExpiration) {
        throw new UnauthorizedException('There is no session to elevate');
      }
      exp =
        priorExpiration < maxExpirationTime
          ? priorExpiration
          : maxExpirationTime;
    } else {
      exp = expirationTime ?? maxExpirationTime;
    }

    const userId = await this.usersRepository.findOrCreateByExtUserIdAndEmail(
      extUserId,
      email,
    );
    const accessToken = this.authRepository.signToken(
      {
        auth_method: AuthMethod.Oidc,
        sub: userId.toString(),
        // Stamped from the gateway's clock whenever a challenge was actually
        // passed — on a step-up and equally on a first login, which is itself
        // multi-factor. Auth0's `auth_time` is unusable here: it records when
        // the SSO session started, and a step-up inside that session does not
        // advance it.
        mfa_verified_at: hasMultiFactor
          ? Math.floor(Date.now() / 1_000)
          : undefined,
      },
      {
        nbf,
        exp,
        iat: iat ?? new Date(),
      },
    );

    return {
      accessToken,
      maxAge: getSecondsUntil(exp),
      userId,
    };
  }

  /**
   * The expiry the elevated session must keep: the prior session's own.
   *
   * The session lifetime is an absolute timeout — its job is to bound how
   * long any one session lives, and a step-up proves only the second factor,
   * so it must not reset that clock. Returns undefined when there is no
   * (valid) prior session; the caller rejects the elevation in that case.
   */
  private getPriorExpiration(priorAccessToken?: string): Date | undefined {
    if (!priorAccessToken) {
      return undefined;
    }

    try {
      return this.authRepository.decodeToken(priorAccessToken).exp;
    } catch (err) {
      // Expected on a session that expired while the user was on the
      // challenge page; only the error message is logged, never the token.
      this.loggingService.debug(asError(err).message);
      return undefined;
    }
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
    const totpMethods = methods.filter(
      (method) => method.type === TOTP_AUTHENTICATION_METHOD_TYPE,
    );

    if (totpMethods.length <= 1) {
      return;
    }

    if (totpMethods.some((method) => !method.created_at)) {
      throw new Error(
        'Cannot clean up TOTP authentication methods without created_at',
      );
    }

    totpMethods.sort(
      (a, b) =>
        Date.parse(a.created_at as string) - Date.parse(b.created_at as string),
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
   * @param options.connection - Optional OIDC connection name to route
   *   directly to a specific identity provider.
   * @param options.enroll - When true, requests hosted enrollment of a new
   *   authenticator: the provider challenges an existing factor, then walks
   *   the user through enrolling the new one; the callback removes
   *   superseded enrollments.
   * @param options.elevate - When true, requests step-up authentication: the
   *   provider re-challenges a second factor even though the session is
   *   already established, and the callback elevates the session.
   * @returns The OIDC authorization URL, the encoded state, and its TTL.
   * @throws {BadRequestException} If {@link redirectUrl} is not same-origin.
   */
  public createOidcAuthorizationRequest(
    redirectUrl?: string,
    {
      connection,
      enroll,
      elevate,
    }: {
      connection?: OidcConnection;
      enroll?: boolean;
      elevate?: boolean;
    } = {},
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
      elevate: elevate || undefined,
    };

    const state = Buffer.from(JSON.stringify(statePayload)).toString(
      'base64url',
    );

    return {
      authorizationUrl: this.auth0Repository.getAuthorizationUrl(state, {
        connection,
        enroll,
        elevate,
      }),
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

// SPDX-License-Identifier: FSL-1.1-MIT
import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SiweDto } from '@/modules/auth/routes/entities/siwe.dto.entity';
import { ISiweRepository } from '@/modules/siwe/domain/siwe.repository.interface';
import { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import {
  AuthMethod,
  AuthPayloadDto,
} from '@/modules/auth/domain/entities/auth-payload.entity';
import { JwtPayloadWithClaims } from '@/datasources/jwt/jwt-claims.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { OidcStateSchema } from '@/modules/auth/routes/entities/oidc-state.entity';
import { IAuth0Repository } from '@/modules/auth/auth0/domain/auth0.repository.interface';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';

type AuthTokenResponse = {
  accessToken: string;
};

@Injectable()
export class AuthService {
  private readonly maxValidityPeriodInSeconds: number;

  constructor(
    @Inject(ISiweRepository)
    private readonly siweRepository: ISiweRepository,
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
  }

  public async getNonce(): Promise<{
    nonce: string;
  }> {
    return await this.siweRepository.generateNonce();
  }

  public async authenticateWithSiwe(args: SiweDto): Promise<AuthTokenResponse> {
    const { chainId, address, notBefore, issuedAt, expirationTime } =
      await this.siweRepository.getValidatedSiweMessage(args);

    const maxExpirationTime = this.getMaxExpirationTime();

    if (expirationTime) {
      this.assertExpirationTime(expirationTime, maxExpirationTime);
    }

    const userId =
      await this.usersRepository.findOrCreateByWalletAddress(address);
    const maxExpirationTime = this.getMaxExpirationTime();

    if (expirationTime) {
      this.assertExpirationTime(expirationTime, maxExpirationTime);
    }

    const userId =
      await this.usersRepository.findOrCreateByWalletAddress(address);

    const accessToken = this.authRepository.signToken(
      {
        auth_method: AuthMethod.Siwe,
        sub: userId.toString(),
        chain_id: chainId.toString(),
        signer_address: address,
      },
      {
        ...(notBefore && {
          nbf: new Date(notBefore),
        }),
        exp: expirationTime
          ? new Date(expirationTime)
          : new Date(maxExpirationTime),
        iat: issuedAt ? new Date(issuedAt) : new Date(),
      },
    );

    return { accessToken };
  }

  public async authenticateWithOidc(code: string): Promise<AuthTokenResponse> {
    const {
      sub: extUserId,
      exp: expirationTime,
      nbf,
      iat,
    } = await this.auth0Repository.authenticateWithAuthorizationCode(code);

    const maxExpirationTime = this.getMaxExpirationTime();

    if (expirationTime) {
      this.assertExpirationTime(expirationTime, maxExpirationTime);
    }

    const userId =
      await this.usersRepository.findOrCreateByExtUserId(extUserId);
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

    return { accessToken };
  }

  /**
   * Builds the OIDC authorization request.
   *
   * Generates a CSRF token and encodes it — together with the optional
   * redirect URL — as a base64url JSON payload in the OAuth {@link https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.1 state} parameter.
   *
   * @param redirectUrl - Optional post-login redirect URL. Must be
   *   same-origin as the configured {@link postLoginRedirectUri}.
   * @returns The OIDC authorization URL, the encoded state, and its TTL.
   * @throws {BadRequestException} If {@link redirectUrl} is not same-origin.
   */
  public createOidcAuthorizationRequest(redirectUrl?: string): {
    authorizationUrl: string;
    state: string;
    stateMaxAge: number;
  } {
    const resolvedRedirectUrl = redirectUrl
      ? this.resolveAndValidateRedirectUrl(redirectUrl)
      : undefined;

    const statePayload = {
      csrf: randomBytes(32).toString('hex'),
      ...(resolvedRedirectUrl ? { redirectUrl: resolvedRedirectUrl } : {}),
    };

    const state = Buffer.from(JSON.stringify(statePayload)).toString(
      'base64url',
    );

    return {
      authorizationUrl: this.auth0Repository.getAuthorizationUrl(state),
      state,
      stateMaxAge: this.auth0Repository.getStateTtlMs(),
    };
  }

  public getPostLoginRedirectUri(state?: string): string {
    const defaultRedirectUri = this.auth0Repository.getPostLoginRedirectUri();

    if (!state) {
      return defaultRedirectUri;
    }

    return this.decodeState(state).redirectUrl || defaultRedirectUri;
  }

  public getTokenPayloadWithClaims(
    accessToken: string,
  ): JwtPayloadWithClaims<AuthPayloadDto> {
    return this.authRepository.decodeToken(accessToken);
  }

  private getMaxExpirationTime(): Date {
    return new Date(Date.now() + this.maxValidityPeriodInSeconds * 1_000);
  }

  private assertExpirationTime(
    expirationTime: Date,
    maxExpirationTime: Date,
  ): void {
    if (expirationTime > maxExpirationTime) {
      throw new ForbiddenException(
        `Cannot issue token for longer than ${this.maxValidityPeriodInSeconds} seconds`,
      );
    }
  }

  private decodeState(state: string): { csrf: string; redirectUrl?: string } {
    try {
      const json = Buffer.from(state, 'base64url').toString('utf-8');
      return OidcStateSchema.parse(JSON.parse(json));
    } catch {
      throw new UnauthorizedException('Invalid OAuth state');
    }
  }

  /**
   * Resolves {@link redirectUrl} against the configured post-login URI and
   * validates that it shares the same origin. Returns the resolved absolute URL.
   *
   * @throws {BadRequestException} On origin mismatch or malformed input.
   */
  private resolveAndValidateRedirectUrl(redirectUrl: string): string {
    try {
      const postLoginUri = this.auth0Repository.getPostLoginRedirectUri();
      const allowed = new URL(postLoginUri);
      const target = new URL(redirectUrl, postLoginUri);

      if (target.origin !== allowed.origin) {
        throw new Error();
      }
      return target.toString();
    } catch {
      throw new BadRequestException('Invalid redirect URL');
    }
  }
}

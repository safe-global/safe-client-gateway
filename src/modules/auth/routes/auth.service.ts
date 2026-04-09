// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import {
  assertExpirationTime,
  getMaxExpirationTime,
} from '@/modules/auth/utils/token-expiration.utils';
import {
  buildAuth0LogoutBaseUrl,
  getRedirectConfig,
  resolveAndValidateRedirectUrl,
  type RedirectConfig,
} from '@/modules/auth/utils/auth-redirect.helper';
import { SiweDto } from '@/modules/auth/routes/entities/siwe.dto.entity';
import { ISiweRepository } from '@/modules/siwe/domain/siwe.repository.interface';
import { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import {
  AuthMethod,
  type AuthPayloadDto,
} from '@/modules/auth/domain/entities/auth-payload.entity';
import type { JwtPayloadWithClaims } from '@/datasources/jwt/jwt-claims.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';

type AuthTokenResponse = {
  accessToken: string;
};
@Injectable()
export class AuthService {
  private readonly maxValidityPeriodInSeconds: number;
  private readonly auth0LogoutBaseUrl: string | null;
  private readonly redirectConfig: RedirectConfig;

  constructor(
    @Inject(ISiweRepository)
    private readonly siweRepository: ISiweRepository,
    @Inject(IAuthRepository)
    private readonly authRepository: IAuthRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IUsersRepository)
    private readonly usersRepository: IUsersRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.maxValidityPeriodInSeconds = this.configurationService.getOrThrow(
      'auth.maxValidityPeriodSeconds',
    );
    this.auth0LogoutBaseUrl = buildAuth0LogoutBaseUrl(
      this.configurationService,
    );
    this.redirectConfig = getRedirectConfig(this.configurationService);
  }

  public async getNonce(): Promise<{
    nonce: string;
  }> {
    return await this.siweRepository.generateNonce();
  }

  public async authenticateWithSiwe(args: SiweDto): Promise<AuthTokenResponse> {
    const { chainId, address, notBefore, issuedAt, expirationTime } =
      await this.siweRepository.getValidatedSiweMessage(args);

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

  public getTokenPayloadWithClaims(
    accessToken: string,
  ): JwtPayloadWithClaims<AuthPayloadDto> {
    return this.authRepository.decodeToken(accessToken);
  }

  public getLogoutRedirectUrl(
    accessToken: string | undefined,
    redirectUrl?: string,
  ): string {
    const resolvedRedirect = resolveAndValidateRedirectUrl(
      this.redirectConfig,
      redirectUrl,
    );

    if (accessToken && this.auth0LogoutBaseUrl) {
      try {
        const payload =
          this.authRepository.decodeTokenWithoutVerification(accessToken);
        if (payload?.auth_method === AuthMethod.Oidc) {
          const url = new URL(this.auth0LogoutBaseUrl);
          url.searchParams.set('returnTo', resolvedRedirect);
          return url.toString();
        }
      } catch (error) {
        this.loggingService.debug(
          `Failed to decode access token during logout: ${error}`,
        );
      }
    }

    return resolvedRedirect;
  }
}

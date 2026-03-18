// SPDX-License-Identifier: FSL-1.1-MIT
import { randomBytes } from 'node:crypto';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { SiweDto } from '@/modules/auth/routes/entities/siwe.dto.entity';
import { ISiweRepository } from '@/modules/siwe/domain/siwe.repository.interface';
import { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import {
  AuthMethod,
  AuthPayloadDto,
} from '@/modules/auth/domain/entities/auth-payload.entity';
import { JwtPayloadWithClaims } from '@/datasources/jwt/jwt-claims.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IAuth0Repository } from '@/modules/auth/auth0/domain/auth0.repository.interface';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';

type AuthTokenResponse = {
  accessToken: string;
};

@Injectable()
export class AuthService {
  private readonly maxValidityPeriodInSeconds: number;
  private readonly stateTtlMs: number;
  private readonly postLoginRedirectUri: string;

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
    this.stateTtlMs =
      this.configurationService.getOrThrow<number>('auth.stateTtlMs');
    this.postLoginRedirectUri = this.configurationService.getOrThrow<string>(
      'auth.postLoginRedirectUri',
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

  public createOidcAuthorizationRequest(): {
    authorizationUrl: string;
    state: string;
    stateMaxAge: number;
  } {
    const state = randomBytes(32).toString('hex');

    return {
      authorizationUrl: this.auth0Repository.getAuthorizationUrl(state),
      state,
      stateMaxAge: this.auth0Repository.getStateTtlMs(),
    };
  }

  public getPostLoginRedirectUri(): string {
    return this.auth0Repository.getPostLoginRedirectUri();
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
}

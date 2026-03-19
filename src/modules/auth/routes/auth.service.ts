// SPDX-License-Identifier: FSL-1.1-MIT
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ISiweRepository } from '@/modules/siwe/domain/siwe.repository.interface';
import { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import {
  AuthMethod,
  AuthPayloadDto,
} from '@/modules/auth/domain/entities/auth-payload.entity';
import { JwtPayloadWithClaims } from '@/datasources/jwt/jwt-claims.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { IAuth0Service } from '@/datasources/auth0/auth0.service.interface';
import { Hex } from 'viem';

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
    @Inject(IAuth0Service)
    private readonly auth0Service: IAuth0Service,
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

  public async verifyOidc(accessToken: string): Promise<AuthTokenResponse> {
    const {
      sub: extUserId,
      exp: expirationTime,
      nbf,
      iat,
    } = this.auth0Service.verifyAndDecode(accessToken);

    const maxExpirationTime = this.getMaxExpirationTime();

    if (expirationTime) {
      this.assertExpirationTime(expirationTime, maxExpirationTime);
    }

    const userId =
      await this.usersRepository.findOrCreateByExtUserId(extUserId);

    const token = this.authRepository.signToken(
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

    return { accessToken: token };
  }

  public async verifySiwe(args: {
    message: string;
    signature: Hex;
  }): Promise<AuthTokenResponse> {
    const { chainId, address, notBefore, issuedAt, expirationTime } =
      await this.siweRepository.getValidatedSiweMessage(args);

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
        ...(notBefore && { nbf: new Date(notBefore) }),
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

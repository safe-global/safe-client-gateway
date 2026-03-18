// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import {
  assertExpirationTime,
  getMaxExpirationTime,
} from '@/modules/auth/utils/token-expiration.utils';
import { SiweDto } from '@/modules/auth/routes/entities/siwe.dto.entity';
import { ISiweRepository } from '@/modules/siwe/domain/siwe.repository.interface';
import { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import {
  AuthMethod,
  AuthPayloadDto,
} from '@/modules/auth/domain/entities/auth-payload.entity';
import { JwtPayloadWithClaims } from '@/datasources/jwt/jwt-claims.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';

export type AuthTokenResponse = {
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
}

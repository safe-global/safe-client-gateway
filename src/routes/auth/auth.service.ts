import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { SiweDto } from '@/routes/auth/entities/siwe.dto.entity';
import { ISiweRepository } from '@/domain/siwe/siwe.repository.interface';
import { IAuthRepository } from '@/domain/auth/auth.repository.interface';
import { AuthPayloadDto } from '@/domain/auth/entities/auth-payload.entity';
import { JwtPayloadWithClaims } from '@/datasources/jwt/jwt-claims.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';

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
  ) {
    this.maxValidityPeriodInSeconds = this.configurationService.getOrThrow(
      'auth.maxValidityPeriodSeconds',
    );
  }

  async getNonce(): Promise<{
    nonce: string;
  }> {
    return await this.siweRepository.generateNonce();
  }

  async getAccessToken(args: SiweDto): Promise<{
    accessToken: string;
  }> {
    const { chainId, address, notBefore, issuedAt, expirationTime } =
      await this.siweRepository.getValidatedSiweMessage(args);

    const maxExpirationTime = this.getMaxExpirationTime();

    if (expirationTime && expirationTime > maxExpirationTime) {
      throw new ForbiddenException(
        `Cannot issue token for longer than ${this.maxValidityPeriodInSeconds} seconds`,
      );
    }

    const accessToken = this.authRepository.signToken(
      {
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

    return {
      accessToken,
    };
  }

  getTokenPayloadWithClaims(
    accessToken: string,
  ): JwtPayloadWithClaims<AuthPayloadDto> {
    return this.authRepository.decodeToken(accessToken);
  }

  private getMaxExpirationTime(): Date {
    return new Date(Date.now() + this.maxValidityPeriodInSeconds * 1_000);
  }
}

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { SiweDto } from '@/routes/auth/entities/siwe.dto.entity';
import { ISiweRepository } from '@/domain/siwe/siwe.repository.interface';
import { IAuthRepository } from '@/domain/auth/auth.repository.interface';
import { getSecondsUntil } from '@/domain/common/utils/time';
import {
  AuthPayloadDto,
  AuthPayloadDtoSchema,
} from '@/domain/auth/entities/auth-payload.entity';
import { JwtPayloadWithClaims } from '@/datasources/jwt/jwt-claims.entity';
import { parseSiweMessage } from 'viem/siwe';

@Injectable()
export class AuthService {
  constructor(
    @Inject(ISiweRepository)
    private readonly siweRepository: ISiweRepository,
    @Inject(IAuthRepository)
    private readonly authRepository: IAuthRepository,
  ) {}

  async getNonce(): Promise<{
    nonce: string;
  }> {
    return await this.siweRepository.generateNonce();
  }

  async getAccessToken(args: SiweDto): Promise<{
    accessToken: string;
  }> {
    const isValid = await this.siweRepository.verifyMessage(args);

    if (!isValid) {
      throw new UnauthorizedException();
    }

    const { chainId, address, notBefore, expirationTime } = parseSiweMessage(
      args.message,
    );

    const payload = AuthPayloadDtoSchema.parse({
      chain_id: chainId?.toString(),
      signer_address: address,
    });

    const accessToken = this.authRepository.signToken(payload, {
      ...(notBefore && {
        notBefore: getSecondsUntil(new Date(notBefore)),
      }),
      ...(expirationTime && {
        expiresIn: getSecondsUntil(new Date(expirationTime)),
      }),
    });

    return {
      accessToken,
    };
  }

  getTokenPayloadWithClaims(
    accessToken: string,
  ): JwtPayloadWithClaims<AuthPayloadDto> {
    return this.authRepository.decodeToken(accessToken);
  }
}

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { VerifyAuthMessageDto } from '@/routes/auth/entities/verify-auth-message.dto.entity';
import { ISiweRepository } from '@/domain/siwe/siwe.repository.interface';
import { IJwtRepository } from '@/domain/jwt/jwt.repository.interface';
import { getSecondsUntil } from '@/domain/common/utils/time';
import { JwtAccessTokenPayload } from '@/routes/auth/entities/jwt-access-token.payload.entity';
import { JwtPayloadWithClaims } from '@/datasources/jwt/jwt-claims.entity';

@Injectable()
export class AuthService {
  constructor(
    @Inject(ISiweRepository)
    private readonly siweRepository: ISiweRepository,
    @Inject(IJwtRepository)
    private readonly jwtRepository: IJwtRepository,
  ) {}

  async getNonce(): Promise<{
    nonce: string;
  }> {
    return await this.siweRepository.generateNonce();
  }

  async getAccessToken(args: VerifyAuthMessageDto): Promise<{
    accessToken: string;
  }> {
    const isValid = await this.siweRepository.isValidMessage(args);

    if (!isValid) {
      throw new UnauthorizedException();
    }

    const { chainId, address, notBefore, expirationTime } = args.message;

    const payload: JwtAccessTokenPayload = {
      chain_id: chainId.toString(),
      signer_address: address,
    };

    const accessToken = this.jwtRepository.signToken(payload, {
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
  ): JwtPayloadWithClaims<JwtAccessTokenPayload> {
    return this.jwtRepository.decodeToken(accessToken);
  }
}
